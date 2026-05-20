const BASE = import.meta.env.VITE_API_URL || "";

function adminHeaders() {
  const token = localStorage.getItem("admin_token") || "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function adminReq(method, path, body) {
  const opts = { method, headers: adminHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  getWorkers: () => req("GET", "/api/workers"),
  submitTimeEntry: (body) => req("POST", "/api/time-entries", body),
  submitTimeOff: (body) => req("POST", "/api/time-off-requests", body),

  adminLogin: (password) => req("POST", "/api/admin/login", { password }),
  getTimeOffRequests: ({ status, date_from, date_to } = {}) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (date_from) p.set("date_from", date_from);
    if (date_to) p.set("date_to", date_to);
    const qs = p.toString();
    return adminReq("GET", `/api/time-off-requests${qs ? `?${qs}` : ""}`);
  },
  approveRequest: (id, admin_note) =>
    adminReq("POST", `/api/time-off-requests/${id}/approve`, { admin_note }),
  denyRequest: (id, admin_note) =>
    adminReq("POST", `/api/time-off-requests/${id}/deny`, { admin_note }),
  getTimeEntries: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return adminReq("GET", `/api/time-entries${qs ? `?${qs}` : ""}`);
  },
  updateTimeEntry: (id, body) => adminReq("PUT", `/api/time-entries/${id}`, body),
  deleteTimeEntry: (id) => adminReq("DELETE", `/api/time-entries/${id}`),
  deleteTimeOffRequest: (id) => adminReq("DELETE", `/api/time-off-requests/${id}`),
  resetTimeOffRequest: (id) => adminReq("POST", `/api/time-off-requests/${id}/reset`),
  testEmail: (to) => adminReq("POST", "/api/admin/test-email", { to }),
  getJobberStatus: () => adminReq("GET", "/api/admin/jobber-status"),
  getWorkersFull: () => adminReq("GET", "/api/workers"),
  createWorker: (body) => adminReq("POST", "/api/workers", body),
  updateWorker: (id, body) => adminReq("PUT", `/api/workers/${id}`, body),
  deleteWorker: (id) => adminReq("DELETE", `/api/workers/${id}`),
};
