from flask import Blueprint, jsonify, request
from collections import defaultdict
from datetime import date as date_type

from app.db import SessionLocal
from app.models import TimeEntry, Worker
from app.jobber_gql import jobber_gql
from .auth import require_admin

payroll_bp = Blueprint("payroll", __name__)

CREW_LEAD_NAMES = {"connor keiser", "niko", "tyler", "klay", "szymon"}

_VISITS_QUERY = """
query PayrollVisits($start: String!, $end: String!, $after: String) {
  visits(filter: { startAt: { gte: $start, lte: $end } }, first: 100, after: $after) {
    nodes {
      id
      startAt
      assignedTo {
        nodes {
          id
          name { full }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
"""


def _is_crew_lead(name: str) -> bool:
    n = name.strip().lower()
    if n in CREW_LEAD_NAMES:
        return True
    first = n.split()[0] if n else ""
    return first in CREW_LEAD_NAMES


def _fetch_visits(date_from: str, date_to: str) -> list:
    start = f"{date_from}T00:00:00-04:00"
    end = f"{date_to}T23:59:59-04:00"
    visits = []
    cursor = None
    while True:
        res = jobber_gql(_VISITS_QUERY, {"start": start, "end": end, "after": cursor})
        page = res["data"]["visits"]
        visits.extend(page["nodes"])
        if not page["pageInfo"]["hasNextPage"]:
            break
        cursor = page["pageInfo"]["endCursor"]
    return visits


def _visit_date(start_at: str) -> str:
    # startAt is e.g. "2024-05-13T07:00:00-04:00" — first 10 chars is the local date
    return start_at[:10]


@payroll_bp.get("/api/payroll-review")
@require_admin
def payroll_review():
    date_from = request.args.get("from")
    date_to = request.args.get("to")
    if not date_from or not date_to:
        return jsonify({"error": "from and to are required"}), 400

    try:
        df = date_type.fromisoformat(date_from)
        dt = date_type.fromisoformat(date_to)
    except ValueError:
        return jsonify({"error": "invalid date format"}), 400

    with SessionLocal() as s:
        workers = s.query(Worker).all()
        entries = (
            s.query(TimeEntry)
            .filter(TimeEntry.entry_date >= df, TimeEntry.entry_date <= dt)
            .order_by(TimeEntry.entry_date, TimeEntry.worker_name)
            .all()
        )

    worker_by_id = {w.id: w for w in workers}
    worker_by_jobber_id = {w.jobber_user_id: w for w in workers if w.jobber_user_id}
    crew_lead_ids = {w.id for w in workers if _is_crew_lead(w.name)}

    entries_by_date_worker: dict[str, dict[int, object]] = defaultdict(dict)
    for e in entries:
        entries_by_date_worker[str(e.entry_date)][e.worker_id] = e

    try:
        jobber_visits = _fetch_visits(date_from, date_to)
    except Exception as exc:
        return jsonify({"error": f"Jobber fetch failed: {exc}"}), 502

    # crew_assignment[date][laborer_worker_id] = crew_lead_worker_id
    crew_assignment: dict[str, dict[int, int]] = defaultdict(dict)
    for visit in jobber_visits:
        visit_date = _visit_date(visit["startAt"])
        assigned_nodes = visit.get("assignedTo", {}).get("nodes", [])

        on_visit = [worker_by_jobber_id[n["id"]] for n in assigned_nodes if n["id"] in worker_by_jobber_id]
        leads = [w for w in on_visit if w.id in crew_lead_ids]
        laborers = [w for w in on_visit if w.id not in crew_lead_ids]

        if leads:
            lead = leads[0]
            for laborer in laborers:
                crew_assignment[visit_date].setdefault(laborer.id, lead.id)

    flags = []
    clean = []

    for e in entries:
        w = worker_by_id.get(e.worker_id)
        if not w or w.id in crew_lead_ids:
            continue

        date_str = str(e.entry_date)
        lead_id = crew_assignment.get(date_str, {}).get(e.worker_id)
        if not lead_id:
            continue

        lead_entry = entries_by_date_worker.get(date_str, {}).get(lead_id)
        if not lead_entry:
            continue

        lead_w = worker_by_id.get(lead_id)
        issues = []
        if e.start_time < lead_entry.start_time:
            issues.append("early clock-in")
        if e.end_time > lead_entry.end_time:
            issues.append("late clock-out")

        record = {
            "worker_name": e.worker_name,
            "entry_date": date_str,
            "start_time": e.start_time,
            "end_time": e.end_time,
            "crew_lead_name": lead_w.name if lead_w else "Unknown",
            "lead_start_time": lead_entry.start_time,
            "lead_end_time": lead_entry.end_time,
            "issues": issues,
        }
        (flags if issues else clean).append(record)

    return jsonify({"flags": flags, "clean": clean, "total_entries": len(entries)})
