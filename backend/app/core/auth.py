from fastapi import Depends
from fastapi import HTTPException

from jose import jwt
from jose import JWTError

from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.config import SECRET_KEY
from app.models.user import User
from app.core.security import oauth2_scheme


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=["HS256"]
        )

        email = payload.get("sub")

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user