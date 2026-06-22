from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, ExpiredSignatureError, jwt
import asyncio

from app.core.config import ALGORITHM, SECRET_KEY
from app.core.database import SessionLocal
from app.models.user import User
from app.services.websocket_manager import notification_manager

router = APIRouter(tags=["WebSockets"])


def get_user_id_from_token(token: str):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        email = payload.get("sub")

        if not email:
            print("WebSocket Error: No email found in token")
            return None

        db = SessionLocal()

        try:
            user = (
                db.query(User)
                .filter(User.email == email)
                .first()
            )

            if not user:
                print(f"WebSocket Error: User not found for {email}")
                return None

            return user.id

        finally:
            db.close()

    except ExpiredSignatureError:
        print("WebSocket Error: Token expired")
        return None

    except JWTError as e:
        print(f"WebSocket JWT Error: {e}")
        return None

    except Exception as e:
        print(f"WebSocket Unexpected Error: {e}")
        return None


@router.websocket("/ws/notifications")
async def notification_websocket(websocket: WebSocket):
    # await websocket.accept()

    token = websocket.query_params.get("token")

    if not token:
        await websocket.send_json({
            "type": "error",
            "message": "Authentication token missing"
        })

        await websocket.close(code=1008)
        return

    user_id = get_user_id_from_token(token)

    if not user_id:
        await websocket.send_json({
            "type": "error",
            "message": "Invalid or expired token"
        })

        await websocket.close(code=1008)
        return

    await notification_manager.connect(
        user_id,
        websocket
    )

    await websocket.send_json({
        "type": "connected",
        "message": "WebSocket connected successfully"
    })

    print(f"WebSocket Connected: User {user_id}")

    try:
        while True:
            # Keep connection alive
            await asyncio.sleep(30)

    except WebSocketDisconnect:
        notification_manager.disconnect(
            user_id,
            websocket
        )

        print(f"WebSocket Disconnected: User {user_id}")

    except Exception as e:
        print(f"WebSocket Runtime Error: {e}")

        notification_manager.disconnect(
            user_id,
            websocket
        )

