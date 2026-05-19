import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Home() {
  const [workers, setWorkers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getWorkers()
      .then(setWorkers)
      .finally(() => setLoading(false));
  }, []);

  const selected = workers.find((w) => String(w.id) === selectedId);
  const params = selected
    ? `?worker_id=${selected.id}&worker_name=${encodeURIComponent(selected.name)}`
    : "";

  return (
    <div className="page">
      <div className="card">
        <h1>Clock In / Time Off</h1>
        <p className="sub">Select your name to get started.</p>

        <label>Who are you?</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loading}
        >
          <option value="">— select —</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        <button
          className="btn btn-primary btn-full"
          disabled={!selected}
          onClick={() => navigate("/time-entry" + params)}
        >
          Log Hours
        </button>
        <button
          className="btn btn-secondary btn-full"
          disabled={!selected}
          onClick={() => navigate("/time-off" + params)}
        >
          Request Time Off
        </button>
      </div>
    </div>
  );
}
