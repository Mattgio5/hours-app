from __future__ import annotations
import logging
import os
import requests

log = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("EMAIL_FROM", "noreply@yourdomain.com")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
APP_URL = os.environ.get("APP_URL", "http://localhost:5173")

_TYPE_LABELS = {
    "full_day": "Full Day Off",
    "late_arrival": "Late Arrival",
    "early_departure": "Early Departure",
}


def send_time_off_notification(req: dict) -> bool:
    if not RESEND_API_KEY or not ADMIN_EMAIL:
        log.warning("Email not configured (RESEND_API_KEY or ADMIN_EMAIL missing)")
        return False

    rtype = _TYPE_LABELS.get(req["request_type"], req["request_type"])
    worker = req["worker_name"]
    date_str = req["request_date"]

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
      <a href="{APP_URL}/admin" style="
        background:#2563eb;color:#fff;padding:10px 20px;
        border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px
      ">Review in Admin Dashboard</a>
    </p>
    """

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={
                "from": FROM_EMAIL,
                "to": [ADMIN_EMAIL],
                "subject": f"Time Off Request – {worker} – {date_str}",
                "html": html,
            },
            timeout=15,
        )
        if resp.status_code >= 400:
            log.error("Resend error %s: %s", resp.status_code, resp.text)
            return False
        return True
    except Exception as exc:
        log.exception("Failed to send email: %s", exc)
        return False
