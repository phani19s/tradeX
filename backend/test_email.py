from app.core.email import send_otp_email

send_otp_email(
    "tradex.adminn@gmail.com",
    "123456"
)

print("EMAIL SENT")