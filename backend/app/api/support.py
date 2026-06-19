from fastapi import APIRouter, Depends, HTTPException, Form
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
import uuid
from datetime import datetime

from app.core.dependencies import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.support import SupportTicket, SupportMessage
from app.schemas.support import (
    TicketCreate, TicketResponse, TicketStatusUpdate,
    MessageCreate, MessageResponse, UserChatSummary
)
from app.core.email import send_ticket_created_email, send_ticket_resolved_email
from app.core.notifications import create_notification

router = APIRouter(
    prefix="/support",
    tags=["Support"]
)

# Ticket Routes
@router.post("/tickets", response_model=TicketResponse)
def raise_ticket(
    payload: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket_number = f"TX-{uuid.uuid4().hex[:8].upper()}"
    
    new_ticket = SupportTicket(
        ticket_number=ticket_number,
        user_id=current_user.id,
        transaction_id=payload.transaction_id,
        transaction_type=payload.transaction_type,
        issue_type=payload.issue_type,
        description=payload.description
    )
    
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    
    create_notification(
        db, 
        current_user.id, 
        "Ticket Raised", 
        f"Your ticket {new_ticket.ticket_number} has been successfully raised. Our team will review it soon.", 
        "TICKET"
    )
    
    try:
        send_ticket_created_email(
            current_user.email,
            current_user.username,
            new_ticket.ticket_number,
            new_ticket.issue_type,
            new_ticket.id
        )
    except Exception as e:
        print(f"Failed to send ticket creation email: {e}")
        
    return new_ticket

@router.get("/tickets", response_model=List[TicketResponse])
def get_user_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(SupportTicket).filter(SupportTicket.user_id == current_user.id).order_by(SupportTicket.created_at.desc()).all()

@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
def get_ticket_details(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    ).first()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    return ticket

@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
def user_update_ticket(
    ticket_id: int,
    payload: TicketStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    ).first()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    old_status = ticket.status
    ticket.status = payload.status
    
    if payload.status in ["RESOLVED", "CLOSED"] and old_status not in ["RESOLVED", "CLOSED"]:
        ticket.resolved_at = datetime.utcnow()
        if payload.status == "RESOLVED":
            try:
                send_ticket_resolved_email(current_user.email, current_user.username, ticket.ticket_number, payload.resolution or "Issue resolved by user")
            except Exception as e:
                print(f"Failed to send ticket resolution email: {e}")
                
    db.commit()
    db.refresh(ticket)
    return ticket

# Admin Ticket Routes
@router.get("/admin/tickets", response_model=List[TicketResponse])
def admin_list_tickets(
    status: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    query = db.query(SupportTicket)
    if status:
        query = query.filter(SupportTicket.status == status)
        
    return query.order_by(SupportTicket.created_at.desc()).all()

@router.patch("/admin/tickets/{ticket_id}", response_model=TicketResponse)
def admin_update_ticket(
    ticket_id: int,
    payload: TicketStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    old_status = ticket.status
    ticket.status = payload.status
    if payload.resolution:
        ticket.resolution = payload.resolution
        
    if payload.status in ["RESOLVED", "CLOSED"] and old_status not in ["RESOLVED", "CLOSED"]:
        ticket.resolved_at = datetime.utcnow()
        if payload.status == "RESOLVED":
            try:
                user = db.query(User).filter(User.id == ticket.user_id).first()
                send_ticket_resolved_email(user.email, user.username, ticket.ticket_number, ticket.resolution or "Issue resolved")
                create_notification(db, user.id, "Ticket Resolved", f"Your ticket {ticket.ticket_number} has been resolved.", "TICKET")
            except Exception as e:
                print(f"Failed to send ticket resolution email: {e}")
                
    db.commit()
    db.refresh(ticket)
    return ticket

@router.get("/admin/tickets/email/progress", response_class=HTMLResponse)
def email_ticket_progress(token: str, db: Session = Depends(get_db)):
    try:
        from app.core.email import decode_ticket_action_token
        payload = decode_ticket_action_token(token)
        ticket_id = int(payload.get("sub", "").replace("ticket:", ""))
        action = payload.get("action")
        
        if action != "progress":
            return HTMLResponse("<h1>Invalid action</h1>")
    except:
        return HTMLResponse("<h1>Invalid or expired token</h1>")
        
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        return HTMLResponse("<h1>Ticket not found</h1>")
        
    if ticket.status == "RESOLVED":
        return HTMLResponse(f"<html><body style='font-family: Arial; padding: 40px; background: #f4f6f9; text-align: center;'><div style='max-width: 500px; margin: auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);'><h1 style='color: #10b981; margin-top: 0;'>Already Resolved</h1><p style='color: #475569; font-size: 16px;'>Ticket <strong>{ticket.ticket_number}</strong> is already marked as resolved.</p></div></body></html>")

    if ticket.status == "IN_PROGRESS":
        return HTMLResponse(f"<html><body style='font-family: Arial; padding: 40px; background: #f4f6f9; text-align: center;'><div style='max-width: 500px; margin: auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);'><h1 style='color: #2563eb; margin-top: 0;'>Already in Progress</h1><p style='color: #475569; font-size: 16px;'>Ticket <strong>{ticket.ticket_number}</strong> is already being handled.</p></div></body></html>")
    
    ticket.status = "IN_PROGRESS"
    db.commit()
    
    return HTMLResponse(f"<html><body style='font-family: Arial; padding: 40px; background: #f4f6f9; text-align: center;'><div style='max-width: 500px; margin: auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);'><h1 style='color: #2563eb; margin-top: 0;'>Status Updated! ✅</h1><p style='color: #475569; font-size: 16px;'>Ticket <strong>{ticket.ticket_number}</strong> status changed to <strong>In Progress</strong>.</p></div></body></html>")

@router.get("/admin/tickets/email/resolve-form", response_class=HTMLResponse)
def email_ticket_resolve_form(token: str, db: Session = Depends(get_db)):
    try:
        from app.core.email import decode_ticket_action_token
        payload = decode_ticket_action_token(token)
        ticket_id = int(payload.get("sub", "").replace("ticket:", ""))
    except:
        return HTMLResponse("<h1>Invalid or expired token</h1>")
        
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        return HTMLResponse("<h1>Ticket not found</h1>")

    if ticket.status == "RESOLVED":
        return HTMLResponse(f"<html><body style='font-family: Arial; padding: 40px; background: #f4f6f9; text-align: center;'><div style='max-width: 500px; margin: auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);'><h1 style='color: #10b981; margin-top: 0;'>Already Resolved</h1><p style='color: #475569; font-size: 16px;'>Ticket <strong>{ticket.ticket_number}</strong> is already marked as resolved.</p></div></body></html>")
        
    html = f"""
    <html>
    <head><title>Resolve Ticket</title></head>
    <body style="font-family: Arial; padding: 40px; background: #f4f6f9;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #2563eb; margin-top: 0;">Resolve Ticket: {ticket.ticket_number}</h2>
            <p style="color: #475569;">Enter the resolution message for the user.</p>
            <form action="/support/admin/tickets/email/resolve" method="POST">
                <input type="hidden" name="token" value="{token}">
                <textarea name="resolution" rows="6" style="width: 100%; box-sizing: border-box; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; font-family: Arial; margin-bottom: 20px; font-size: 14px;" placeholder="Describe how the issue was resolved..." required></textarea>
                <button type="submit" style="background: #10b981; color: white; padding: 12px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px; width: 100%;">Resolve Ticket</button>
            </form>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)

@router.post("/admin/tickets/email/resolve", response_class=HTMLResponse)
def email_ticket_resolve_submit(token: str = Form(...), resolution: str = Form(...), db: Session = Depends(get_db)):
    try:
        from app.core.email import decode_ticket_action_token
        payload = decode_ticket_action_token(token)
        ticket_id = int(payload.get("sub", "").replace("ticket:", ""))
        action = payload.get("action")
        
        if action != "resolve":
            return HTMLResponse("<h1>Invalid action</h1>")
    except:
        return HTMLResponse("<h1>Invalid or expired token</h1>")
        
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        return HTMLResponse("<h1>Ticket not found</h1>")
        
    if ticket.status == "RESOLVED":
        return HTMLResponse(f"<html><body style='font-family: Arial; padding: 40px; background: #f4f6f9; text-align: center;'><div style='max-width: 500px; margin: auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);'><h1 style='color: #10b981; margin-top: 0;'>Already Resolved</h1><p style='color: #475569; font-size: 16px;'>Ticket <strong>{ticket.ticket_number}</strong> is already marked as resolved.</p></div></body></html>")

    ticket.status = "RESOLVED"
    ticket.resolution = resolution
    ticket.resolved_at = datetime.utcnow()
    
    user = db.query(User).filter(User.id == ticket.user_id).first()
    if user:
        try:
            send_ticket_resolved_email(user.email, user.username, ticket.ticket_number, resolution)
            create_notification(db, user.id, "Ticket Resolved", f"Your ticket {ticket.ticket_number} has been resolved.", "TICKET")
        except Exception as e:
            print(f"Failed to send ticket resolution email: {e}")
            
    db.commit()
    
    return HTMLResponse(f"<html><body style='font-family: Arial; padding: 40px; background: #f4f6f9; text-align: center;'><div style='max-width: 500px; margin: auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);'><h1 style='color: #10b981; margin-top: 0;'>Ticket Resolved! ✅</h1><p style='color: #475569; font-size: 16px;'>Ticket <strong>{ticket.ticket_number}</strong> has been resolved and the user has been notified.</p></div></body></html>")

# Chat Routes
@router.post("/chat", response_model=MessageResponse)
def send_chat_message(
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_message = SupportMessage(
        user_id=current_user.id,
        sender_type="USER",
        message=payload.message
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    try:
        from app.core.email import send_chat_message_to_admin
        send_chat_message_to_admin(current_user.id, current_user.email, payload.message)
    except Exception as e:
        print(f"Failed to send chat email to admin: {e}")
        
    return new_message

@router.get("/chat", response_model=List[MessageResponse])
def get_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # User marks all admin messages as read when they view history
    db.query(SupportMessage).filter(
        SupportMessage.user_id == current_user.id,
        SupportMessage.sender_type == "ADMIN",
        SupportMessage.is_read == False
    ).update({"is_read": True})
    db.commit()
    
    return db.query(SupportMessage).filter(SupportMessage.user_id == current_user.id).order_by(SupportMessage.created_at.asc()).all()

# Admin Chat Routes
@router.get("/admin/chat/users", response_model=List[UserChatSummary])
def admin_get_chat_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    # Get distinct users who have chat history
    user_ids = db.query(SupportMessage.user_id).distinct().all()
    user_ids = [uid[0] for uid in user_ids]
    
    summaries = []
    for uid in user_ids:
        user = db.query(User).filter(User.id == uid).first()
        last_msg = db.query(SupportMessage).filter(SupportMessage.user_id == uid).order_by(SupportMessage.created_at.desc()).first()
        unread_count = db.query(SupportMessage).filter(
            SupportMessage.user_id == uid,
            SupportMessage.sender_type == "USER",
            SupportMessage.is_read == False
        ).count()
        
        if user:
            summaries.append({
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "last_message": last_msg.message if last_msg else "",
                "last_message_at": last_msg.created_at if last_msg else datetime.utcnow(),
                "unread_count": unread_count
            })
        
    return sorted(summaries, key=lambda x: x["last_message_at"], reverse=True)

@router.get("/admin/chat/{user_id}", response_model=List[MessageResponse])
def admin_get_user_chat(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    # Admin marks all user messages as read when viewing
    db.query(SupportMessage).filter(
        SupportMessage.user_id == user_id,
        SupportMessage.sender_type == "USER",
        SupportMessage.is_read == False
    ).update({"is_read": True})
    db.commit()
    
    return db.query(SupportMessage).filter(SupportMessage.user_id == user_id).order_by(SupportMessage.created_at.asc()).all()

@router.post("/admin/chat/{user_id}", response_model=MessageResponse)
def admin_reply_chat(
    user_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    new_message = SupportMessage(
        user_id=user_id,
        sender_type="ADMIN",
        message=payload.message
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    create_notification(
        db, 
        user_id, 
        "New Support Message", 
        "You have a new reply from the support team.", 
        "CHAT"
    )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        try:
            from app.core.email import send_chat_message_to_user
            send_chat_message_to_user(user.email, payload.message)
        except Exception as e:
            print(f"Failed to send chat email to user: {e}")
            
    return new_message

@router.get("/chat/email/reply-form", response_class=HTMLResponse)
def chat_reply_form(token: str, db: Session = Depends(get_db)):
    try:
        from app.core.email import decode_action_token
        payload = decode_action_token(token)
        user_id = int(payload.get("sub", "").replace("chat:", ""))
    except Exception as e:
        print(f"Token decode error: {e}")
        return HTMLResponse("<h1>Invalid or expired token</h1>")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return HTMLResponse("<h1>User not found</h1>")
        
    html = f"""
    <html>
    <head><title>Reply to Chat</title></head>
    <body style="font-family: Arial; padding: 40px; background: #f4f6f9;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #2563eb; margin-top: 0;">TradeX Support</h2>
            <p style="color: #475569;">Replying to <strong>{user.email}</strong>'s chat.</p>
            <form action="/support/chat/email/reply" method="POST">
                <input type="hidden" name="token" value="{token}">
                <textarea name="message" rows="6" style="width: 100%; box-sizing: border-box; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; font-family: Arial; margin-bottom: 20px; font-size: 14px;" placeholder="Type your reply here. This will appear in the user's TradeX chat..." required></textarea>
                <button type="submit" style="background: #10b981; color: white; padding: 12px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px; width: 100%;">Send Reply to Chat</button>
            </form>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)

@router.post("/chat/email/reply", response_class=HTMLResponse)
def chat_reply_submit(token: str = Form(...), message: str = Form(...), db: Session = Depends(get_db)):
    try:
        from app.core.email import decode_action_token
        payload = decode_action_token(token)
        user_id = int(payload.get("sub", "").replace("chat:", ""))
    except:
        return HTMLResponse("<h1>Invalid or expired token</h1>")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return HTMLResponse("<h1>User not found</h1>")
        
    new_message = SupportMessage(
        user_id=user_id,
        sender_type="ADMIN",
        message=message
    )
    db.add(new_message)
    db.commit()
    
    create_notification(
        db, 
        user_id, 
        "New Support Message", 
        "You have a new reply from the support team.", 
        "CHAT"
    )
    
    try:
        from app.core.email import send_chat_message_to_user
        send_chat_message_to_user(user.email, message)
    except Exception as e:
        print(f"Failed to send email to user: {e}")
        
    return HTMLResponse(f"<html><body style='font-family: Arial; padding: 40px; background: #f4f6f9; text-align: center;'><div style='max-width: 500px; margin: auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);'><h1 style='color: #10b981; margin-top: 0;'>Reply Sent! ✅</h1><p style='color: #475569; font-size: 16px;'>Your message has been added to the user's chat and an email notification has been sent to them.</p><p style='color: #94a3b8; font-size: 14px; margin-top: 20px;'>You can now close this window.</p></div></body></html>")
