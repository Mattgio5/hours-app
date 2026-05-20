from __future__ import annotations
import logging
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests

log = logging.getLogger(__name__)

_TYPE_LABELS = {
    "full_day": "Full Day Off",
    "late_arrival": "Late Arrival",
    "early_departure": "Early Departure",
}


def _send(to: str, subject: str, html: str) -> tuple[bool, str]:
    """Try Gmail SMTP first, fall back to Resend."""
    gmail_pw = os.environ.get("GMAIL_APP_PASSWORD", "")
    gmail_user = os.environ.get("GMAIL_USER", "matthewg0802@gmail.com")
    resend_key = os.environ.get("RESEND_API_KEY", "")
    from_email = os.environ.get("EMAIL_FROM", gmail_user)

    if not to:
        return False, "Recipient address is empty"

    if gmail_pw:
        return _send_gmail(gmail_user, gmail_pw, from_email, to, subject, html)

    if resend_key:
        return _send_resend(resend_key, from_email, to, subject, html)

    return False, "No email provider configured — set GMAIL_APP_PASSWORD or RESEND_API_KEY"


def _send_gmail(user: str, app_password: str, from_email: str, to: str,
                subject: str, html: str) -> tuple[bool, str]:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))

        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as server:
            server.login(user, app_password)
            server.sendmail(from_email, to, msg.as_string())
        return True, "ok"
    except Exception as exc:
        log.exception("Gmail SMTP error: %s", exc)
        return False, str(exc)


def _send_resend(api_key: str, from_email: str, to: str,
                 subject: str, html: str) -> tuple[bool, str]:
    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"from": from_email, "to": [to], "subject": subject, "html": html},
            timeout=15,
        )
        if resp.status_code >= 400:
            msg = f"Resend error {resp.status_code}: {resp.text}"
            log.error(msg)
            return False, msg
        return True, "ok"
    except Exception as exc:
        log.exception("Resend error: %s", exc)
        return False, str(exc)


def send_time_off_notification(req: dict) -> bool:
    admin_email = os.environ.get("ADMIN_EMAIL", "matthewg0802@gmail.com")
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    rtype = _TYPE_LABELS.get(req["request_type"], req["request_type"])
    worker = req["worker_name"]
    date_str = req["request_date"]
    if req.get("request_date_to") and req["request_date_to"] != req["request_date"]:
        date_str = f"{req['request_date']} – {req['request_date_to']}"

    time_detail = ""
    if req.get("time_from"):
        time_detail = f"<br><strong>Not available until:</strong> {req['time_from']}"
    elif req.get("time_to"):
        time_detail = f"<br><strong>Needs to leave by:</strong> {req['time_to']}"

    notes_html = f"<br><strong>Notes:</strong> {req['notes']}" if req.get("notes") else ""

    html = f"""
    <h2>Time Off Request – {worker}</h2>
    <p>
      <strong>Worker:</strong> {worker}<br>
      <strong>Type:</strong> {rtype}<br>
      <strong>Date:</strong> {date_str}
      {time_detail}
      {notes_html}
    </p>
    <p>
      <a href="{frontend_url}/admin" style="
        background:#2563eb;color:#fff;padding:10px 20px;
        border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px
      ">Review in Admin Dashboard</a>
    </p>
    """

    ok, err = _send(admin_email, f"Time Off Request – {worker} – {date_str}", html)
    if not ok:
        log.error("Notification failed: %s", err)
    return ok


def send_test_email(to: str) -> tuple[bool, str]:
    return _send(
        to,
        "Hours App — test email",
        "<p>If you received this, email is configured correctly.</p>",
    )
