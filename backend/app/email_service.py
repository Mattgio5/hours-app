from __future__ import annotations
import logging
import os
import requests

log = logging.getLogger(__name__)

_TYPE_LABELS = {
    "full_day": "Full Day Off",
    "late_arrival": "Late Arrival",
    "early_departure": "Early Departure",
}


def _cfg():
    return {
        "api_key": os.environ.get("RESEND_API_KEY", ""),
        "from_email": os.environ.get("EMAIL_FROM", ""),
        "admin_email": os.environ.get("ADMIN_EMAIL", ""),
        "app_url": os.environ.get("FRONTEND_URL", "http://localhost:5173"),
    }


def _send(cfg: dict, to: str, subject: str, html: str) -> tuple[bool, str]:
    if not cfg["api_key"]:
        return False, "RESEND_API_KEY not set"
    if not cfg["from_email"]:
        return False, "EMAIL_FROM not set"
    if not to:
        return False, "Recipient address is empty"
    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"},
            json={"from": cfg["from_email"], "to": [to], "subject": subject, "html": html},
            timeout=15,
        )
        if resp.status_code >= 400:
            msg = f"Resend error {resp.status_code}: {resp.text}"
            log.error(msg)
            return False, msg
        return True, "ok"
    except Exception as exc:
        log.exception("Failed to send email: %s", exc)
        return False, str(exc)


def send_time_off_notification(req: dict) -> bool:
    cfg = _cfg()
    if not cfg["admin_email"]:
        log.warning("ADMIN_EMAIL not set — skipping notification")
        return False

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
      <a href="{cfg['app_url']}/admin" style="
        background:#2563eb;color:#fff;padding:10px 20px;
        border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px
      ">Review in Admin Dashboard</a>
    </p>
    """

    ok, err = _send(cfg, cfg["admin_email"],
                    f"Time Off Request – {worker} – {date_str}", html)
    if not ok:
        log.error("Notification failed: %s", err)
    return ok


def send_test_email(to: str) -> tuple[bool, str]:
    cfg = _cfg()
    return _send(cfg, to, "Hours App — test email",
                 "<p>If you received this, email is configured correctly.</p>")
