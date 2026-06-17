from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.schemas.user import UserCreate, UserResponse, UserProfileUpdate, UserPasswordChange
from app.schemas.auth import LoginRequest

from app.core.dependencies import get_db

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

from app.models.user import User 
from app.models.portfolio import Portfolio 

from datetime import datetime

from app.models.otp import OTPVerification

from app.schemas.otp import (
    SendOTPRequest,
    VerifyOTPRequest
)

from app.core.otp import generate_otp

from app.core.email import send_otp_email


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

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

    otp_record = (
        db.query(
            OTPVerification
        )
        .filter(
            OTPVerification.email
            == request.email,

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

    otp_record = (
        db.query(OTPVerification)
        .filter(
            OTPVerification.email
            == user.email,
    
            OTPVerification.verified
            == True
        )
        .order_by(
            OTPVerification.id.desc()
        )
        .first()
    )
    
    if not otp_record:
    
        raise HTTPException(
            status_code=400,
            detail="Please verify OTP first"
        )


    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    hashed_password = hash_password(
        user.password
    )

    new_user = User(
        username=user.username,
        email=user.email,
        password=hashed_password
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

    db.delete(otp_record)
    db.commit()

    return {
        "message": "User Registered Successfully"
    }


@router.post("/login")
def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):

    # Find user by email
    user = (
        db.query(User)
        .filter(User.email == request.email)
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
        request.password,
        user.password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Generate JWT token
    access_token = create_access_token(
        {
            "sub": user.email
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin
        }
    }


@router.post("/token")
def login_swagger(
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
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    access_token = create_access_token(
        {
            "sub": user.email
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
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
