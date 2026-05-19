import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";

const TYPES = [
  { value: "full_day", label: "Full Day Off" },
  { value: "late_arrival", label: "Coming in Late" },
  { value: "early_departure", label: "Leaving Early" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TimeOff() {
  const [params] = useSearchParams();
  const workerId = params.get("worker_id");
  const workerName = params.get("worker_name") || "Unknown";

  const [type, setType] = useState("full_day");
  const [date, setDate] = useState(today());
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (type === "late_arrival" && !timeFrom) {
      setError("Please enter the time you'll be available."); return;
    }
    if (type === "early_departure" && !timeTo) {
      setError("Please enter the time you need to leave."); return;
    }
    setLoading(true);
    try {
      await api.submitTimeOff({
        worker_id: Number(workerId),
        request_type: type,
        request_date: date,
        time_from: type === "late_arrival" ? timeFrom : undefined,
        time_to: type === "early_departure" ? timeTo : undefined,
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
          <h3>Request submitted!</h3>
          <p>Your request for {date} has been sent for approval.</p>
        </div>
        <Link to="/" className="btn btn-primary btn-full">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">← Back</Link>
      <div className="card">
        <h2>Request Time Off</h2>
        <p className="worker-header">Request for <strong>{workerName}</strong></p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={submit}>
          <label>Type</label>
          <div className="type-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`type-btn${type === t.value ? " active" : ""}`}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

          {type === "late_arrival" && (
            <>
              <label>Not available until</label>
              <input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} required />
            </>
          )}

          {type === "early_departure" && (
            <>
              <label>Need to leave by</label>
              <input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} required />
            </>
          )}

          <label>Notes (optional)</label>
          <textarea
            placeholder="Reason or anything else to know..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "Sending…" : "Submit Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
