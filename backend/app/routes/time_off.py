from __future__ import annotations
import logging
from flask import Blueprint, jsonify, request
from app.db import SessionLocal
from app.models import TimeOffRequest, Worker
from app.email_service import send_time_off_notification
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


def _build_task_title(req: TimeOffRequest) -> str:
    label = _TYPE_LABELS.get(req.request_type, "TIME OFF")
    date_str = str(req.request_date)
    title = f"{label} – {req.worker_name} – {date_str}"
    if req.request_type == "late_arrival" and req.time_from:
        title += f" (not in until {req.time_from})"
    elif req.request_type == "early_departure" and req.time_to:
        title += f" (leaving by {req.time_to})"
    return title


def _create_jobber_task(req: TimeOffRequest, jobber_user_id: str) -> str | None:
    date_str = str(req.request_date)
    try:
        result = jobber_gql(_TASK_MUTATION, {"input": {
            "title": _build_task_title(req),
            "assignedTo": [jobber_user_id],
            "allDay": True,
            "startAt": date_str + "T00:00:00Z",
            "endAt": date_str + "T23:59:59Z",
            "instructions": req.notes or "",
        }})
        task = result.get("data", {}).get("taskCreate", {})
        errors = task.get("userErrors") or []
        if errors:
            log.warning("Jobber task errors for request %d: %s", req.id, errors)
            return None
        return (task.get("task") or {}).get("id")
    except Exception as exc:
        log.exception("Failed to create Jobber task for request %d: %s", req.id, exc)
        return None


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
            "time_from": body.get("time_from"),
            "time_to": body.get("time_to"),
            "notes": body.get("notes"),
        })

        return jsonify({"id": req.id, "ok": True}), 201


@time_off_bp.get("/api/time-off-requests")
@require_admin
def list_requests():
    status = request.args.get("status")
    with SessionLocal() as s:
        q = s.query(TimeOffRequest)
        if status:
            q = q.filter_by(status=status)
        rows = q.order_by(
            TimeOffRequest.status == "pending",  # pending first (False < True in SQL but we want True first)
            TimeOffRequest.request_date.desc(),
            TimeOffRequest.created_at.desc(),
        ).all()
        # re-sort in Python: pending first
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
            jobber_task_id = _create_jobber_task(req, worker.jobber_user_id)
            if not jobber_task_id:
                jobber_warning = "Approved, but Jobber task could not be created."
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


def _serialize(r: TimeOffRequest) -> dict:
    return {
        "id": r.id,
        "worker_id": r.worker_id,
        "worker_name": r.worker_name,
        "request_type": r.request_type,
        "request_date": str(r.request_date),
        "time_from": r.time_from,
        "time_to": r.time_to,
        "notes": r.notes,
        "status": r.status,
        "jobber_task_id": r.jobber_task_id,
        "admin_note": r.admin_note,
        "created_at": str(r.created_at),
    }
