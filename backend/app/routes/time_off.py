from __future__ import annotations
import logging
from datetime import date as date_type, timedelta
from flask import Blueprint, jsonify, request
from sqlalchemy import or_, and_
from app.db import SessionLocal
from app.models import TimeOffRequest, Worker
from app.email_service import send_time_off_notification, send_test_email
from app.jobber_gql import jobber_gql
from .auth import require_admin

log = logging.getLogger(__name__)

time_off_bp = Blueprint("time_off", __name__)

_TASK_MUTATION = """
mutation CreateTask($input: TaskCreateInput!) {
  taskCreate(input: $input) {
    task { id title }
    userErrors { message path }
  }
}
"""

_TYPE_LABELS = {
    "full_day": "TIME OFF",
    "late_arrival": "LATE ARRIVAL",
    "early_departure": "EARLY DEPARTURE",
}


def _build_task_title(req: TimeOffRequest, for_date: date_type | None = None) -> str:
    label = _TYPE_LABELS.get(req.request_type, "TIME OFF")
    date_str = str(for_date) if for_date else str(req.request_date)
    title = f"{label} – {req.worker_name} – {date_str}"
    if req.request_type == "late_arrival" and req.time_from:
        title += f" (not in until {req.time_from})"
    elif req.request_type == "early_departure" and req.time_to:
        title += f" (leaving by {req.time_to})"
    return title


def _create_single_task(req: TimeOffRequest, jobber_user_id: str, for_date: date_type) -> str | None:
    date_str = str(for_date)
    try:
        result = jobber_gql(_TASK_MUTATION, {"input": {
            "title": _build_task_title(req, for_date),
            "assignedTo": [jobber_user_id],
            "allDay": True,
            "startAt": date_str + "T00:00:00Z",
            "endAt": date_str + "T23:59:59Z",
            "instructions": req.notes or "",
        }})
        task = result.get("data", {}).get("taskCreate", {})
        errors = task.get("userErrors") or []
        if errors:
            log.warning("Jobber task errors for request %d on %s: %s", req.id, date_str, errors)
            return None
        return (task.get("task") or {}).get("id")
    except Exception as exc:
        log.exception("Failed to create Jobber task for request %d on %s: %s", req.id, date_str, exc)
        return None


def _create_jobber_tasks(req: TimeOffRequest, jobber_user_id: str) -> str | None:
    """Create one task per day in the request range. Returns a summary string."""
    start = req.request_date
    end = req.request_date_to if req.request_date_to else start

    dates = []
    d = start
    while d <= end:
        dates.append(d)
        d += timedelta(days=1)

    first_id = None
    created = 0
    for d in dates:
        task_id = _create_single_task(req, jobber_user_id, d)
        if task_id:
            created += 1
            if first_id is None:
                first_id = task_id

    if created == 0:
        return None
    if created == 1:
        return first_id
    return f"{created} tasks"


@time_off_bp.post("/api/time-off-requests")
def submit_request():
    body = request.get_json(silent=True) or {}
    required = ("worker_id", "request_type", "request_date")
    if any(not body.get(k) for k in required):
        return jsonify({"error": f"Required fields: {', '.join(required)}"}), 400
    if body["request_type"] not in ("full_day", "late_arrival", "early_departure"):
        return jsonify({"error": "Invalid request_type"}), 400

    with SessionLocal() as s:
        worker = s.query(Worker).filter_by(id=body["worker_id"]).first()
        if not worker:
            return jsonify({"error": "Worker not found"}), 404

        req = TimeOffRequest(
            worker_id=worker.id,
            worker_name=worker.name,
            request_type=body["request_type"],
            request_date=body["request_date"],
            request_date_to=body.get("request_date_to") or None,
            time_from=body.get("time_from") or None,
            time_to=body.get("time_to") or None,
            notes=body.get("notes") or None,
            status="pending",
        )
        s.add(req)
        s.commit()

        send_time_off_notification({
            "worker_name": worker.name,
            "request_type": body["request_type"],
            "request_date": body["request_date"],
            "request_date_to": body.get("request_date_to"),
            "time_from": body.get("time_from"),
            "time_to": body.get("time_to"),
            "notes": body.get("notes"),
        })

        return jsonify({"id": req.id, "ok": True}), 201


@time_off_bp.get("/api/time-off-requests")
@require_admin
def list_requests():
    status = request.args.get("status")
    date_filter = request.args.get("date")

    with SessionLocal() as s:
        q = s.query(TimeOffRequest)
        if status:
            q = q.filter_by(status=status)
        if date_filter:
            # Include single-day requests matching the date, and range requests that span it
            q = q.filter(or_(
                and_(TimeOffRequest.request_date_to == None,
                     TimeOffRequest.request_date == date_filter),
                and_(TimeOffRequest.request_date_to != None,
                     TimeOffRequest.request_date <= date_filter,
                     TimeOffRequest.request_date_to >= date_filter),
            ))
        rows = q.all()
        rows = sorted(rows, key=lambda r: (0 if r.status == "pending" else 1, r.request_date))
        return jsonify([_serialize(r) for r in rows])


@time_off_bp.post("/api/time-off-requests/<int:rid>/approve")
@require_admin
def approve_request(rid):
    body = request.get_json(silent=True) or {}
    with SessionLocal() as s:
        req = s.query(TimeOffRequest).filter_by(id=rid).first()
        if not req:
            return jsonify({"error": "not found"}), 404
        if req.status != "pending":
            return jsonify({"error": "already actioned"}), 400

        req.status = "approved"
        req.admin_note = body.get("admin_note") or None

        worker = s.query(Worker).filter_by(id=req.worker_id).first()
        jobber_task_id = None
        jobber_warning = None
        if worker and worker.jobber_user_id:
            jobber_task_id = _create_jobber_tasks(req, worker.jobber_user_id)
            if not jobber_task_id:
                jobber_warning = "Approved, but Jobber task(s) could not be created."
        else:
            jobber_warning = "Approved. Worker has no Jobber user ID — task not created."

        req.jobber_task_id = jobber_task_id
        s.commit()

        resp = _serialize(req)
        if jobber_warning:
            resp["warning"] = jobber_warning
        return jsonify(resp)


@time_off_bp.post("/api/time-off-requests/<int:rid>/deny")
@require_admin
def deny_request(rid):
    body = request.get_json(silent=True) or {}
    with SessionLocal() as s:
        req = s.query(TimeOffRequest).filter_by(id=rid).first()
        if not req:
            return jsonify({"error": "not found"}), 404
        if req.status != "pending":
            return jsonify({"error": "already actioned"}), 400
        req.status = "denied"
        req.admin_note = body.get("admin_note") or None
        s.commit()
        return jsonify(_serialize(req))


@time_off_bp.post("/api/admin/test-email")
@require_admin
def test_email():
    body = request.get_json(silent=True) or {}
    to = body.get("to") or __import__("os").environ.get("ADMIN_EMAIL", "")
    if not to:
        return jsonify({"error": "No recipient — pass {\"to\": \"email\"} or set ADMIN_EMAIL"}), 400
    ok, msg = send_test_email(to)
    if ok:
        return jsonify({"ok": True, "message": f"Test email sent to {to}"})
    return jsonify({"ok": False, "error": msg}), 500


def _serialize(r: TimeOffRequest) -> dict:
    return {
        "id": r.id,
        "worker_id": r.worker_id,
        "worker_name": r.worker_name,
        "request_type": r.request_type,
        "request_date": str(r.request_date),
        "request_date_to": str(r.request_date_to) if r.request_date_to else None,
        "time_from": r.time_from,
        "time_to": r.time_to,
        "notes": r.notes,
        "status": r.status,
        "jobber_task_id": r.jobber_task_id,
        "admin_note": r.admin_note,
        "created_at": str(r.created_at),
    }
