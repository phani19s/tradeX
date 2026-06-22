from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import (
    get_current_user
)

from app.core.dependencies import get_db

from app.models.login_history import LoginHistory
from app.models.user_session import UserSession

router = APIRouter(
    prefix="/login-history",
    tags=["Login History"]
)


def seconds_between(start, end):
    if not start or not end:
        return None

    if getattr(start, "tzinfo", None) is not None:
        start = start.replace(tzinfo=None)
    if getattr(end, "tzinfo", None) is not None:
        end = end.replace(tzinfo=None)

    return max(int((end - start).total_seconds()), 0)


@router.get("/")
def get_login_history(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
):

    history = (
        db.query(LoginHistory)
        .filter(
            LoginHistory.user_id
            == current_user.id
        )
        .order_by(
            LoginHistory.login_time.desc()
        )
        .all()
    )

    session_ids = [
        item.session_id
        for item in history
        if item.session_id
    ]
    sessions = {}

    if session_ids:
        sessions = {
            session.session_token_id: session
            for session in (
                db.query(UserSession)
                .filter(
                    UserSession.user_id == current_user.id,
                    UserSession.session_token_id.in_(session_ids)
                )
                .all()
            )
        }

    now = datetime.utcnow()
    result = []

    for item in history:
        session = sessions.get(item.session_id)
        logout_time = item.logout_time
        session_duration = item.session_duration

        if session:
            logout_time = logout_time or session.logout_time
            session_duration = (
                session_duration
                if session_duration is not None
                else session.session_duration
            )

            if session_duration is None and session.is_active:
                session_duration = seconds_between(
                    session.created_at,
                    now
                )
            elif session_duration is None and logout_time:
                session_duration = seconds_between(
                    item.login_time,
                    logout_time
                )

        result.append(
            {
                "id": item.id,
                "user_id": item.user_id,
                "session_id": item.session_id,
                "ip_address": item.ip_address,
                "device": item.device,
                "browser": item.browser,
                "location": item.location,
                "login_time": item.login_time,
                "logout_time": logout_time,
                "session_duration": session_duration,
                "status": item.status,
            }
        )

    return result
