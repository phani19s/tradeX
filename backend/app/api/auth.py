from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request

from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.schemas.user import UserCreate, UserResponse, UserProfileUpdate, UserPasswordChange
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordVerifyRequest,
    LoginRequest,
    ResetPasswordRequest,
    TwoFactorLoginRequest,
    TwoFactorVerifyRequest,
)

from app.core.dependencies import get_db

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_session
)

from app.models.user import User 
from app.models.portfolio import Portfolio 
from app.models.user_session import UserSession

from datetime import datetime
from uuid import uuid4

from app.models.otp import OTPVerification

from app.schemas.otp import (
    SendOTPRequest,
    VerifyOTPRequest
)

from app.core.otp import generate_otp

from app.core.email import (
    APP_BASE_URL,
    send_otp_email,
    send_password_reset_otp_email,
    send_two_factor_otp_email,
    send_admin_registration_otp_email,
    APPROVAL_EMAIL
)
from app.core.device import parse_user_agent

from app.models.login_history import LoginHistory
from app.core.location import get_location

import base64
import hmac
import secrets
import struct
import time
from hashlib import sha1
from urllib.parse import quote
router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

def get_request_context(request: Request):
    forwarded_for = request.headers.get("x-forwarded-for")
    real_ip = request.headers.get("x-real-ip")
    ip_address = (
        forwarded_for.split(",")[0].strip()
        if forwarded_for
        else real_ip
        if real_ip
        else request.client.host
        if request.client and request.client.host
        else "Unknown"
    )

    device_location = request.headers.get("x-tradex-location", "").strip()
    location = device_location or get_location(ip_address)
    user_agent = request.headers.get("user-agent", "Unknown Device")
    agent = parse_user_agent(user_agent)

    return {
        "ip_address": ip_address,
        "device": agent["device"],
        "browser": agent["browser_display"],
        "location": location,
    }


def seconds_between(start, end):
    if not start or not end:
        return None

    if getattr(start, "tzinfo", None) is not None:
        start = start.replace(tzinfo=None)
    if getattr(end, "tzinfo", None) is not None:
        end = end.replace(tzinfo=None)

    return max(int((end - start).total_seconds()), 0)


def add_login_history_from_session(db: Session, session: UserSession, status: str):
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
    return history


def record_login_history(
    db: Session,
    user: User,
    request: Request,
    status: str
):
    request_context = get_request_context(request)

    history = LoginHistory(
        user_id=user.id,
        ip_address=request_context["ip_address"],
        device=request_context["device"],
        browser=request_context["browser"],
        location=request_context["location"],
        status=status,
    )

    db.add(history)
    db.commit()


def create_authenticated_session(
    db: Session,
    user: User,
    request: Request
):
    request_context = get_request_context(request)
    session_token_id = str(uuid4())

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
    db.flush()
    add_login_history_from_session(db, session, "Success")

    db.commit()

    return create_access_token(
        {
            "sub": user.email,
            "sid": session_token_id,
        }
    )


def build_login_response(
    user: User,
    access_token: str
):
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "two_factor_enabled": user.two_factor_enabled,
            "two_factor_method": user.two_factor_method,
            "is_admin": user.is_admin,
            "role": user.role
        }
    }


def create_otp_record(
    db: Session,
    email: str
):
    otp = generate_otp()
    otp_record = OTPVerification(
        email=email,
        otp=otp
    )

    db.add(otp_record)
    db.commit()

    return otp


def verify_email_otp(
    db: Session,
    email: str,
    otp: str
):
    otp_record = (
        db.query(OTPVerification)
        .filter(
            OTPVerification.email == email,
            OTPVerification.otp == otp
        )
        .order_by(OTPVerification.id.desc())
        .first()
    )

    if not otp_record:
        return False

    if otp_record.expires_at < datetime.utcnow():
        return False

    db.delete(otp_record)
    db.commit()

    return True


def find_valid_otp(
    db: Session,
    email: str,
    otp: str,
    verified: bool | None = None
):
    query = (
        db.query(OTPVerification)
        .filter(
            OTPVerification.email == email,
            OTPVerification.otp == otp
        )
    )

    if verified is not None:
        query = query.filter(OTPVerification.verified == verified)

    otp_record = query.order_by(OTPVerification.id.desc()).first()

    if not otp_record or otp_record.expires_at < datetime.utcnow():
        return None

    return otp_record


def generate_totp_secret():
    return (
        base64.b32encode(secrets.token_bytes(20))
        .decode("utf-8")
        .rstrip("=")
    )


def normalize_totp_secret(secret: str):
    return secret + "=" * ((8 - len(secret) % 8) % 8)


def get_totp_code(secret: str, counter: int):
    key = base64.b32decode(
        normalize_totp_secret(secret),
        casefold=True
    )
    message = struct.pack(">Q", counter)
    digest = hmac.new(key, message, sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code % 1000000).zfill(6)


def verify_totp_code(secret: str | None, otp: str):
    if not secret or not otp:
        return False

    current_counter = int(time.time() // 30)

    for offset in (-1, 0, 1):
        expected_code = get_totp_code(
            secret,
            current_counter + offset
        )

        if hmac.compare_digest(expected_code, otp):
            return True

    return False


def build_google_authenticator_uri(user: User):
    issuer = "TradeX"
    label = quote(f"{issuer}:{user.email}")
    secret = quote(user.two_factor_secret or "")

    return (
        f"otpauth://totp/{label}"
        f"?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30"
    )


@router.post("/login")
def login(
    http_request: Request,
    credentials: LoginRequest,
    db: Session = Depends(get_db)
):

    # Find user by email
    user = (
        db.query(User)
        .filter(User.email == credentials.email)
        .first()
    )

    # Check if user exists
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Verify password
    if not verify_password(
        credentials.password,
        user.password
    ):
        record_login_history(
            db,
            user,
            http_request,
            "Failed"
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if user.two_factor_enabled:
        if user.two_factor_method == "email":
            otp = create_otp_record(
                db,
                user.email
            )
            send_two_factor_otp_email(
                user.email,
                otp
            )

        return {
            "requires_2fa": True,
            "method": user.two_factor_method,
            "message": "Two-factor authentication required"
        }

    access_token = create_authenticated_session(
        db,
        user,
        http_request
    )

    return build_login_response(
        user,
        access_token
    )


@router.post("/login/2fa")
def login_with_two_factor(
    http_request: Request,
    credentials: TwoFactorLoginRequest,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.email == credentials.email)
        .first()
    )

    if not user or not verify_password(credentials.password, user.password):
        if user:
            record_login_history(
                db,
                user,
                http_request,
                "Failed"
            )

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not user.two_factor_enabled:
        raise HTTPException(
            status_code=400,
            detail="Two-factor authentication is not enabled"
        )

    verified = False

    if user.two_factor_method == "email":
        verified = verify_email_otp(
            db,
            user.email,
            credentials.otp
        )
    elif user.two_factor_method == "google":
        verified = verify_totp_code(
            user.two_factor_secret,
            credentials.otp
        )

    if not verified:
        record_login_history(
            db,
            user,
            http_request,
            "Failed"
        )
        raise HTTPException(
            status_code=400,
            detail="Invalid two-factor authentication code"
        )

    access_token = create_authenticated_session(
        db,
        user,
        http_request
    )

    return build_login_response(
        user,
        access_token
    )


@router.post("/token")
def login_swagger(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    user = (
        db.query(User)
        .filter(
            User.email == form_data.username
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    if not verify_password(
        form_data.password,
        user.password
    ):
        record_login_history(
            db,
            user,
            request,
            "Failed"
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    if user.two_factor_enabled:
        raise HTTPException(
            status_code=403,
            detail="Two-factor authentication is enabled. Please login from the app."
        )

    access_token = create_authenticated_session(
        db,
        user,
        request
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    } 


@router.post("/forgot-password/send-otp")
def send_forgot_password_otp(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    if not user:
        return {
            "message": "If this email is registered, a password reset code has been sent."
        }

    otp = create_otp_record(db, user.email)
    reset_link = f"{APP_BASE_URL}/forgot-password?email={quote(user.email)}&otp={quote(otp)}"
    send_password_reset_otp_email(user.email, otp, reset_link)

    return {
        "message": "If this email is registered, a password reset code has been sent."
    }


@router.post("/forgot-password/verify-otp")
def verify_forgot_password_otp(
    request: ForgotPasswordVerifyRequest,
    db: Session = Depends(get_db)
):
    otp_record = find_valid_otp(
        db,
        request.email,
        request.otp
    )

    if not otp_record:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OTP"
        )

    if not otp_record.verified:
        otp_record.verified = True
        db.commit()

    return {
        "message": "OTP verified successfully"
    }


@router.post("/forgot-password/reset")
def reset_forgot_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match"
        )

    user = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid reset request"
        )

    otp_record = find_valid_otp(
        db,
        request.email,
        request.otp,
        verified=True
    )

    if not otp_record:
        raise HTTPException(
            status_code=400,
            detail="Please verify OTP first"
        )

    user.password = hash_password(request.new_password)
    db.delete(otp_record)
    db.commit()

    return {
        "message": "Password updated successfully"
    }

@router.post("/send-otp")
def send_otp(
    request: SendOTPRequest,
    db: Session = Depends(get_db)
):

    existing_user = (
        db.query(User)
        .filter(
            User.email == request.email
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    if request.role == "Administrator":
        # Generate two OTPs
        user_otp = generate_otp()
        user_otp_record = OTPVerification(
            email=request.email,
            otp=user_otp
        )
        db.add(user_otp_record)

        admin_otp = generate_otp()
        admin_otp_record = OTPVerification(
            email=f"admin_{request.email}",
            otp=admin_otp
        )
        db.add(admin_otp_record)

        db.commit()

        # Send User OTP to registered email
        send_otp_email(
            request.email,
            user_otp
        )

        # Send Admin OTP to APPROVAL_EMAIL (tradex.adminn@gmail.com)
        send_admin_registration_otp_email(
            APPROVAL_EMAIL,
            request.email,
            admin_otp
        )

        return {
            "message": "OTPs sent successfully to user and admin"
        }
    else:
        # Trader flow
        otp = generate_otp()

        otp_record = OTPVerification(
            email=request.email,
            otp=otp
        )

        db.add(otp_record)

        db.commit()

        send_otp_email(
            request.email,
            otp
        )

        return {
            "message":
            "OTP sent successfully"
        }

@router.post("/verify-otp")
def verify_otp(
    request: VerifyOTPRequest,
    db: Session = Depends(get_db)
):

    target_email = f"admin_{request.email}" if request.is_admin_otp else request.email

    otp_record = (
        db.query(
            OTPVerification
        )
        .filter(
            OTPVerification.email
            == target_email,

            OTPVerification.otp
            == request.otp
        )
        .order_by(
            OTPVerification.id.desc()
        )
        .first()
    )

    if not otp_record:

        raise HTTPException(
            status_code=400,
            detail="Invalid OTP"
        )

    if (
        otp_record.expires_at
        < datetime.utcnow()
    ):
        raise HTTPException(
            status_code=400,
            detail="OTP expired"
        )

    otp_record.verified = True

    db.commit()

    return {
        "message":
        "OTP verified successfully"
    }

@router.post("/register")
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    existing_user = (
        db.query(User)
        .filter(User.email == user.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    if user.role == "Administrator":
        # Check both user and admin OTP verification
        user_otp_record = (
            db.query(OTPVerification)
            .filter(
                OTPVerification.email == user.email,
                OTPVerification.verified == True
            )
            .order_by(OTPVerification.id.desc())
            .first()
        )

        admin_otp_record = (
            db.query(OTPVerification)
            .filter(
                OTPVerification.email == f"admin_{user.email}",
                OTPVerification.verified == True
            )
            .order_by(OTPVerification.id.desc())
            .first()
        )

        if not user_otp_record or not admin_otp_record:
            raise HTTPException(
                status_code=400,
                detail="Please verify both User OTP and Admin OTP first"
            )

        if user_otp_record.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=400,
                detail="User OTP has expired. Please request a new one."
            )

        if admin_otp_record.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=400,
                detail="Admin OTP has expired. Please request a new one."
            )
    else:
        # Trader flow
        user_otp_record = (
            db.query(OTPVerification)
            .filter(
                OTPVerification.email == user.email,
                OTPVerification.verified == True
            )
            .order_by(OTPVerification.id.desc())
            .first()
        )
        admin_otp_record = None

        if not user_otp_record:
            raise HTTPException(
                status_code=400,
                detail="Please verify OTP first"
            )

        if user_otp_record.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=400,
                detail="OTP has expired. Please request a new one."
            )

    hashed_password = hash_password(
        user.password
    )

    new_user = User(
        username=user.username,
        email=user.email,
        password=hashed_password,
        role=user.role,
        is_admin=True if user.role in ["Administrator", "Super Administrator"] else False
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    portfolio = Portfolio(
        user_id=new_user.id,
        balance=0
    )
    db.add(portfolio)
    db.commit()

    if user_otp_record:
        db.delete(user_otp_record)
    if admin_otp_record:
        db.delete(admin_otp_record)
    db.commit()

    return {
        "message": "User Registered Successfully"
    }


@router.get("/profile", response_model=UserResponse)
def get_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user

@router.put("/profile", response_model=UserResponse)
def update_profile(
    profile_data: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.username = profile_data.username
    current_user.phone_number = profile_data.phone_number
    current_user.account_holder_name = profile_data.account_holder_name
    current_user.account_number = profile_data.account_number
    current_user.ifsc_code = profile_data.ifsc_code
    current_user.bank_name = profile_data.bank_name
    current_user.upi_id = profile_data.upi_id
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/change-password")
def change_password(
    password_data: UserPasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(password_data.old_password, current_user.password):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    
    current_user.password = hash_password(password_data.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


@router.post("/2fa/email/enable")
def send_enable_email_two_factor_otp(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    otp = create_otp_record(
        db,
        current_user.email
    )
    send_two_factor_otp_email(
        current_user.email,
        otp
    )

    return {
        "message": "Email OTP sent successfully"
    }


@router.post("/2fa/email/verify", response_model=UserResponse)
def verify_enable_email_two_factor(
    request: TwoFactorVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_email_otp(
        db,
        current_user.email,
        request.otp
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OTP"
        )

    current_user.two_factor_enabled = True
    current_user.two_factor_method = "email"
    current_user.two_factor_secret = None

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/2fa/google/setup")
def setup_google_two_factor(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.two_factor_secret = generate_totp_secret()

    db.commit()
    db.refresh(current_user)

    return {
        "secret": current_user.two_factor_secret,
        "provisioning_uri": build_google_authenticator_uri(current_user),
        "message": "Add this secret to Google Authenticator and verify the code"
    }


@router.post("/2fa/google/verify", response_model=UserResponse)
def verify_google_two_factor(
    request: TwoFactorVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_totp_code(
        current_user.two_factor_secret,
        request.otp
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid authenticator code"
        )

    current_user.two_factor_enabled = True
    current_user.two_factor_method = "google"

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/2fa/disable", response_model=UserResponse)
def disable_two_factor(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.two_factor_enabled = False
    current_user.two_factor_method = None
    current_user.two_factor_secret = None

    db.commit()
    db.refresh(current_user)

    return current_user


@router.get("/sessions")
def get_active_sessions(
    current_session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    sessions = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == current_session.user_id,
            UserSession.is_active == True
        )
        .order_by(UserSession.created_at.desc())
        .all()
    )

    return [
        {
            "id": session.id,
            "session_id": session.session_token_id,
            "ip_address": session.ip_address,
            "device": session.device,
            "browser": session.browser,
            "location": session.location,
            "login_time": session.created_at,
            "created_at": session.created_at,
            "last_activity": session.last_activity,
            "logout_time": session.logout_time,
            "status": session.status or "Active",
            "session_duration": (
                session.session_duration
                if session.session_duration is not None
                else seconds_between(session.created_at, datetime.utcnow())
            ),
            "is_current": session.id == current_session.id,
        }
        for session in sessions
    ]


@router.post("/sessions/logout-others")
def logout_other_sessions(
    current_session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    sessions = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == current_session.user_id,
            UserSession.is_active == True,
            UserSession.id != current_session.id
        )
        .all()
    )

    now = datetime.utcnow()

    for session in sessions:
        session.is_active = False
        session.status = "Logout"
        session.revoked_at = now
        session.logout_time = now
        session.session_duration = seconds_between(session.created_at, now)
        add_login_history_from_session(db, session, "Logout")

    db.commit()

    return {
        "message": "Other active sessions logged out successfully",
        "count": len(sessions),
    }


@router.post("/sessions/{session_id}/logout")
def logout_session(
    session_id: int,
    current_session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    session = (
        db.query(UserSession)
        .filter(
            UserSession.id == session_id,
            UserSession.user_id == current_session.user_id
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    if session.id == current_session.id:
        raise HTTPException(
            status_code=400,
            detail="Current session cannot be logged out from here"
        )

    if session.is_active:
        now = datetime.utcnow()
        session.is_active = False
        session.status = "Logout"
        session.revoked_at = now
        session.logout_time = now
        session.session_duration = seconds_between(session.created_at, now)
        add_login_history_from_session(db, session, "Logout")
        db.commit()

    return {
        "message": "Session logged out successfully"
    }


@router.post("/logout")
def logout_current_session(
    current_session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    if current_session.is_active:
        now = datetime.utcnow()
        current_session.is_active = False
        current_session.status = "Logout"
        current_session.revoked_at = now
        current_session.logout_time = now
        current_session.session_duration = seconds_between(current_session.created_at, now)
        add_login_history_from_session(db, current_session, "Logout")
        db.commit()

    return {
        "message": "Logged out successfully"
    }
