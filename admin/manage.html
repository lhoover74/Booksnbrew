async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getPriorityTag(priority) {
  const safe = escapeHtml(priority || "Normal");
  const isHigh = safe.toLowerCase() === "high";
  return `<span style="
    display:inline-block;
    padding:6px 10px;
    border-radius:999px;
    font-size:12px;
    font-weight:700;
    background:${isHigh ? "rgba(199,144,88,.18)" : "rgba(255,255,255,.06)"};
    color:${isHigh ? "#c79058" : "#d6c6b8"};
    border:1px solid ${isHigh ? "rgba(199,144,88,.28)" : "rgba(255,255,255,.10)"};
  ">${safe}</span>`;
}

function getStatusTag(status) {
  const safe = escapeHtml(status || "New");
  return `<span style="
    display:inline-block;
    padding:6px 10px;
    border-radius:999px;
    font-size:12px;
    font-weight:700;
    background:rgba(255,255,255,.06);
    color:#f5ede3;
    border:1px solid rgba(255,255,255,.10);
  ">${safe}</span>`;
}

function autoTag(lead) {
  if (lead?.budget_range && lead.budget_range.includes("5000")) {
    return "🔥 High Value";
  }
  if (lead?.budget_range && lead.budget_range.includes("$5,000")) {
    return "🔥 High Value";
  }
  if (lead?.project_type) {
    return `📌 ${lead.project_type}`;
  }
  if (lead?.form_type === "quote") {
    return "📄 Quote Lead";
  }
  return "General";
}

async function loadDashboard() {
  const statsEl = document.getElementById("admin-stats");
  const recentEl = document.getElementById("recent-leads");

  if (!statsEl || !recentEl) return;

  try {
    const data = await fetchJson("/api/leads");
    const leads = data.leads || [];

    const total = leads.length;
    const newCount = leads.filter((lead) => (lead.status || "New") === "New").length;
    const quoteCount = leads.filter((lead) => lead.form_type === "quote").length;
    const highCount = leads.filter((lead) => (lead.priority || "").toLowerCase() === "high").length;

    statsEl.innerHTML = `
      <div class="stat-card">
        <h3>${total}</h3>
        <p>Total Leads</p>
      </div>
      <div class="stat-card">
        <h3>${newCount}</h3>
        <p>New Leads</p>
      </div>
      <div class="stat-card">
        <h3>${quoteCount}</h3>
        <p>Quote Requests</p>
      </div>
      <div class="stat-card">
        <h3>${highCount}</h3>
        <p>High Priority</p>
      </div>
    `;

    recentEl.innerHTML =
      leads
        .slice(0, 8)
        .map(
          (lead) => `
        <tr>
          <td>${escapeHtml(lead.name)}</td>
          <td>${escapeHtml(lead.email)}</td>
          <td>${escapeHtml(lead.form_type)}</td>
          <td>${escapeHtml(lead.budget_range || "—")}</td>
          <td>${escapeHtml(lead.status || "New")}</td>
          <td>${formatDate(lead.submitted_at)}</td>
          <td>
            <a href="/admin/lead.html?id=${lead.id}">View</a> |
            <a href="/admin/manage.html?id=${lead.id}">Manage</a>
          </td>
        </tr>
      `
        )
        .join("") || `<tr><td colspan="7">No leads found yet.</td></tr>`;
  } catch (error) {
    statsEl.innerHTML = `<p>Unable to load dashboard stats.</p>`;
    recentEl.innerHTML = `<tr><td colspan="7">Unable to load leads.</td></tr>`;
  }
}

async function loadLeadsTable() {
  const bodyEl = document.getElementById("leads-table-body");
  const statusFilter = document.getElementById("statusFilter");
  const typeFilter = document.getElementById("typeFilter");
  const searchInput = document.getElementById("leadSearch");

  if (!bodyEl) return;

  try {
    const data = await fetchJson("/api/leads");
    const leads = data.leads || [];

    const render = () => {
      const statusValue = statusFilter?.value || "";
      const typeValue = typeFilter?.value || "";
      const query = (searchInput?.value || "").trim().toLowerCase();

      const filtered = leads.filter((lead) => {
        const matchesStatus = !statusValue || (lead.status || "New") === statusValue;
        const matchesType = !typeValue || lead.form_type === typeValue;
        const haystack = [
          lead.name,
          lead.email,
          lead.business_name,
          lead.project_type,
          lead.budget_range
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch = !query || haystack.includes(query);
        return matchesStatus && matchesType && matchesSearch;
      });

      bodyEl.innerHTML =
        filtered
          .map(
            (lead) => `
          <tr>
            <td>${lead.id}</td>
            <td>${escapeHtml(lead.name)}</td>
            <td>${escapeHtml(lead.email)}</td>
            <td>${escapeHtml(lead.form_type)}</td>
            <td>${escapeHtml(lead.budget_range || "—")}</td>
            <td>${getPriorityTag(lead.priority || "Normal")}</td>
            <td>${getStatusTag(lead.status || "New")}</td>
            <td>${formatDate(lead.submitted_at)}</td>
            <td>
              <a href="/admin/lead.html?id=${lead.id}">View</a> |
              <a href="/admin/manage.html?id=${lead.id}">Manage</a>
            </td>
          </tr>
        `
          )
          .join("") || `<tr><td colspan="9">No matching leads found.</td></tr>`;
    };

    statusFilter?.addEventListener("change", render);
    typeFilter?.addEventListener("change", render);
    searchInput?.addEventListener("input", render);

    render();
  } catch (error) {
    bodyEl.innerHTML = `<tr><td colspan="9">Unable to load leads.</td></tr>`;
  }
}

async function loadSingleLead() {
  const wrap = document.getElementById("lead-detail");
  if (!wrap) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    wrap.innerHTML = `<p>Missing lead ID.</p>`;
    return;
  }

  try {
    const data = await fetchJson(`/api/leads/${id}`);
    const lead = data.lead;

    if (!lead) {
      wrap.innerHTML = `<p>Lead not found.</p>`;
      return;
    }

    wrap.innerHTML = `
      <div class="grid-2">
        <div class="section-card">
          <span class="eyebrow">Lead overview</span>
          <h2 class="section-title">${escapeHtml(lead.name)}</h2>
          ${infoBlock("Lead ID", lead.id)}
          ${infoBlock("Email", lead.email)}
          ${infoBlock("Phone", lead.phone || "Not provided")}
          ${infoBlock("Form Type", lead.form_type)}
          ${infoBlock("Priority", lead.priority || "Normal")}
          ${infoBlock("Status", lead.status || "New")}
          ${infoBlock("Submitted", formatDate(lead.submitted_at))}
          ${infoBlock("Source Page", lead.source_page || "—")}
        </div>

        <div class="section-card">
          <span class="eyebrow">Project info</span>
          <h2 class="section-title">Inquiry details</h2>
          ${infoBlock("Business Name", lead.business_name || "Not provided")}
          ${infoBlock("Project Type", lead.project_type || "Not provided")}
          ${infoBlock("Budget Range", lead.budget_range || "Not provided")}

          <div style="margin-top:18px;">
            <label>Message</label>
            <div class="contact-detail" style="display:block;">
              ${escapeHtml(lead.message || "—").replace(/\n/g, "<br>")}
            </div>
          </div>

          <div style="margin-top:18px;">
            <label>Project Details</label>
            <div class="contact-detail" style="display:block;">
              ${escapeHtml(lead.project_details || "—").replace(/\n/g, "<br>")}
            </div>
          </div>

          <div style="margin-top:24px;">
            <a class="btn primary" href="/admin/manage.html?id=${lead.id}">Manage Lead</a>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    wrap.innerHTML = `<p>Unable to load lead.</p>`;
  }
}

function infoBlock(label, value) {
  return `
    <div style="margin-bottom:14px;">
      <div class="meta">${escapeHtml(label)}</div>
      <div>${escapeHtml(value)}</div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
  loadLeadsTable();
  loadSingleLead();
});