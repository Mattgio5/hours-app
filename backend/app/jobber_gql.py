from __future__ import annotations
import os
import time
import requests as http
from app.db import SessionLocal
from app.models_tokens import JobberToken

JOBBER_API_URL = "https://api.getjobber.com/api/graphql"
JOBBER_GQL_VERSION = os.environ.get("JOBBER_GQL_VERSION", "2026-05-12")
TOKEN_URL = "https://api.getjobber.com/api/oauth/token"


def _get_token_row():
    with SessionLocal() as s:
        return s.query(JobberToken).order_by(JobberToken.id.desc()).first()


def _refresh(refresh_token: str) -> dict:
    resp = http.post(TOKEN_URL, data={
        "client_id": os.environ["JOBBER_CLIENT_ID"],
        "client_secret": os.environ["JOBBER_CLIENT_SECRET"],
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _get_access_token() -> str:
    row = _get_token_row()
    if not row:
        raise RuntimeError("No Jobber token in DB")
    if time.time() < row.expires_at - 60:
        return row.access_token
    payload = _refresh(row.refresh_token)
    new_access = payload["access_token"]
    new_refresh = payload.get("refresh_token", row.refresh_token)
    new_exp = time.time() + payload.get("expires_in", 3600)
    with SessionLocal() as s:
        r = s.query(JobberToken).filter_by(id=row.id).first()
        if r:
            r.access_token = new_access
            r.refresh_token = new_refresh
            r.expires_at = new_exp
            s.commit()
    return new_access


def jobber_gql(query: str, variables: dict | None = None) -> dict:
    token = _get_access_token()
    resp = http.post(
        JOBBER_API_URL,
        json={"query": query, "variables": variables or {}},
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Jobber-GraphQL-Version": JOBBER_GQL_VERSION,
        },
        timeout=30,
    )
    data = resp.json()
    if resp.status_code >= 400:
        raise RuntimeError(f"Jobber HTTP {resp.status_code}: {data}")
    if data.get("errors"):
        raise RuntimeError(f"Jobber GQL errors: {data['errors']}")
    return data
