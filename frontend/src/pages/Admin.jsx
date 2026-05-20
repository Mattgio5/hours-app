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

function formatDate(str) {
  if (!str) return "";
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function RequestsTab() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionNote, setActionNote] = useState({});
  const [busy, setBusy] = useState({});
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api.getTimeOffRequests({ status: filter || undefined, date: dateFilter || undefined })
      .then(setRequests)
      .finally(() => setLoading(false));
  }, [filter, dateFilter]);

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
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {["pending", "approved", "denied", ""].map((s) => (
          <button
            key={s}
            className={`tab${filter === s ? " active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          title="Filter by specific date"
          style={{ marginBottom: 0, padding: "6px 10px", fontSize: ".85rem", width: "auto" }}
        />
        {dateFilter && (
          <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: ".85rem" }} onClick={() => setDateFilter("")}>
            Clear date
          </button>
        )}
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
                {r.request_date}{r.request_date_to && r.request_date_to !== r.request_date ? ` – ${r.request_date_to}` : ""}
                {r.time_from && <span className="request-meta"> (not in until {r.time_from})</span>}
                {r.time_to && <span className="request-meta"> (leaving by {r.time_to})</span>}
              </div>
              <span className={`badge badge-${r.status}`}>{r.status}</span>
            </div>
            {r.notes && <p className="request-meta" style={{ marginTop: 4 }}>"{r.notes}"</p>}
            {r.admin_note && <p className="request-meta">Admin note: {r.admin_note}</p>}
            {r.jobber_task_id && (
              <p className="request-meta" style={{ color: "#16a34a" }}>
                ✓ {r.jobber_task_id.includes("task") ? r.jobber_task_id : "Jobber task"} created
              </p>
            )}
            <p className="request-meta" style={{ color: "#9ca3af", marginTop: 4 }}>Submitted {formatDate(r.created_at)}</p>

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

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function toDecimalHours(start, end) {
  return (toMinutes(end) - toMinutes(start)) / 60;
}
function fmtHours(h) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(2)}h`;
}

function HoursTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [workers, setWorkers] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.getWorkersFull().then(setWorkers); }, []);

  async function load() {
    setLoading(true);
    setEditId(null);
    setError("");
    try {
      const params = {};
      if (workerId) params.worker_id = workerId;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      setEntries(await api.getTimeEntries(params));
    } finally {
      setLoading(false);
    }
  }

  function startEdit(e) {
    setEditId(e.id);
    setEditData({ entry_date: e.entry_date, start_time: e.start_time, end_time: e.end_time, notes: e.notes || "" });
  }

  async function saveEdit(id) {
    setSaving(true);
    setError("");
    try {
      await api.updateTimeEntry(id, editData);
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    if (!confirm("Delete this entry?")) return;
    try {
      await api.deleteTimeEntry(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalHours = entries.reduce((sum, e) => sum + toDecimalHours(e.start_time, e.end_time), 0);

  const byWorker = entries.reduce((acc, e) => {
    acc[e.worker_name] = (acc[e.worker_name] || 0) + toDecimalHours(e.start_time, e.end_time);
    return acc;
  }, {});
  const multipleWorkers = Object.keys(byWorker).length > 1;

  return (
    <div>
      {error && <div className="error-box">{error}</div>}
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
        <>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontSize: ".9rem" }}>
            <strong>Total: {fmtHours(totalHours)}</strong>
            {" "}across {entries.length} {entries.length === 1 ? "entry" : "entries"}
            {multipleWorkers && (
              <span style={{ color: "#6b7280", marginLeft: 12 }}>
                ({Object.entries(byWorker).sort((a,b) => b[1]-a[1]).map(([n,h]) => `${n.split(" ")[0]}: ${fmtHours(h)}`).join(" · ")})
              </span>
            )}
          </div>

          <table className="admin-table">
            <thead>
              <tr><th>Worker</th><th>Date</th><th>Start</th><th>End</th><th>Hours</th><th>Notes</th><th></th></tr>
            </thead>
            <tbody>
              {entries.map((e) => editId === e.id ? (
                <tr key={e.id} style={{ background: "#fffbeb" }}>
                  <td>{e.worker_name}</td>
                  <td><input type="date" value={editData.entry_date} onChange={(ev) => setEditData(d => ({ ...d, entry_date: ev.target.value }))} style={{ marginBottom: 0, padding: "4px 8px", fontSize: ".85rem" }} /></td>
                  <td><input type="time" value={editData.start_time} onChange={(ev) => setEditData(d => ({ ...d, start_time: ev.target.value }))} style={{ marginBottom: 0, padding: "4px 8px", fontSize: ".85rem" }} /></td>
                  <td><input type="time" value={editData.end_time} onChange={(ev) => setEditData(d => ({ ...d, end_time: ev.target.value }))} style={{ marginBottom: 0, padding: "4px 8px", fontSize: ".85rem" }} /></td>
                  <td style={{ color: "#6b7280" }}>{fmtHours(toDecimalHours(editData.start_time, editData.end_time))}</td>
                  <td><input type="text" value={editData.notes} onChange={(ev) => setEditData(d => ({ ...d, notes: ev.target.value }))} style={{ marginBottom: 0, padding: "4px 8px", fontSize: ".85rem" }} /></td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-success" style={{ padding: "4px 10px", fontSize: ".8rem" }} disabled={saving} onClick={() => saveEdit(e.id)}>Save</button>
                      <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: ".8rem" }} onClick={() => setEditId(null)}>Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={e.id}>
                  <td>{e.worker_name}</td>
                  <td>{e.entry_date}</td>
                  <td>{e.start_time}</td>
                  <td>{e.end_time}</td>
                  <td style={{ color: "#16a34a", fontWeight: 600 }}>{fmtHours(toDecimalHours(e.start_time, e.end_time))}</td>
                  <td style={{ color: "#6b7280", fontSize: ".85rem" }}>{e.notes || "—"}</td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: ".8rem" }} onClick={() => startEdit(e)}>Edit</button>
                      <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: ".8rem" }} onClick={() => del(e.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ── Jobber tab ────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || "";

function JobberTab() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testMsg, setTestMsg] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testBusy, setTestBusy] = useState(false);

  useEffect(() => {
    api.getJobberStatus()
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  function connect() {
    const token = localStorage.getItem("admin_token") || "";
    window.location.href = `${API_BASE}/auth/jobber?token=${token}`;
  }

  async function sendTest(e) {
    e.preventDefault();
    setTestMsg("");
    setTestBusy(true);
    try {
      const res = await api.testEmail(testEmail || undefined);
      setTestMsg(res.message || "Sent!");
    } catch (err) {
      setTestMsg(`Failed: ${err.message}`);
    } finally {
      setTestBusy(false);
    }
  }

  const jobberLabel = loading ? "Checking…"
    : status?.status === "connected" ? "Connected"
    : status?.status === "expired" ? "Token expired"
    : "Not connected";
  const jobberColor = loading ? "#6b7280"
    : status?.status === "connected" ? "#16a34a"
    : "#dc2626";

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Jobber Connection</h2>
        <p style={{ color: jobberColor, fontWeight: 600, marginBottom: 16 }}>{jobberLabel}</p>
        <p style={{ color: "#6b7280", fontSize: ".9rem", marginBottom: 20 }}>
          Required to create tasks when time-off is approved. Re-authorize if expired.
        </p>
        <button className="btn btn-primary" onClick={connect}>
          {status?.status === "connected" ? "Re-authorize Jobber" : "Connect Jobber"}
        </button>
      </div>

      <div className="card">
        <h2>Test Email</h2>
        <p style={{ color: "#6b7280", fontSize: ".9rem", marginBottom: 16 }}>
          Send a test email to verify RESEND_API_KEY, EMAIL_FROM, and ADMIN_EMAIL are configured correctly.
        </p>
        {testMsg && (
          <div className={testMsg.startsWith("Failed") ? "error-box" : "success-box"} style={{ marginBottom: 12, padding: "10px 14px" }}>
            {testMsg}
          </div>
        )}
        <form onSubmit={sendTest}>
          <label>Send to (leave blank to use ADMIN_EMAIL)</label>
          <input
            type="email"
            placeholder="override@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <button className="btn btn-secondary" type="submit" disabled={testBusy}>
            {testBusy ? "Sending…" : "Send Test Email"}
          </button>
        </form>
      </div>
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
        {["requests", "workers", "hours", "jobber"].map((t) => (
          <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "requests" && <RequestsTab />}
      {tab === "workers" && <WorkersTab />}
      {tab === "hours" && <HoursTab />}
      {tab === "jobber" && <JobberTab />}
    </div>
  );
}
