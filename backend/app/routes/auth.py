from __future__ import annotations
import hashlib
import os
from functools import wraps
from flask import request, jsonify


def _admin_token() -> str:
    pw = os.environ.get("ADMIN_PASSWORD", "")
    return hashlib.sha256(pw.encode()).hexdigest()


def require_admin(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer ") or auth[7:] != _admin_token():
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper


def bp_auth():
    from flask import Blueprint
    bp = Blueprint("auth", __name__)

    @bp.post("/api/admin/login")
    def login():
        body = request.get_json(silent=True) or {}
        pw = body.get("password", "")
        expected = os.environ.get("ADMIN_PASSWORD", "")
        if not expected or pw != expected:
            return jsonify({"error": "Invalid password"}), 401
        return jsonify({"token": _admin_token()})

    return bp
