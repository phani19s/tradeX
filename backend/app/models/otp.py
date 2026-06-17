from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import DateTime
from sqlalchemy import Boolean

from datetime import datetime
from datetime import timedelta

from app.core.database import Base


class OTPVerification(Base):

    __tablename__ = "otp_verifications"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    email = Column(
        String,
        nullable=False
    )

    otp = Column(
        String,
        nullable=False
    )

    verified = Column(
        Boolean,
        default=False
    )

    expires_at = Column(
        DateTime,
        default=lambda:
        datetime.utcnow()
        + timedelta(minutes=5)
    )