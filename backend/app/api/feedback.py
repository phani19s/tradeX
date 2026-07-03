from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from app.core.dependencies import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate, FeedbackResponse

router = APIRouter(
    prefix="/feedback",
    tags=["Feedback"]
)

@router.post("", response_model=FeedbackResponse)
def create_feedback(
    payload: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_feedback = Feedback(
        user_id=current_user.id,
        subject=payload.subject,
        message=payload.message,
        status="Pending"
    )
    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)
    return new_feedback

@router.get("/admin", response_model=List[FeedbackResponse])
def get_all_feedbacks(
    status: Optional[str] = Query(None, description="Filter by status (Pending/Resolved)"),
    search: Optional[str] = Query(None, description="Search by user name, email, or subject"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized. Administrator access required.")
    
    query = db.query(Feedback).options(joinedload(Feedback.user)).join(User, Feedback.user_id == User.id)
    
    if status:
        query = query.filter(Feedback.status == status)
        
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (User.username.ilike(search_filter)) |
            (User.email.ilike(search_filter)) |
            (Feedback.subject.ilike(search_filter))
        )
        
    return query.order_by(Feedback.created_at.desc()).all()

@router.patch("/admin/{feedback_id}/resolve", response_model=FeedbackResponse)
def resolve_feedback(
    feedback_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized. Administrator access required.")
        
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
        
    feedback.status = "Resolved"
    db.commit()
    db.refresh(feedback)
    return feedback

@router.delete("/admin/{feedback_id}")
def delete_feedback(
    feedback_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized. Administrator access required.")
        
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
        
    db.delete(feedback)
    db.commit()
    return {"message": "Feedback deleted successfully"}
