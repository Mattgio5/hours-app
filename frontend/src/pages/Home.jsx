import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Home() {
  const [workers, setWorkers] = useState([]);
  const [lastName, setLastName] = useState("");
  const [matches, setMatches] = useState(null); // null = not searched yet
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { api.getWorkers().then(setWorkers); }, []);

  function search(e) {
    e.preventDefault();
    const q = lastName.trim().toLowerCase();
    if (!q) return;
    const found = workers.filter((w) => {
      const parts = w.name.trim().split(" ");
      return parts[parts.length - 1].toLowerCase() === q;
    });
    setMatches(found);
    setSelected(found.length === 1 ? found[0] : null);
  }

  function reset() {
    setLastName("");
    setMatches(null);
    setSelected(null);
  }

  function go(path) {
    const params = `?worker_id=${selected.id}&worker_name=${encodeURIComponent(selected.name)}`;
    navigate(path + params);
  }

  // ── Step 1: enter last name ────────────────────────────────────────────────
  if (!selected) {
    return (
      <div className="page">
        <div className="card">
          <h1>Clock In / Time Off</h1>

          <form onSubmit={search}>
            <label>Enter your last name</label>
            <input
              type="text"
              placeholder="e.g. Wagner"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); setMatches(null); }}
              autoFocus
            />
            <button className="btn btn-primary btn-full" type="submit" disabled={!lastName.trim()}>
              Continue
            </button>
          </form>

          {matches !== null && matches.length === 0 && (
            <div className="error-box" style={{ marginTop: 12 }}>
              No one found with that last name. Check your spelling or ask your manager.
            </div>
          )}

          {matches !== null && matches.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: ".9rem", color: "#6b7280", marginBottom: 10 }}>
                Multiple people found — select your name:
              </p>
              {matches.map((w) => (
                <button
                  key={w.id}
                  className="btn btn-secondary btn-full"
                  onClick={() => setSelected(w)}
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Step 2: confirm identity ───────────────────────────────────────────────
  return (
    <div className="page">
      <div className="card">
        <h2>Are you <strong>{selected.name}</strong>?</h2>
        <p className="sub">Make sure this is you before continuing.</p>

        <button className="btn btn-primary btn-full" onClick={() => go("/time-entry")}>
          Yes — Log Hours
        </button>
        <button className="btn btn-secondary btn-full" onClick={() => go("/time-off")}>
          Yes — Request Time Off
        </button>
        <button className="btn btn-secondary btn-full" onClick={reset} style={{ marginTop: 4 }}>
          No, that's not me
        </button>
      </div>
    </div>
  );
}
