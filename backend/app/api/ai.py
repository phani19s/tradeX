from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.security import get_current_user
from app.models.chat_history import ChatHistory
from app.models.user import User
from app.schemas.ai_chat import ChatHistoryResponse, ChatRequest, ChatResponse
from app.services.ai_chat_service import answer_question


router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    answer = answer_question(db, current_user.id, payload.message)
    return {"answer": answer}


@router.get("/chat/history", response_model=List[ChatHistoryResponse])
def chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.desc())
        .limit(50)
        .all()
    )


@router.delete("/chat/history")
def clear_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(ChatHistory).filter(
        ChatHistory.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "Chat history cleared"}


@router.delete("/chat/history/{history_id}")
def delete_chat_history_item(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.id == history_id,
            ChatHistory.user_id == current_user.id
        )
        .first()
    )

    if item:
        db.delete(item)
        db.commit()

    return {"message": "Chat history item deleted"}
