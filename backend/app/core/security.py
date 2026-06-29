from passlib.context import CryptContext

from jose import JWTError, jwt

from datetime import datetime, timedelta
from hashlib import sha256

from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from fastapi.security import OAuth2PasswordBearer

from sqlalchemy.orm import Session

from app.core.config import (
    SECRET_KEY,
    ALGORITHM
)

from app.core.dependencies import get_db
from app.core.location import get_location
from app.core.device import parse_user_agent
from app.models.login_history import LoginHistory
from app.models.user import User
from app.models.user_session import UserSession


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="auth/token"
)

SESSION_TIMEOUT_MINUTES = 15


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
):
    return pwd_context.verify(
        plain_password,
        hashed_password
    )


def create_access_token(
    data: dict
):
    to_encode = data.copy()

    expire = (
        datetime.utcnow()
        + timedelta(days=7)
    )

    to_encode.update(
        {"exp": expire}
    )

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt


def _credentials_exception():
    return HTTPException(
        status_code=401,
        detail="Could not validate credentials"
    )


def decode_access_token(token: str):
    credentials_exception = _credentials_exception()

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
    except JWTError:
        raise credentials_exception

    email = payload.get("sub")
    if email is None:
        raise credentials_exception

    return payload


def _build_request_context(request: Request | None):
    forwarded_for = request.headers.get("x-forwarded-for") if request else None
    real_ip = request.headers.get("x-real-ip") if request else None
    ip_address = (
        forwarded_for.split(",")[0].strip()
        if forwarded_for
        else real_ip
        if real_ip
        else request.client.host
        if request and request.client and request.client.host
        else "Unknown"
    )

    device_location = request.headers.get("x-tradex-location", "").strip() if request else ""
    location = device_location or get_location(ip_address)
    user_agent = request.headers.get("user-agent", "Unknown Device") if request else "Unknown Device"
    agent = parse_user_agent(user_agent)

    return {
        "ip_address": ip_address,
        "device": agent["device"],
        "browser": agent["browser_display"],
        "location": location,
    }


def _seconds_between(start, end):
    if not start or not end:
        return None

    if getattr(start, "tzinfo", None) is not None:
        start = start.replace(tzinfo=None)
    if getattr(end, "tzinfo", None) is not None:
        end = end.replace(tzinfo=None)

    return max(int((end - start).total_seconds()), 0)


def _add_session_history(db: Session, session: UserSession, status: str):
    history = LoginHistory(
        user_id=session.user_id,
        session_id=session.session_token_id,
        ip_address=session.ip_address,
        device=session.device,
        browser=session.browser,
        location=session.location,
        login_time=session.created_at or datetime.utcnow(),
        logout_time=session.logout_time,
        session_duration=session.session_duration,
        status=status,
    )

    db.add(history)


def _resolve_session_token_id(
    token: str,
    payload: dict
):
    session_token_id = payload.get("sid")

    if session_token_id:
        return session_token_id

    return f"legacy:{sha256(token.encode('utf-8')).hexdigest()}"


def _get_authenticated_entities(
    token: str,
    db: Session,
    request: Request | None = None
):
    credentials_exception = _credentials_exception()
    payload = decode_access_token(token)
    email = payload.get("sub")
    session_token_id = _resolve_session_token_id(
        token,
        payload
    )

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise credentials_exception

    session = (
        db.query(UserSession)
        .filter(
            UserSession.session_token_id == session_token_id
        )
        .first()
    )

    if session and not session.is_active:
        raise credentials_exception

    if session and session.user_id != user.id:
        raise credentials_exception

    if session is None:
        request_context = _build_request_context(request)

        session = UserSession(
            user_id=user.id,
            session_token_id=session_token_id,
            ip_address=request_context["ip_address"],
            device=request_context["device"],
            browser=request_context["browser"],
            location=request_context["location"],
            last_activity=datetime.utcnow(),
            status="Active",
        )

        db.add(session)
        db.commit()
        db.refresh(session)

    now = datetime.utcnow()
    last_activity = session.last_activity or session.created_at or now
    if getattr(last_activity, "tzinfo", None) is not None:
        last_activity = last_activity.replace(tzinfo=None)

    if session.is_active and now - last_activity > timedelta(minutes=SESSION_TIMEOUT_MINUTES):
        session.is_active = False
        session.status = "Session Expired"
        session.logout_time = last_activity + timedelta(minutes=SESSION_TIMEOUT_MINUTES)
        session.revoked_at = session.logout_time
        session.session_duration = _seconds_between(session.created_at, session.logout_time)
        _add_session_history(db, session, "Session Expired")
        db.commit()
        raise credentials_exception

    session.last_activity = now
    db.commit()
    db.refresh(session)

    return user, session


def get_current_user(
    token: str = Depends(oauth2_scheme),
    request: Request = None,
    db: Session = Depends(get_db)
):
    user, _ = _get_authenticated_entities(
        token,
        db,
        request
    )
    return user


def get_current_session(
    token: str = Depends(oauth2_scheme),
    request: Request = None,
    db: Session = Depends(get_db)
):
    _, session = _get_authenticated_entities(
        token,
        db,
        request
    )
    return session
