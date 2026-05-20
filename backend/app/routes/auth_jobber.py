import os
import time
from urllib.parse import urlencode

import requests as http
from flask import Blueprint, jsonify, redirect, request

from app.db import SessionLocal
from app.models_tokens import JobberToken
from .auth import _admin_token, require_admin

auth_jobber_bp = Blueprint("auth_jobber", __name__)

_JOBBER_AUTH_URL = "https://api.getjobber.com/api/oauth/authorize"
_TOKEN_URL = "https://api.getjobber.com/api/oauth/token"


def _app_url() -> str:
    return os.environ.get("APP_URL", "http://localhost:8000").rstrip("/")


def _frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def _redirect_uri() -> str:
    return f"{_app_url()}/auth/callback"


@auth_jobber_bp.get("/auth/jobber")
def start_auth():
    """Browser-navigable redirect — accepts admin token as query param."""
    token = request.args.get("token", "")
    if token != _admin_token():
        return jsonify({"error": "Unauthorized"}), 401

    params = urlencode({
        "client_id": os.environ["JOBBER_CLIENT_ID"],
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": "read write",
    })
    return redirect(f"{_JOBBER_AUTH_URL}?{params}")


@auth_jobber_bp.get("/auth/callback")
def callback():
    error = request.args.get("error")
    if error:
        return f"Jobber OAuth error: {error}", 400

    code = request.args.get("code")
    if not code:
        return "No code received from Jobber", 400

    r = http.post(_TOKEN_URL, data={
        "client_id": os.environ["JOBBER_CLIENT_ID"],
        "client_secret": os.environ["JOBBER_CLIENT_SECRET"],
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": _redirect_uri(),
    }, timeout=30)

    if r.status_code != 200:
        return f"Token exchange failed ({r.status_code}): {r.text}", 500

    tokens = r.json()
    access = tokens.get("access_token")
    refresh = tokens.get("refresh_token")
    if not access or not refresh:
        return "Missing tokens in Jobber response", 500

    expires_at = time.time() + tokens.get("expires_in", 3600)

    with SessionLocal() as s:
        row = s.query(JobberToken).order_by(JobberToken.id.desc()).first()
        if row:
            row.access_token = access
            row.refresh_token = refresh
            row.expires_at = expires_at
        else:
            s.add(JobberToken(access_token=access, refresh_token=refresh, expires_at=expires_at))
        s.commit()

    return redirect(f"{_frontend_url()}/admin")


@auth_jobber_bp.get("/api/admin/jobber-status")
@require_admin
def jobber_status():
    with SessionLocal() as s:
        row = s.query(JobberToken).order_by(JobberToken.id.desc()).first()
    if not row:
        return jsonify({"status": "not_connected"})
    if time.time() > row.expires_at - 60:
        return jsonify({"status": "expired", "expires_at": row.expires_at})
    return jsonify({"status": "connected", "expires_at": row.expires_at})
