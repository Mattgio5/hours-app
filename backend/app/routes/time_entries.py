from flask import Blueprint, jsonify, request
from app.db import SessionLocal
from app.models import TimeEntry, Worker
from .auth import require_admin

time_entries_bp = Blueprint("time_entries", __name__)


@time_entries_bp.post("/api/time-entries")
def submit_entry():
    body = request.get_json(silent=True) or {}
    required = ("worker_id", "entry_date", "start_time", "end_time")
    if any(not body.get(k) for k in required):
        return jsonify({"error": f"Required fields: {', '.join(required)}"}), 400

    with SessionLocal() as s:
        worker = s.query(Worker).filter_by(id=body["worker_id"]).first()
        if not worker:
            return jsonify({"error": "Worker not found"}), 404
        entry = TimeEntry(
            worker_id=worker.id,
            worker_name=worker.name,
            entry_date=body["entry_date"],
            start_time=body["start_time"],
            end_time=body["end_time"],
            notes=body.get("notes") or None,
        )
        s.add(entry)
        s.commit()
        return jsonify({"id": entry.id, "ok": True}), 201


@time_entries_bp.get("/api/time-entries")
@require_admin
def list_entries():
    worker_id = request.args.get("worker_id")
    date_from = request.args.get("from")
    date_to = request.args.get("to")
    with SessionLocal() as s:
        q = s.query(TimeEntry)
        if worker_id:
            q = q.filter_by(worker_id=int(worker_id))
        if date_from:
            q = q.filter(TimeEntry.entry_date >= date_from)
        if date_to:
            q = q.filter(TimeEntry.entry_date <= date_to)
        rows = q.order_by(TimeEntry.entry_date.desc(), TimeEntry.created_at.desc()).all()
        return jsonify([{
            "id": e.id,
            "worker_id": e.worker_id,
            "worker_name": e.worker_name,
            "entry_date": str(e.entry_date),
            "start_time": e.start_time,
            "end_time": e.end_time,
            "notes": e.notes,
            "created_at": str(e.created_at),
        } for e in rows])
