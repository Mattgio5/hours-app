import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api";

const TYPE_LABELS = {
  full_day: "Full Day Off",
  late_arrival: "Late Arrival",
  early_departure: "Early Departure",
};

// ── Login ────────────────────────────────────────────────────────────────────

function Login({ onLogin }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await api.adminLogin(pw);
      localStorage.setItem("admin_token", token);
      onLogin();
    } catch {
      setError("Invalid password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h2>Admin Login</h2>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={submit}>
          <label>Password</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "…" : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Requests tab ─────────────────────────────────────────────────────────────

function RequestsTab() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [actionNote, setActionNote] = useState({});
  const [busy, setBusy] = useState({});
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api.getTimeOffRequests(filter || undefined)
      .then(setRequests)
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function act(id, action, note) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const fn = action === "approve" ? api.approveRequest : api.denyRequest;
      const res = await fn(id, note);
      if (res.warning) setMsg(res.warning);
      load();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["pending", "approved", "denied", ""].map((s) => (
          <button
            key={s}
            className={`tab${filter === s ? " active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {msg && <div className="error-box" style={{ marginBottom: 12 }}>{msg}</div>}

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading…</p>
      ) : requests.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No requests.</p>
      ) : (
        requests.map((r) => (
          <div className="request-row" key={r.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong>{r.worker_name}</strong>
                <span style={{ margin: "0 8px", color: "#9ca3af" }}>·</span>
                {TYPE_LABELS[r.request_type] || r.request_type}
                <span style={{ margin: "0 8px", color: "#9ca3af" }}>·</span>
                {r.request_date}
                {r.time_from && <span className="request-meta"> (not in until {r.time_from})</span>}
                {r.time_to && <span className="request-meta"> (leaving by {r.time_to})</span>}
              </div>
              <span className={`badge badge-${r.status}`}>{r.status}</span>
            </div>
            {r.notes && <p className="request-meta" style={{ marginTop: 4 }}>"{r.notes}"</p>}
            {r.admin_note && <p className="request-meta">Admin note: {r.admin_note}</p>}
            {r.jobber_task_id && <p className="request-meta" style={{ color: "#16a34a" }}>✓ Jobber task created</p>}

            {r.status === "pending" && (
              <div style={{ marginTop: 10 }}>
                <input
                  type="text"
                  placeholder="Admin note (optional)"
                  style={{ marginBottom: 8 }}
                  value={actionNote[r.id] || ""}
                  onChange={(e) => setActionNote((n) => ({ ...n, [r.id]: e.target.value }))}
                />
                <div className="btn-row">
                  <button
                    className="btn btn-success"
                    disabled={busy[r.id]}
                    onClick={() => act(r.id, "approve", actionNote[r.id])}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={busy[r.id]}
                    onClick={() => act(r.id, "deny", actionNote[r.id])}
                  >
                    Deny
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Workers tab ───────────────────────────────────────────────────────────────

function WorkersTab() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", jobber_user_id: "" });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.getWorkersFull().then(setWorkers).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  function startEdit(w) {
    setEditId(w.id);
    setForm({ name: w.name, jobber_user_id: w.jobber_user_id || "" });
  }

  function cancelEdit() {
    setEditId(null);
    setForm({ name: "", jobber_user_id: "" });
    setError("");
  }

  async function save() {
    setError("");
    if (!form.name.trim()) { setError("Name is required"); return; }
    try {
      if (editId) {
        await api.updateWorker(editId, { name: form.name, jobber_user_id: form.jobber_user_id || null });
      } else {
        await api.createWorker({ name: form.name, jobber_user_id: form.jobber_user_id || null });
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function del(id) {
    if (!confirm("Delete this worker?")) return;
    try {
      await api.deleteWorker(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 16 }}>{editId ? "Edit Worker" : "Add Worker"}</h2>
        <label>Name</label>
        <input
          type="text"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <label>Jobber User ID (optional)</label>
        <input
          type="text"
          placeholder="e.g. Mjk3NTA1OA=="
          value={form.jobber_user_id}
          onChange={(e) => setForm((f) => ({ ...f, jobber_user_id: e.target.value }))}
        />
        <div className="btn-row">
          <button className="btn btn-primary" onClick={save}>
            {editId ? "Save" : "Add Worker"}
          </button>
          {editId && (
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading…</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Jobber ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td style={{ fontFamily: "monospace", fontSize: ".8rem", color: "#6b7280" }}>
                  {w.jobber_user_id || "—"}
                </td>
                <td>
                  <div className="btn-row">
                    <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: ".85rem" }} onClick={() => startEdit(w)}>Edit</button>
                    <button className="btn btn-danger" style={{ padding: "4px 12px", fontSize: ".85rem" }} onClick={() => del(w.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Hours tab ─────────────────────────────────────────────────────────────────

function HoursTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [workers, setWorkers] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => { api.getWorkersFull().then(setWorkers); }, []);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (workerId) params.worker_id = workerId;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const rows = await api.getTimeEntries(params);
      setEntries(rows);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "end" }}>
          <div>
            <label>Worker</label>
            <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} style={{ marginBottom: 0 }}>
              <option value="">All</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label>From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ marginBottom: 0 }} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ marginBottom: 0 }} />
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
          Search
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No entries. Use the filter above.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr><th>Worker</th><th>Date</th><th>Start</th><th>End</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.worker_name}</td>
                <td>{e.entry_date}</td>
                <td>{e.start_time}</td>
                <td>{e.end_time}</td>
                <td style={{ color: "#6b7280", fontSize: ".85rem" }}>{e.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main admin shell ──────────────────────────────────────────────────────────

export default function Admin() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("admin_token"));
  const [tab, setTab] = useState("requests");

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Admin</h1>
        <button
          className="btn btn-secondary"
          style={{ padding: "6px 14px", fontSize: ".85rem" }}
          onClick={() => { localStorage.removeItem("admin_token"); setAuthed(false); }}
        >
          Log out
        </button>
      </div>

      <div className="tabs">
        {["requests", "workers", "hours"].map((t) => (
          <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "requests" && <RequestsTab />}
      {tab === "workers" && <WorkersTab />}
      {tab === "hours" && <HoursTab />}
    </div>
  );
}
