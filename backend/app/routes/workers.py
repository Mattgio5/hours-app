from flask import Blueprint, jsonify, request
from app.db import SessionLocal
from app.models import Worker
from .auth import require_admin

workers_bp = Blueprint("workers", __name__)


@workers_bp.get("/api/workers")
def list_workers():
    with SessionLocal() as s:
        rows = s.query(Worker).order_by(Worker.name).all()
        return jsonify([{"id": w.id, "name": w.name, "jobber_user_id": w.jobber_user_id} for w in rows])


@workers_bp.post("/api/workers")
@require_admin
def create_worker():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    w = Worker(name=name, jobber_user_id=body.get("jobber_user_id") or None)
    with SessionLocal() as s:
        s.add(w)
        s.commit()
        return jsonify({"id": w.id, "name": w.name, "jobber_user_id": w.jobber_user_id}), 201


@workers_bp.put("/api/workers/<int:wid>")
@require_admin
def update_worker(wid):
    body = request.get_json(silent=True) or {}
    with SessionLocal() as s:
        w = s.query(Worker).filter_by(id=wid).first()
        if not w:
            return jsonify({"error": "not found"}), 404
        if "name" in body:
            w.name = (body["name"] or "").strip() or w.name
        if "jobber_user_id" in body:
            w.jobber_user_id = body["jobber_user_id"] or None
        s.commit()
        return jsonify({"id": w.id, "name": w.name, "jobber_user_id": w.jobber_user_id})


@workers_bp.delete("/api/workers/<int:wid>")
@require_admin
def delete_worker(wid):
    with SessionLocal() as s:
        w = s.query(Worker).filter_by(id=wid).first()
        if not w:
            return jsonify({"error": "not found"}), 404
        s.delete(w)
        s.commit()
        return jsonify({"ok": True})
