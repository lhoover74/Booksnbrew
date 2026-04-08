async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function fmtDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadDashboard() {
  const statsEl = document.getElementById('admin-stats');
  const recentEl = document.getElementById('recent-leads');
  if (!statsEl || !recentEl) return;

  try {
    const data = await fetchJson('/api/leads');
    const leads = data.leads || [];
    const total = leads.length;
    const newCount = leads.filter((l) => l.status === 'New').length;
    const quoteCount = leads.filter((l) => l.form_type === 'quote').length;
    const highCount = leads.filter((l) => l.priority === 'High').length;

    statsEl.innerHTML = `
      <div class="stat-card"><h3>${total}</h3><p>Total Leads</p></div>
      <div class="stat-card"><h3>${newCount}</h3><p>New Leads</p></div>
      <div class="stat-card"><h3>${quoteCount}</h3><p>Quote Requests</p></div>
      <div class="stat-card"><h3>${highCount}</h3><p>High Priority</p></div>
    `;

    recentEl.innerHTML = leads.slice(0, 8).map((lead) => `
      <tr>
        <td>${escapeHtml(lead.name)}</td>
        <td>${escapeHtml(lead.email)}</td>
        <td>${escapeHtml(lead.form_type)}</td>
        <td>${escapeHtml(lead.budget_range || '—')}</td>
        <td>${escapeHtml(lead.status)}</td>
        <td>${fmtDate(lead.submitted_at)}</td>
        <td><a href="/admin/lead.html?id=${lead.id}">View</a></td>
      </tr>
    `).join('') || '<tr><td colspan="7">No leads found yet.</td></tr>';
  } catch (err) {
    statsEl.innerHTML = '<p>Unable to load dashboard stats.</p>';
    recentEl.innerHTML = '<tr><td colspan="7">Unable to load leads.</td></tr>';
  }
}

async function loadLeadsTable() {
  const bodyEl = document.getElementById('leads-table-body');
  const statusFilter = document.getElementById('statusFilter');
  const typeFilter = document.getElementById('typeFilter');
  const searchInput = document.getElementById('leadSearch');
  if (!bodyEl) return;

  try {
    const data = await fetchJson('/api/leads');
    let leads = data.leads || [];

    const render = () => {
      const status = statusFilter?.value || '';
      const type = typeFilter?.value || '';
      const q = (searchInput?.value || '').trim().toLowerCase();

      const filtered = leads.filter((lead) => {
        const matchesStatus = !status || lead.status === status;
        const matchesType = !type || lead.form_type === type;
        const hay = `${lead.name} ${lead.email} ${lead.business_name || ''} ${lead.project_type || ''}`.toLowerCase();
        const matchesSearch = !q || hay.includes(q);
        return matchesStatus && matchesType && matchesSearch;
      });

      bodyEl.innerHTML = filtered.map((lead) => `
        <tr>
          <td>${lead.id}</td>
          <td>${escapeHtml(lead.name)}</td>
          <td>${escapeHtml(lead.email)}</td>
          <td>${escapeHtml(lead.form_type)}</td>
          <td>${escapeHtml(lead.budget_range || '—')}</td>
          <td>${escapeHtml(lead.priority || 'Normal')}</td>
          <td>${escapeHtml(lead.status || 'New')}</td>
          <td>${fmtDate(lead.submitted_at)}</td>
          <td><a href="/admin/lead.html?id=${lead.id}">Open</a></td>
        </tr>
      `).join('') || '<tr><td colspan="9">No matching leads found.</td></tr>';
    };

    statusFilter?.addEventListener('change', render);
    typeFilter?.addEventListener('change', render);
    searchInput?.addEventListener('input', render);
    render();
  } catch (err) {
    bodyEl.innerHTML = '<tr><td colspan="9">Unable to load leads.</td></tr>';
  }
}

async function loadSingleLead() {
  const wrap = document.getElementById('lead-detail');
  if (!wrap) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    wrap.innerHTML = '<p>Missing lead ID.</p>';
    return;
  }

  try {
    const data = await fetchJson(`/api/leads/${id}`);
    const lead = data.lead;
    if (!lead) {
      wrap.innerHTML = '<p>Lead not found.</p>';
      return;
    }

    wrap.innerHTML = `
      <div class="grid-2">
        <div class="section-card">
          <span class="eyebrow">Lead overview</span>
          <h2 class="section-title">${escapeHtml(lead.name)}</h2>
          <div>${infoBlock('Lead ID', lead.id)}</div>
          <div>${infoBlock('Email', lead.email)}</div>
          <div>${infoBlock('Phone', lead.phone || 'Not provided')}</div>
          <div>${infoBlock('Form Type', lead.form_type)}</div>
          <div>${infoBlock('Priority', lead.priority || 'Normal')}</div>
          <div>${infoBlock('Status', lead.status || 'New')}</div>
          <div>${infoBlock('Submitted', fmtDate(lead.submitted_at))}</div>
          <div>${infoBlock('Source Page', lead.source_page || '—')}</div>
        </div>
        <div class="section-card">
          <span class="eyebrow">Project info</span>
          <h2 class="section-title">Inquiry details</h2>
          <div>${infoBlock('Business Name', lead.business_name || 'Not provided')}</div>
          <div>${infoBlock('Project Type', lead.project_type || 'Not provided')}</div>
          <div>${infoBlock('Budget Range', lead.budget_range || 'Not provided')}</div>
          <div style="margin-top:18px;">
            <label>Message</label>
            <div class="contact-detail" style="display:block;">${escapeHtml(lead.message || '—').replace(/\n/g, '<br>')}</div>
          </div>
          <div style="margin-top:18px;">
            <label>Project Details</label>
            <div class="contact-detail" style="display:block;">${escapeHtml(lead.project_details || '—').replace(/\n/g, '<br>')}</div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = '<p>Unable to load lead.</p>';
  }
}

function infoBlock(label, value) {
  return `<div style="margin-bottom:14px;"><div class="meta">${escapeHtml(label)}</div><div>${escapeHtml(value)}</div></div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadLeadsTable();
  loadSingleLead();
});