import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TimeEntry() {
  const [params] = useSearchParams();
  const workerId = params.get("worker_id");
  const workerName = params.get("worker_name") || "Unknown";

  const [date, setDate] = useState(today());
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!start || !end) { setError("Start and end time are required."); return; }
    setLoading(true);
    try {
      await api.submitTimeEntry({
        worker_id: Number(workerId),
        entry_date: date,
        start_time: start,
        end_time: end,
        notes: notes || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="page">
        <div className="success-box">
          <h3>Hours logged!</h3>
          <p>Your time for {date} has been saved.</p>
        </div>
        <button className="btn btn-secondary btn-full" onClick={() => setDone(false)}>
          Log another day
        </button>
        <Link to="/" className="btn btn-primary btn-full" style={{ marginTop: 0 }}>
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">← Back</Link>
      <div className="card">
        <h2>Log Hours</h2>
        <p className="worker-header">Logging for <strong>{workerName}</strong></p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={submit}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

          <label>Start time</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />

          <label>End time</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />

          <label>Notes (optional)</label>
          <textarea
            placeholder="Any notes about this day..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "Saving…" : "Submit Hours"}
          </button>
        </form>
      </div>
    </div>
  );
}
