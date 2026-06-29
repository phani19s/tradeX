import os
import smtplib
import ssl

from datetime import datetime
from datetime import timedelta
from email.mime.text import MIMEText

from dotenv import load_dotenv
from jose import jwt

from app.core.config import ALGORITHM
from app.core.config import SECRET_KEY

load_dotenv()

EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
APPROVAL_EMAIL = os.getenv("TRADEX_APPROVAL_EMAIL", "tradex.adminn@gmail.com")
APP_BASE_URL = os.getenv("TRADEX_FRONTEND_URL", "http://localhost:5173")
API_BASE_URL = os.getenv("TRADEX_API_URL", "http://127.0.0.1:8000")


def create_action_token(item_id: int, action: str, prefix: str):
    payload = {
        "sub": f"{prefix}:{item_id}",
        "action": action,
        "exp": datetime.utcnow() + timedelta(hours=24),
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

def create_deposit_action_token(deposit_id: int, action: str):
    return create_action_token(deposit_id, action, "deposit")

def create_withdrawal_action_token(withdrawal_id: int, action: str):
    return create_action_token(withdrawal_id, action, "withdrawal")

def create_ticket_action_token(ticket_id: int, action: str):
    return create_action_token(ticket_id, action, "ticket")

def create_chat_action_token(user_id: int):
    return create_action_token(user_id, "reply", "chat")

def decode_action_token(token: str):
    return jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM],
    )

def decode_deposit_action_token(token: str):
    return decode_action_token(token)

def decode_withdrawal_action_token(token: str):
    return decode_action_token(token)

def decode_ticket_action_token(token: str):
    return decode_action_token(token)

def create_maintenance_action_token(action: str):
    return create_action_token(0, action, "maintenance")

def decode_maintenance_action_token(token: str):
    return decode_action_token(token)
...
def send_withdrawal_approval_email(
    user_email: str,
    amount: float,
    withdrawal_id: int,
    bank_details: dict
):
    approve_token = create_withdrawal_action_token(withdrawal_id, "approve")
    reject_token = create_withdrawal_action_token(withdrawal_id, "reject")

    approve_link = f"{API_BASE_URL}/admin/withdrawals/email/approve?token={approve_token}"
    reject_link = f"{API_BASE_URL}/admin/withdrawals/email/reject?token={reject_token}"

    body = f"""
    <html>
    <body style="margin:0;font-family:Arial,sans-serif;background:#f5f7fa;padding:24px;">
      <div style="max-width:640px;margin:auto;background:white;border-radius:16px;padding:28px 30px;box-shadow:0 8px 28px rgba(15,23,42,.12);border:1px solid #e5e7eb;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:34px;font-weight:800;color:#ef4444;letter-spacing:.4px;">TradeX</div>
          <div style="margin-top:6px;font-size:14px;color:#64748b;">Withdrawal verification request</div>
        </div>

        <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:14px;padding:18px 20px;margin-bottom:22px;">
          <div style="font-size:18px;font-weight:700;color:#e11d48;margin-bottom:10px;">Pending withdrawal details</div>
          <p style="margin:8px 0;color:#0f172a;"><strong>User email:</strong> {user_email}</p>
          <p style="margin:8px 0;color:#0f172a;"><strong>Amount:</strong> Rs. {amount}</p>
          <hr style="border:0;border-top:1px solid #fecdd3;margin:12px 0;">
          <p style="margin:8px 0;color:#0f172a;"><strong>Bank Name:</strong> {bank_details.get('bank_name') or 'N/A'}</p>
          <p style="margin:8px 0;color:#0f172a;"><strong>Acc Holder:</strong> {bank_details.get('account_holder_name') or 'N/A'}</p>
          <p style="margin:8px 0;color:#0f172a;"><strong>Acc Number:</strong> {bank_details.get('account_number') or 'N/A'}</p>
          <p style="margin:8px 0;color:#0f172a;"><strong>IFSC Code:</strong> {bank_details.get('ifsc_code') or 'N/A'}</p>
          <p style="margin:8px 0;color:#0f172a;font-weight:bold;color:#2563eb;"><strong>UPI ID:</strong> {bank_details.get('upi_id') or 'N/A'}</p>
          <p style="margin:8px 0;color:#0f172a;"><strong>Withdrawal ID:</strong> {withdrawal_id}</p>
        </div>

        <p style="margin:0 0 18px;color:#334155;line-height:1.6;">
          Please manually transfer the funds to the user using the details above. After the transfer is complete, click <strong>Approve & Enter UTR</strong> to notify the user.
        </p>

        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:22px 0 18px;">
          <a href="{approve_link}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;">Approve & Enter UTR</a>
          <a href="{reject_link}" style="display:inline-block;background:#ef4444;color:white;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;">Reject Withdrawal</a>
          <a href="{APP_BASE_URL}/admin" style="display:inline-block;background:#e2e8f0;color:#0f172a;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;">Admin Panel</a>
        </div>

        <div style="font-size:13px;color:#64748b;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:16px;">
          Replying to this mail will go to the user's email address: <strong>{user_email}</strong>
        </div>

        <p style="margin-top:18px;text-align:center;color:#64748b;font-size:13px;">TradeX Team</p>
      </div>
    </body>
    </html>
    """

    _send_html_email(
        APPROVAL_EMAIL,
        "TradeX Withdrawal Verification Request",
        body,
        reply_to=user_email,
    )

def send_withdrawal_approved_email(
    recipient_email: str,
    username: str,
    amount: float
):
    subject = "TradeX Withdrawal Successful"
    html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f6f9;padding:20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;">
    <div style="background:#10b981;color:white;padding:20px;text-align:center;">
        <h1>Withdrawal Successful</h1>
    </div>
    <div style="padding:25px;">
        <h2 style="color:#0f172a;">Hello {username} 👋,</h2>
        <p style="font-size:16px;color:#475569;">Your withdrawal request has been processed successfully.</p>
        <div style="background:#ecfdf5;border:1px solid #86efac;padding:20px;border-radius:12px;margin-top:15px;">
        <p style="margin:0;font-size:18px;">✅ Your funds are on their way to your bank account.</p>
        <p style="margin-top:12px;"><strong>Amount Withdrawn: ₹{amount:,.2f}</strong></p>
        </div>
        <p style="margin-top:20px;">The transfer may take some time depending on your bank.</p>
        <p>Happy Trading 🚀</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #e2e8f0;">
        <p style="text-align:center;color:#64748b;font-size:14px;margin-top:20px;">TradeX Team</p>
    </div>
    </div>
    </body>
    </html>
    """
    _send_html_email(recipient_email, subject, html)

def send_withdrawal_completed_email(
    recipient_email: str,
    username: str,
    amount: float,
    utr_number: str
):
    subject = "TradeX Withdrawal Completed"
    html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f6f9;padding:20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;">
    <div style="background:#2563eb;color:white;padding:20px;text-align:center;">
        <h1>Withdrawal Completed</h1>
    </div>
    <div style="padding:25px;">
        <h2 style="color:#0f172a;">Hello {username} 👋,</h2>
        <p style="font-size:16px;color:#475569;">Your withdrawal has been successfully completed and funds have been transferred.</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:20px;border-radius:12px;margin-top:15px;">
        <p style="margin:8px 0;color:#0f172a;"><strong>Amount:</strong> ₹{amount:,.2f}</p>
        <p style="margin:8px 0;color:#0f172a;"><strong>UTR Number:</strong> {utr_number}</p>
        <p style="margin:8px 0;color:#0f172a;"><strong>Status:</strong> Completed</p>
        </div>
        <p style="margin-top:20px;">The amount should reflect in your bank account shortly.</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #e2e8f0;">
        <p style="text-align:center;color:#64748b;font-size:14px;margin-top:20px;">TradeX Team</p>
    </div>
    </div>
    </body>
    </html>
    """
    _send_html_email(recipient_email, subject, html)

def send_withdrawal_otp_email(receiver_email, otp):
    body = f"""
    <html>
    <body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:20px;">
      <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:30px;box-shadow:0 4px 12px rgba(0,0,0,.1);">
        <h1 style="color:#2563eb;text-align:center;">TradeX</h1>
        <h2 style="text-align:center;">Withdrawal Verification</h2>
        <p>You are requesting a withdrawal from your TradeX account.</p>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;text-align:center;letter-spacing:6px;padding:20px;background:#eff6ff;border-radius:8px;color:#2563eb;">
          {otp}
        </div>
        <p style="margin-top:20px;">This OTP will expire in 5 minutes.</p>
        <p>If you did not request this, please secure your account immediately.</p>
        <hr>
        <p style="text-align:center;color:#666;">TradeX Team</p>
      </div>
    </body>
    </html>
    """
    _send_html_email(receiver_email, "TradeX Withdrawal OTP Verification", body)

def send_withdrawal_processed_admin_notification(
    admin_email: str,
    withdrawal_id: int,
    user_email: str,
    amount: float
):
    subject = f"Withdrawal Processed - ID: {withdrawal_id}"
    html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f6f9;padding:20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;">
    <div style="background:#0f172a;color:white;padding:20px;text-align:center;">
        <h1>Withdrawal Processed</h1>
    </div>
    <div style="padding:25px;">
        <h2 style="color:#0f172a;">Hello Admin,</h2>
        <p style="font-size:16px;color:#475569;">You have successfully processed a withdrawal request.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:12px;margin-top:15px;">
        <p style="margin:8px 0;color:#0f172a;"><strong>Withdrawal ID:</strong> {withdrawal_id}</p>
        <p style="margin:8px 0;color:#0f172a;"><strong>User Email:</strong> {user_email}</p>
        <p style="margin:8px 0;color:#0f172a;"><strong>Amount:</strong> ₹{amount:,.2f}</p>
        </div>
        <p style="margin-top:20px;">The funds will be transferred to the user's account according to their bank details.</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #e2e8f0;">
        <p style="text-align:center;color:#64748b;font-size:14px;margin-top:20px;">TradeX System</p>
    </div>
    </div>
    </body>
    </html>
    """
    _send_html_email(admin_email, subject, html)

def send_withdrawal_rejected_email(
    recipient_email: str,
    username: str,
    amount: float
):
    subject = "TradeX Withdrawal Rejected"
    html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f6f9;padding:20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;">
    <div style="background:#ef4444;color:white;padding:20px;text-align:center;">
        <h1>Withdrawal Rejected</h1>
    </div>
    <div style="padding:25px;">
        <h2 style="color:#0f172a;">Hello {username} 👋,</h2>
        <div style="background:#fef2f2;border:1px solid #fca5a5;padding:20px;border-radius:12px;margin-top:15px;">
        <p style="margin:0;font-size:18px;">❌ Your withdrawal request for ₹{amount:,.2f} was rejected.</p>
        </div>
        <p style="margin-top:20px;">The amount has been credited back to your TradeX wallet balance.</p>
        <p>If you have any questions, please contact support.</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #e2e8f0;">
        <p style="text-align:center;color:#64748b;font-size:14px;margin-top:20px;">TradeX Team</p>
    </div>
    </div>
    </body>
    </html>
    """
    _send_html_email(recipient_email, subject, html)


def _send_html_email(to_email: str, subject: str, body: str, reply_to: str | None = None):
    if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
        raise RuntimeError(
            "Email credentials are not configured. "
            "Set EMAIL_ADDRESS and EMAIL_PASSWORD in backend/.env."
        )

    msg = MIMEText(body, "html")
    msg["Subject"] = subject
    msg["From"] = EMAIL_ADDRESS
    msg["To"] = to_email

    if reply_to:
        msg["Reply-To"] = reply_to

    last_error = None
    attempts = [
        ("smtp.gmail.com", 587, False),
        ("smtp.gmail.com", 465, True),
    ]

    for host, port, use_ssl in attempts:
        server = None
        try:
            if use_ssl:
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(host, port, context=context, timeout=20)
            else:
                server = smtplib.SMTP(host, port, timeout=20)
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()

            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, to_email, msg.as_string())
            return
        except Exception as exc:
            last_error = exc
        finally:
            if server is not None:
                try:
                    server.quit()
                except Exception:
                    pass

    raise RuntimeError(
        f"Unable to send email to {to_email}. "
        f"Last SMTP error: {last_error}"
    ) from last_error


def send_deposit_approval_email(
    user_email: str,
    amount: float,
    utr_number: str,
    deposit_id: int,
):
    approve_token = create_deposit_action_token(deposit_id, "approve")
    reject_token = create_deposit_action_token(deposit_id, "reject")

    approve_link = f"{API_BASE_URL}/admin/deposits/email/approve?token={approve_token}"
    reject_link = f"{API_BASE_URL}/admin/deposits/email/reject?token={reject_token}"

    body = f"""
    <html>
    <body style="margin:0;font-family:Arial,sans-serif;background:#f5f7fa;padding:24px;">
      <div style="max-width:640px;margin:auto;background:white;border-radius:16px;padding:28px 30px;box-shadow:0 8px 28px rgba(15,23,42,.12);border:1px solid #e5e7eb;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:34px;font-weight:800;color:#2563eb;letter-spacing:.4px;">TradeX</div>
          <div style="margin-top:6px;font-size:14px;color:#64748b;">Deposit verification request</div>
        </div>

        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin-bottom:22px;">
          <div style="font-size:18px;font-weight:700;color:#1d4ed8;margin-bottom:10px;">Pending deposit details</div>
          <p style="margin:8px 0;color:#0f172a;"><strong>User email:</strong> {user_email}</p>
          <p style="margin:8px 0;color:#0f172a;"><strong>Amount:</strong> Rs. {amount}</p>
          <p style="margin:8px 0;color:#0f172a;"><strong>UTR:</strong> {utr_number}</p>
          <p style="margin:8px 0;color:#0f172a;"><strong>Deposit ID:</strong> {deposit_id}</p>
        </div>

        <p style="margin:0 0 18px;color:#334155;line-height:1.6;">
          The user submitted this deposit from the app. You can review it in the admin panel or use the approval links below to handle it from mail.
        </p>

        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:22px 0 18px;">
          <a href="{approve_link}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;">Approve Deposit</a>
          <a href="{reject_link}" style="display:inline-block;background:#ef4444;color:white;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;">Reject Deposit</a>
          <a href="{APP_BASE_URL}/admin" style="display:inline-block;background:#e2e8f0;color:#0f172a;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;">Open Admin Panel</a>
        </div>

        <div style="font-size:13px;color:#64748b;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:16px;">
          Replying to this mail will go to the user's email address: <strong>{user_email}</strong>
        </div>

        <p style="margin-top:18px;text-align:center;color:#64748b;font-size:13px;">TradeX Team</p>
      </div>
    </body>
    </html>
    """

    _send_html_email(
        APPROVAL_EMAIL,
        "TradeX Deposit Verification Request",
        body,
        reply_to=user_email,
    )


def send_otp_email(receiver_email, otp):
    body = f"""
    <html>
    <body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:20px;">
      <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:30px;box-shadow:0 4px 12px rgba(0,0,0,.1);">
        <h1 style="color:#2563eb;text-align:center;">TradeX</h1>
        <h2 style="text-align:center;">Email Verification</h2>
        <p>Thank you for creating your TradeX account.</p>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;text-align:center;letter-spacing:6px;padding:20px;background:#eff6ff;border-radius:8px;color:#2563eb;">
          {otp}
        </div>
        <p style="margin-top:20px;">This OTP will expire in 5 minutes.</p>
        <p>If you did not request this email, please ignore it.</p>
        <hr>
        <p style="text-align:center;color:#666;">TradeX Team</p>
      </div>
    </body>
    </html>
    """

    _send_html_email(receiver_email, "TradeX OTP Verification", body)


def send_admin_registration_otp_email(receiver_email, user_email, otp):
    body = f"""
    <html>
    <body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:20px;">
      <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:30px;box-shadow:0 4px 12px rgba(0,0,0,.1);">
        <h1 style="color:#2563eb;text-align:center;">TradeX</h1>
        <h2 style="text-align:center;">Administrator Registration Authorization</h2>
        <p>An administrator account registration has been requested for user: <strong>{user_email}</strong>.</p>
        <p>Please authorize this registration by providing the administrator verification code:</p>
        <div style="font-size:32px;font-weight:bold;text-align:center;letter-spacing:6px;padding:20px;background:#eff6ff;border-radius:8px;color:#2563eb;">
          {otp}
        </div>
        <p style="margin-top:20px;">This OTP will expire in 5 minutes.</p>
        <hr>
        <p style="text-align:center;color:#666;">TradeX Team</p>
      </div>
    </body>
    </html>
    """

    _send_html_email(receiver_email, "TradeX Administrator Authorization OTP", body)


def send_two_factor_otp_email(receiver_email, otp):
    body = f"""
    <html>
    <body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:20px;">
      <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:30px;box-shadow:0 4px 12px rgba(0,0,0,.1);">
        <h1 style="color:#2563eb;text-align:center;">TradeX</h1>
        <h2 style="text-align:center;">Two-Factor Authentication</h2>
        <p>You are enabling or signing in with Email OTP 2FA on your TradeX account.</p>
        <p>Your 2FA verification code is:</p>
        <div style="font-size:32px;font-weight:bold;text-align:center;letter-spacing:6px;padding:20px;background:#eff6ff;border-radius:8px;color:#2563eb;">
          {otp}
        </div>
        <p style="margin-top:20px;">This OTP will expire in 5 minutes.</p>
        <p>If you did not request this code, please secure your account immediately.</p>
        <hr>
        <p style="text-align:center;color:#666;">TradeX Team</p>
      </div>
    </body>
    </html>
    """

    _send_html_email(receiver_email, "TradeX 2FA Verification Code", body)


def send_password_reset_otp_email(receiver_email, otp, reset_link=None):
    reset_link_html = (
        f"""
        <p style="margin-top:24px;">You can also open the secure reset page directly:</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="{reset_link}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">
            Reset Password
          </a>
        </p>
        """
        if reset_link
        else ""
    )

    body = f"""
    <html>
    <body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:20px;">
      <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:30px;box-shadow:0 4px 12px rgba(0,0,0,.1);">
        <h1 style="color:#2563eb;text-align:center;">TradeX</h1>
        <h2 style="text-align:center;">Password Reset</h2>
        <p>Use this verification code to reset your TradeX password.</p>
        <div style="font-size:32px;font-weight:bold;text-align:center;letter-spacing:6px;padding:20px;background:#eff6ff;border-radius:8px;color:#2563eb;">
          {otp}
        </div>
        {reset_link_html}
        <p style="margin-top:20px;">This OTP will expire in 5 minutes.</p>
        <p>If you did not request this email, please ignore it.</p>
        <hr>
        <p style="text-align:center;color:#666;">TradeX Team</p>
      </div>
    </body>
    </html>
    """

    _send_html_email(receiver_email, "TradeX Password Reset Code", body)


def send_deposit_request_email(
    user_email: str,
    amount: float,
    utr_number: str,
    deposit_id: int,
):
    send_deposit_approval_email(user_email, amount, utr_number, deposit_id)

def send_deposit_approved_email(
    recipient_email: str,
    username: str,
    amount: float
):

    subject = (
        "TradeX Deposit Approved"
    )

    html = f"""
    <html>
    <body
    style="
    font-family:Arial;
    background:#f4f6f9;
    padding:20px;
    "
    >

    <div
    style="
    max-width:600px;
    margin:auto;
    background:white;
    border-radius:12px;
    overflow:hidden;
    "
    >

    <div
    style="
    background:#10b981;
    color:white;
    padding:20px;
    text-align:center;
    "
    >
        <h1>
        Deposit Approved
        </h1>
    </div>

    <div style="padding:25px;">

        <h2 style="color:#0f172a;">
            Hello {username} 👋,
        </h2>
        
        <p style="font-size:16px;color:#475569;">
            Thank you for using TradeX.
        </p>

        <div
        style="
        background:#ecfdf5;
        border:1px solid #86efac;
        padding:20px;
        border-radius:12px;
        margin-top:15px;
        "
        >
        
        <p style="margin:0;font-size:18px;">
        ✅ Your deposit request has been approved.
        </p>
        
        <p style="margin-top:12px;">
        <strong>
        Amount Added:
        ₹{amount:,.2f}
        </strong>
        </p>
        
        </div>
        
        <p style="margin-top:20px;">
        The funds are now available in your TradeX wallet.
        </p>
        
        <p>
        Happy Trading 🚀
        </p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #e2e8f0;">

        <p
        style="
        text-align:center;
        color:#64748b;
        font-size:14px;
        margin-top:20px;
        "
        >
        TradeX Team
        <br>
        Stock Trading Simulator
        </p>

    </div>

    </div>

    </body>
    </html>
    """

    _send_html_email(
        recipient_email,
        subject,
        html
    )

def send_auto_trade_email(
    recipient_email: str,
    username: str,
    stock_symbol: str,
    trade_type: str,
    quantity: int,
    price: float,
    reason: str
):
    subject = f"TradeX Auto Trade Executed: {stock_symbol}"
    
    color = "#10b981" if trade_type == "BUY" else "#ef4444"
    if "Take Profit" in reason: color = "#10b981"
    if "Stop Loss" in reason: color = "#ef4444"

    html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f6f9;padding:20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:{color};color:white;padding:20px;text-align:center;">
        <h1>Automatic Trade Executed</h1>
    </div>
    <div style="padding:25px;">
        <h2 style="color:#0f172a;">Hello {username} 👋,</h2>
        <p style="font-size:16px;color:#475569;">An automatic trade was executed on your account based on your preset conditions.</p>
        
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:12px;margin-top:15px;">
            <p style="margin:8px 0;color:#0f172a;"><strong>Stock:</strong> {stock_symbol}</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>Action:</strong> {trade_type}</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>Quantity:</strong> {quantity}</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>Price:</strong> ₹{price:,.2f}</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>Reason:</strong> {reason}</p>
        </div>
        
        <p style="margin-top:20px;">Your portfolio and balance have been updated accordingly.</p>
        <p>Happy Trading 🚀</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #e2e8f0;">
        <p style="text-align:center;color:#64748b;font-size:14px;margin-top:20px;">TradeX Team</p>
    </div>
    </div>
    </body>
    </html>
    """
    _send_html_email(recipient_email, subject, html)

def send_deposit_rejected_email(
    recipient_email: str,
    username: str,
    amount: float
):

    subject = (
        "TradeX Deposit Rejected"
    )

    html = f"""
    <html>
    <body
    style="
    font-family:Arial;
    background:#f4f6f9;
    padding:20px;
    "
    >

    <div
    style="
    max-width:600px;
    margin:auto;
    background:white;
    border-radius:12px;
    overflow:hidden;
    "
    >

    <div
    style="
    background:#ef4444;
    color:white;
    padding:20px;
    text-align:center;
    "
    >
        <h1>
        Deposit Rejected
        </h1>
    </div>

    <div style="padding:25px;">

        <h2 style="color:#0f172a;">
            Hello {username} 👋,
        </h2>
        
        <p style="font-size:16px;color:#475569;">
            Thank you for using TradeX.
        </p>

        <div
        style="
        background:#fef2f2;
        border:1px solid #fca5a5;
        padding:20px;
        border-radius:12px;
        margin-top:15px;
        "
        >
        
        <p style="margin:0;font-size:18px;">
        ❌ Your deposit request was rejected.
        </p>
        
        <p style="margin-top:12px;">
        <strong>
        Amount:
        ₹{amount:,.2f}
        </strong>
        </p>
        
        </div>
        
        <p style="margin-top:20px;">
        We could not verify the submitted payment details.
        </p>
        
        <p>
        Please verify your UTR number and submit a new deposit request.
        </p>

        <hr style="margin-top:30px;border:none;border-top:1px solid #e2e8f0;">

        <p
        style="
        text-align:center;
        color:#64748b;
        font-size:14px;
        margin-top:20px;
        "
        >
        TradeX Team
        <br>
        Stock Trading Simulator
        </p>

    </div>

    </div>

    </body>
    </html>
    """

    _send_html_email(
        recipient_email,
        subject,
        html
    )

def send_ticket_created_email(
    user_email: str,
    username: str,
    ticket_number: str,
    issue_type: str,
    ticket_id: int
):
    # Notify Admin
    progress_token = create_ticket_action_token(ticket_id, "progress")
    resolve_token = create_ticket_action_token(ticket_id, "resolve")
    
    progress_link = f"{API_BASE_URL}/support/admin/tickets/email/progress?token={progress_token}"
    resolve_link = f"{API_BASE_URL}/support/admin/tickets/email/resolve-form?token={resolve_token}"

    admin_subject = f"New Support Ticket: {ticket_number}"
    admin_html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f6f9;padding:20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#2563eb;color:white;padding:20px;text-align:center;">
        <h1>New Support Ticket</h1>
    </div>
    <div style="padding:25px;">
        <h2 style="color:#0f172a;">Hello Admin,</h2>
        <p style="font-size:16px;color:#475569;">A new support ticket has been raised by a user.</p>
        
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:12px;margin-top:15px;">
            <p style="margin:8px 0;color:#0f172a;"><strong>Ticket #:</strong> {ticket_number}</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>User:</strong> {username} ({user_email})</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>Issue Type:</strong> {issue_type}</p>
        </div>
        
        <p style="margin-top:20px;">You can review this ticket in the Admin Panel or take action directly below:</p>
        
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:22px 0 18px;justify-content:center;">
          <a href="{progress_link}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;">Progress Ticket</a>
          <a href="{resolve_link}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;">Resolve Ticket</a>
          <a href="{APP_BASE_URL}/admin" style="display:inline-block;background:#e2e8f0;color:#0f172a;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;">Admin Panel</a>
        </div>

        <hr style="margin-top:30px;border:none;border-top:1px solid #e2e8f0;">
        <p style="text-align:center;color:#64748b;font-size:14px;margin-top:20px;">TradeX System</p>
    </div>
    </div>
    </body>
    </html>
    """
    _send_html_email(APPROVAL_EMAIL, admin_subject, admin_html)

    # Notify User
    user_subject = f"Ticket Received: {ticket_number}"
    user_html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f6f9;padding:20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#2563eb;color:white;padding:20px;text-align:center;">
        <h1>Ticket Received</h1>
    </div>
    <div style="padding:25px;">
        <h2 style="color:#0f172a;">Hello {username} 👋,</h2>
        <p style="font-size:16px;color:#475569;">We have received your support ticket and our team is looking into it.</p>
        
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:12px;margin-top:15px;">
            <p style="margin:8px 0;color:#0f172a;"><strong>Ticket #:</strong> {ticket_number}</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>Issue Type:</strong> {issue_type}</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>Status:</strong> OPEN</p>
        </div>
        
        <p style="margin-top:20px;">We will notify you once there is an update on your request.</p>
        <p>Thank you for your patience.</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #e2e8f0;">
        <p style="text-align:center;color:#64748b;font-size:14px;margin-top:20px;">TradeX Team</p>
    </div>
    </div>
    </body>
    </html>
    """
    _send_html_email(user_email, user_subject, user_html)

def send_ticket_resolved_email(
    user_email: str,
    username: str,
    ticket_number: str,
    resolution: str
):
    subject = f"Ticket Resolved: {ticket_number}"
    html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f6f9;padding:20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#10b981;color:white;padding:20px;text-align:center;">
        <h1>Ticket Resolved</h1>
    </div>
    <div style="padding:25px;">
        <h2 style="color:#0f172a;">Hello {username} 👋,</h2>
        <p style="font-size:16px;color:#475569;">Your support ticket has been resolved.</p>
        
        <div style="background:#ecfdf5;border:1px solid #86efac;padding:20px;border-radius:12px;margin-top:15px;">
            <p style="margin:8px 0;color:#0f172a;"><strong>Ticket #:</strong> {ticket_number}</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>Resolution:</strong> {resolution}</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>Status:</strong> RESOLVED</p>
        </div>
        
        <p style="margin-top:20px;">If you have any further questions, feel free to contact us.</p>
        <p>Happy Trading 🚀</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #e2e8f0;">
        <p style="text-align:center;color:#64748b;font-size:14px;margin-top:20px;">TradeX Team</p>
    </div>
    </div>
    </body>
    </html>
    """
    _send_html_email(user_email, subject, html)

def send_chat_message_to_admin(user_id: int, user_email: str, message: str):
    token = create_chat_action_token(user_id)
    reply_link = f"{API_BASE_URL}/support/chat/email/reply-form?token={token}"
    
    subject = f"New Support Chat from {user_email}"
    html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f6f9;padding:20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#2563eb;color:white;padding:20px;text-align:center;">
        <h1>New Chat Message</h1>
    </div>
    <div style="padding:25px;">
        <p style="font-size:16px;color:#475569;"><strong>{user_email}</strong> sent a new message in the support chat:</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:12px;margin-top:15px;white-space:pre-wrap;">
            {message}
        </div>
        <p style="margin-top:20px;">You can reply to this message directly in the TradeX Chat by clicking the button below:</p>
        <div style="text-align:center;margin-top:20px;">
            <a href="{reply_link}" style="display:inline-block;background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Reply in TradeX Chat</a>
        </div>
    </div>
    </div>
    </body>
    </html>
    """
    _send_html_email(APPROVAL_EMAIL, subject, html, reply_to=user_email)

def send_chat_message_to_user(user_email: str, message: str):
    subject = "New Reply from TradeX Support"
    html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f6f9;padding:20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#10b981;color:white;padding:20px;text-align:center;">
        <h1>Support Reply</h1>
    </div>
    <div style="padding:25px;">
        <p style="font-size:16px;color:#475569;">TradeX Support has replied to your chat:</p>
        <div style="background:#ecfdf5;border:1px solid #86efac;padding:20px;border-radius:12px;margin-top:15px;white-space:pre-wrap;">
            {message}
        </div>
        <p style="margin-top:20px;">Log in to TradeX to continue the chat, or reply to this email to reach support.</p>
    </div>
    </div>
    </body>
    </html>
    """
    _send_html_email(user_email, subject, html, reply_to=APPROVAL_EMAIL)


def send_price_alert_email(
    recipient_email: str,
    username: str,
    symbol: str,
    current_price: float,
    condition: str
):
    subject = "TradeX Price Alert"
    html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f6f9;padding:20px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#ef4444;color:white;padding:20px;text-align:center;">
        <h1>Price Alert Triggered</h1>
    </div>
    <div style="padding:25px;">
        <h2 style="color:#0f172a;">Hello {username},</h2>
        <p style="font-size:16px;color:#475569;">Your TradeX price alert has been triggered.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;padding:20px;border-radius:12px;margin-top:15px;">
            <p style="margin:8px 0;color:#0f172a;"><strong>Stock:</strong> {symbol}</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>Alert:</strong> {condition}</p>
            <p style="margin:8px 0;color:#0f172a;"><strong>Current Price:</strong> Rs. {current_price}</p>
        </div>
        <p style="margin-top:20px;">Open TradeX to review the stock before taking action.</p>
        <p style="text-align:center;color:#64748b;font-size:14px;margin-top:20px;">TradeX Team</p>
    </div>
    </div>
    </body>
    </html>
    """
    _send_html_email(recipient_email, subject, html)


def send_maintenance_mode_email(is_on: bool):
    from app.core.database import SessionLocal
    from app.models.system_setting import SystemSetting
    
    db = SessionLocal()
    try:
        # Load SMTP settings dynamically from DB
        sender = db.query(SystemSetting).filter(SystemSetting.key == "email_sender").first()
        server_host = db.query(SystemSetting).filter(SystemSetting.key == "smtp_server").first()
        port_num = db.query(SystemSetting).filter(SystemSetting.key == "smtp_port").first()
        user_name = db.query(SystemSetting).filter(SystemSetting.key == "smtp_username").first()
        password_val = db.query(SystemSetting).filter(SystemSetting.key == "smtp_password").first()
        
        from_email = sender.value if (sender and sender.value) else "tradex.adminn@gmail.com"
        if is_on:
            from_email = "tradex.support@gmail.com"
            
        smtp_host = server_host.value if (server_host and server_host.value) else "smtp.gmail.com"
        smtp_port = int(port_num.value) if (port_num and port_num.value) else 587
        smtp_user = user_name.value if (user_name and user_name.value) else "tradex.adminn@gmail.com"
        smtp_pass = password_val.value if (password_val and password_val.value) else ""
        
        if not smtp_pass or smtp_pass in ["your-smtp-password", "********"]:
            smtp_user = EMAIL_ADDRESS or "tradex.support@gmail.com"
            smtp_pass = EMAIL_PASSWORD or ""
            smtp_host = "smtp.gmail.com"
            smtp_port = 587
            
        status_text = "ACTIVATED" if is_on else "DEACTIVATED"
        subject = f"TradeX Alert: Maintenance Mode {status_text}"
        
        button_html = ""
        if is_on:
            token = create_maintenance_action_token("deactivate")
            deactivate_link = f"{API_BASE_URL}/admin/maintenance/email/deactivate?token={token}"
            button_html = f"""
            <div style="text-align:center;margin:30px 0;">
              <a href="{deactivate_link}" style="background-color:#ef4444;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;box-shadow:0 4px 12px rgba(239,68,68,0.25);">Turn Off Maintenance Mode</a>
            </div>
            """

        body = f"""
        <html>
        <body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:20px;">
          <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:30px;box-shadow:0 4px 12px rgba(0,0,0,.1);">
            <h1 style="color:#f43f5e;text-align:center;">TradeX System Alert</h1>
            <h2 style="text-align:center;color:#333;">Maintenance Mode {status_text}</h2>
            <p>Hello Administrator,</p>
            <p>This is to notify you that Maintenance Mode has been successfully <strong>{status_text.lower()}</strong> in the TradeX Admin Settings.</p>
            <p><strong>Status:</strong> {status_text}</p>
            <p><strong>Timestamp:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
            {button_html}
            <hr>
            <p style="text-align:center;color:#666;">TradeX Admin Notification Services</p>
          </div>
        </body>
        </html>
        """
        
        msg = MIMEText(body, "html")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = "tradex.adminn@gmail.com"
        
        # Connect and send
        import smtplib
        import ssl
        
        context = ssl.create_default_context()
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=20)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=20)
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            
        if smtp_user and smtp_pass and smtp_pass != "********":
            server.login(smtp_user, smtp_pass)
            
        server.sendmail(from_email, "tradex.adminn@gmail.com", msg.as_string())
        server.quit()
        print("Maintenance Mode email notification sent to tradex.adminn@gmail.com successfully.")
    except Exception as e:
        print(f"Failed to send maintenance mode email notification: {e}")
    finally:
        db.close()
