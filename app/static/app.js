// --- Personal Outreach Engine State & Logic ---
let currentLeads = [];
let currentTemplates = [];
let activeStatusFilter = 'ALL';
let activeSearchQuery = '';
let activeLeadForDrawer = null;
let activeLeadForCompose = null;
let activeComposeChannel = 'EMAIL'; // 'EMAIL' or 'X_DM'
let xConnectionStatus = { connected: false, username: null };

document.addEventListener('DOMContentLoaded', () => {
  checkXAuthStatus();
  loadTemplates();
  loadAnalytics();
  loadLeads();
});

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

// Check X (Twitter) Connection Status
async function checkXAuthStatus() {
  try {
    const res = await fetch('/api/auth/x/status');
    if (!res.ok) return;
    const data = await res.json();
    xConnectionStatus = data;

    const badgeContainer = document.getElementById('x-auth-badge-container');
    if (data.connected && data.username) {
      badgeContainer.innerHTML = `
        <span style="font-size: 11px; background: #f3f4f6; padding: 3px 8px; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-main); font-weight: 500;">
          🐦 @${escapeHtml(data.username)}
        </span>
      `;
    } else {
      badgeContainer.innerHTML = `
        <a href="/api/auth/x/login" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 2px 8px;">
          🐦 Connect X
        </a>
      `;
    }
  } catch (err) {
    console.error('Error checking X auth:', err);
  }
}

// Fetch Analytics / KPI Summary
async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics/overview');
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('kpi-total').textContent = data.total_leads;
    document.getElementById('kpi-contacted').textContent = data.contacted_count;
    document.getElementById('kpi-sent-emails').textContent = `${data.total_sent_emails} sent messages`;
    document.getElementById('kpi-replied').textContent = data.replied_count;
    document.getElementById('kpi-reply-rate').textContent = `${data.reply_rate}% reply rate`;
    document.getElementById('kpi-followup').textContent = data.follow_up_needed;

    // Counts on tabs
    document.getElementById('count-all').textContent = data.total_leads;
    document.getElementById('count-not-contacted').textContent = data.not_contacted_count;
    document.getElementById('count-contacted').textContent = data.contacted_count;
    document.getElementById('count-replied').textContent = data.replied_count;
  } catch (err) {
    console.error('Error fetching analytics:', err);
  }
}

// Fetch Templates
async function loadTemplates() {
  try {
    const res = await fetch('/api/templates');
    if (!res.ok) return;
    currentTemplates = await res.json();
    const select = document.getElementById('compose-template-select');
    select.innerHTML = '<option value="">-- Custom Outreach --</option>';
    currentTemplates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${t.category})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error fetching templates:', err);
  }
}

// Fetch Leads
async function loadLeads() {
  const tbody = document.getElementById('leads-table-body');
  try {
    let url = `/api/leads?status=${activeStatusFilter}`;
    if (activeSearchQuery) {
      url += `&search=${encodeURIComponent(activeSearchQuery)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch leads');
    currentLeads = await res.json();
    renderLeadsTable(currentLeads);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Error loading leads: ${err.message}</td></tr>`;
  }
}

function renderLeadsTable(leads) {
  const tbody = document.getElementById('leads-table-body');
  if (!leads || leads.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <p>No contacts found in this view.</p>
          <button class="btn btn-secondary btn-sm" onclick="openImportModal()">Import from Sheet / CSV</button>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = leads.map(lead => {
    const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'No Name';
    const roleText = lead.role || '—';
    const companyText = lead.company || '—';
    const statusClass = `badge-${lead.status.toLowerCase().replace(/_/g, '-')}`;
    const formattedStatus = lead.status.replace(/_/g, ' ').toLowerCase();

    const xHandleHtml = lead.x_handle 
      ? `<div style="font-size: 11px; color: #1d9bf0; margin-top: 2px;">🐦 ${escapeHtml(lead.x_handle)}</div>`
      : '';

    let lastContactedStr = '—';
    if (lead.last_contacted_at) {
      const d = new Date(lead.last_contacted_at);
      lastContactedStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    return `
      <tr>
        <td>
          <div class="lead-name">${escapeHtml(fullName)}</div>
          <div class="lead-role">${escapeHtml(roleText)}</div>
        </td>
        <td>
          <div class="lead-company">${escapeHtml(companyText)}</div>
        </td>
        <td>
          <div class="lead-email">${escapeHtml(lead.email)}</div>
          ${xHandleHtml}
        </td>
        <td>
          <span class="badge ${statusClass}">${formattedStatus}</span>
        </td>
        <td>
          <span style="font-size: 12px; color: var(--text-secondary);">${lastContactedStr}</span>
        </td>
        <td>
          <span style="font-size: 12px; color: var(--text-muted);">${lead.message_count || 0} msgs</span>
        </td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-secondary btn-sm" onclick="openLeadDrawer(${lead.id})">History</button>
            <button class="btn btn-primary btn-sm" onclick="openComposeModalForLead(${lead.id})">Message</button>
            <button class="btn btn-secondary btn-sm" onclick="openEditLeadModal(${lead.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteLead(${lead.id})">&times;</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Search & Filter Handlers
function filterByStatus(status) {
  activeStatusFilter = status;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
  loadLeads();
}

let searchDebounceTimeout = null;
function handleSearch(val) {
  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(() => {
    activeSearchQuery = val.trim();
    loadLeads();
  }, 250);
}

// Mailbox Sync Action
async function handleMailboxSync() {
  const syncBtn = document.getElementById('btn-sync-mailbox');
  const syncText = document.getElementById('sync-btn-text');
  const syncIcon = document.getElementById('sync-btn-icon');

  syncBtn.disabled = true;
  syncText.textContent = 'Syncing...';
  syncIcon.style.display = 'inline-block';
  syncIcon.style.animation = 'spin 1s linear infinite';

  try {
    const res = await fetch('/api/sync/mailbox?limit=150', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Sync failed');

    const s = data.stats || {};
    showToast(`Synced! ${s.sent_synced || 0} sent emails synced.`);
    loadAnalytics();
    loadLeads();
  } catch (err) {
    showToast(`Sync Error: ${err.message}`, 'error');
  } finally {
    syncBtn.disabled = false;
    syncText.textContent = 'Sync Mailbox';
    syncIcon.style.animation = 'none';
  }
}

// Lead Details & History Drawer
async function openLeadDrawer(leadId) {
  try {
    const res = await fetch(`/api/leads/${leadId}`);
    if (!res.ok) throw new Error('Could not load lead details');
    const lead = await res.json();
    activeLeadForDrawer = lead;

    const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'No Name';
    document.getElementById('drawer-name').textContent = fullName;
    document.getElementById('drawer-role-company').textContent = `${lead.role || 'No Role'} • ${lead.company || 'No Company'}`;
    document.getElementById('drawer-email').textContent = lead.email;
    document.getElementById('drawer-x-handle').textContent = lead.x_handle || 'None';
    document.getElementById('drawer-custom-hook').textContent = lead.custom_hook || 'None';
    document.getElementById('drawer-notes').textContent = lead.notes || 'None';

    const statusBadge = document.getElementById('drawer-status-badge');
    statusBadge.className = `badge badge-${lead.status.toLowerCase().replace(/_/g, '-')}`;
    statusBadge.textContent = lead.status.replace(/_/g, ' ').toLowerCase();

    document.getElementById('drawer-msg-count').textContent = lead.messages.length;

    const threadList = document.getElementById('drawer-thread-list');
    if (!lead.messages || lead.messages.length === 0) {
      threadList.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">No messages exchanged yet.</div>';
    } else {
      threadList.innerHTML = lead.messages.map(m => {
        const isSent = m.direction === 'SENT';
        const isXDM = m.channel === 'X_DM';
        const dateStr = new Date(m.sent_at).toLocaleString();
        const channelBadge = isXDM ? '🐦 X DM' : '📧 Email';
        return `
          <div class="message-bubble ${isSent ? 'sent' : 'received'}">
            <div class="message-header">
              <span><strong>${isSent ? 'Sent to' : 'Received from'}:</strong> ${escapeHtml(isSent ? m.recipient : m.sender)} (${channelBadge})</span>
              <span>${dateStr}</span>
            </div>
            <div class="message-subject">${escapeHtml(m.subject)}</div>
            <div class="message-body">${escapeHtml(m.body_text || m.snippet || '')}</div>
          </div>
        `;
      }).join('');
    }

    document.getElementById('drawer-lead-details').classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeLeadDrawer() {
  document.getElementById('drawer-lead-details').classList.remove('active');
  activeLeadForDrawer = null;
}

function closeDrawerOnBg(e) {
  if (e.target.id === 'drawer-lead-details') {
    closeLeadDrawer();
  }
}

function openComposeFromDrawer() {
  if (activeLeadForDrawer) {
    openComposeModalForLead(activeLeadForDrawer.id);
  }
}

// Multi-Channel Compose Modal
function setComposeChannel(channel) {
  activeComposeChannel = channel;
  const isEmail = channel === 'EMAIL';

  document.getElementById('btn-channel-email').classList.toggle('active', isEmail);
  document.getElementById('btn-channel-xdm').classList.toggle('active', !isEmail);

  document.getElementById('group-compose-subject').style.display = isEmail ? 'block' : 'none';
  document.getElementById('group-compose-x-handle').style.display = isEmail ? 'none' : 'block';

  document.getElementById('compose-recipient-label').textContent = isEmail ? 'Recipient Email' : 'Email on File';
  document.getElementById('compose-body-label').textContent = isEmail ? 'Message Body' : 'Direct Message Pitch (X DM)';
  document.getElementById('btn-send-email-action').textContent = isEmail ? 'Send via Gmail' : 'Send via X (Twitter)';

  applySelectedTemplate();
}

function openComposeModalForLead(leadId) {
  const lead = currentLeads.find(l => l.id === leadId) || activeLeadForDrawer;
  if (!lead) return;
  activeLeadForCompose = lead;

  document.getElementById('compose-to').value = `${lead.first_name || ''} <${lead.email}>`.trim();
  document.getElementById('compose-x-handle').value = lead.x_handle || '';
  document.getElementById('compose-template-select').value = '';
  document.getElementById('compose-subject').value = '';
  document.getElementById('compose-body').value = '';

  // Default to Email channel
  setComposeChannel('EMAIL');

  // Select default first template if available
  if (currentTemplates.length > 0) {
    document.getElementById('compose-template-select').value = currentTemplates[0].id;
    applySelectedTemplate();
  }

  document.getElementById('modal-compose').classList.add('active');
}

function closeComposeModal() {
  document.getElementById('modal-compose').classList.remove('active');
  activeLeadForCompose = null;
}

function applySelectedTemplate() {
  if (!activeLeadForCompose) return;
  const templateId = document.getElementById('compose-template-select').value;
  if (!templateId) return;

  const tmpl = currentTemplates.find(t => t.id == templateId);
  if (!tmpl) return;

  const lead = activeLeadForCompose;
  const replaceVars = (str) => {
    return str
      .replace(/\{\{\s*(firstName|first_name)\s*\}\}/gi, lead.first_name || (lead.email.split('@')[0]))
      .replace(/\{\{\s*(lastName|last_name)\s*\}\}/gi, lead.last_name || '')
      .replace(/\{\{\s*company\s*\}\}/gi, lead.company || 'your team')
      .replace(/\{\{\s*role\s*\}\}/gi, lead.role || 'team')
      .replace(/\{\{\s*custom_hook\s*\}\}/gi, lead.custom_hook || 'your recent developments')
      .replace(/\{\{\s*email\s*\}\}/gi, lead.email || '');
  };

  document.getElementById('compose-subject').value = replaceVars(tmpl.subject_template);
  document.getElementById('compose-body').value = replaceVars(tmpl.body_template);
}

async function executeSendMessage() {
  if (!activeLeadForCompose) return;
  const sendBtn = document.getElementById('btn-send-email-action');
  const body = document.getElementById('compose-body').value.trim();

  if (!body) {
    showToast('Please enter your outreach message', 'error');
    return;
  }

  if (activeComposeChannel === 'EMAIL') {
    const subject = document.getElementById('compose-subject').value.trim();
    if (!subject) {
      showToast('Please provide an email subject', 'error');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    try {
      const res = await fetch(`/api/leads/${activeLeadForCompose.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Email sending failed');

      showToast(`Email successfully sent to ${activeLeadForCompose.email}!`);
      closeComposeModal();
      if (activeLeadForDrawer && activeLeadForDrawer.id === activeLeadForCompose.id) {
        openLeadDrawer(activeLeadForCompose.id);
      }
      loadAnalytics();
      loadLeads();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send via Gmail';
    }
  } else {
    // X (Twitter) Direct Message Channel
    const xHandle = document.getElementById('compose-x-handle').value.trim();
    if (!xHandle) {
      showToast('Please provide a target X Handle (e.g. @username)', 'error');
      return;
    }

    if (!xConnectionStatus.connected) {
      showToast('Please click "Connect X" in the top bar to authorize your X account first!', 'error');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Dispatching X DM...';

    try {
      const res = await fetch(`/api/auth/x/leads/${activeLeadForCompose.id}/send-dm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: body, x_handle: xHandle })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'X DM sending failed');

      showToast(`X DM successfully sent to ${xHandle}!`);
      closeComposeModal();
      if (activeLeadForDrawer && activeLeadForDrawer.id === activeLeadForCompose.id) {
        openLeadDrawer(activeLeadForCompose.id);
      }
      loadAnalytics();
      loadLeads();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send via X (Twitter)';
    }
  }
}

// Add / Edit Lead Modal
function openNewLeadModal() {
  document.getElementById('lead-form-id').value = '';
  document.getElementById('lead-form-title').textContent = 'Add New Contact';
  document.getElementById('lead-form-first-name').value = '';
  document.getElementById('lead-form-last-name').value = '';
  document.getElementById('lead-form-email').value = '';
  document.getElementById('lead-form-x-handle').value = '';
  document.getElementById('lead-form-company').value = '';
  document.getElementById('lead-form-role').value = '';
  document.getElementById('lead-form-status').value = 'NOT_CONTACTED';
  document.getElementById('lead-form-custom-hook').value = '';
  document.getElementById('lead-form-notes').value = '';

  document.getElementById('modal-lead-form').classList.add('active');
}

function openEditLeadModal(leadId) {
  const lead = currentLeads.find(l => l.id === leadId);
  if (!lead) return;

  document.getElementById('lead-form-id').value = lead.id;
  document.getElementById('lead-form-title').textContent = 'Edit Contact';
  document.getElementById('lead-form-first-name').value = lead.first_name || '';
  document.getElementById('lead-form-last-name').value = lead.last_name || '';
  document.getElementById('lead-form-email').value = lead.email || '';
  document.getElementById('lead-form-x-handle').value = lead.x_handle || '';
  document.getElementById('lead-form-company').value = lead.company || '';
  document.getElementById('lead-form-role').value = lead.role || '';
  document.getElementById('lead-form-status').value = lead.status || 'NOT_CONTACTED';
  document.getElementById('lead-form-custom-hook').value = lead.custom_hook || '';
  document.getElementById('lead-form-notes').value = lead.notes || '';

  document.getElementById('modal-lead-form').classList.add('active');
}

function closeLeadFormModal() {
  document.getElementById('modal-lead-form').classList.remove('active');
}

async function saveLeadForm() {
  const id = document.getElementById('lead-form-id').value;
  const email = document.getElementById('lead-form-email').value.trim();
  if (!email) {
    showToast('Email is required', 'error');
    return;
  }

  const payload = {
    email,
    first_name: document.getElementById('lead-form-first-name').value.trim(),
    last_name: document.getElementById('lead-form-last-name').value.trim(),
    company: document.getElementById('lead-form-company').value.trim(),
    role: document.getElementById('lead-form-role').value.trim(),
    x_handle: document.getElementById('lead-form-x-handle').value.trim(),
    status: document.getElementById('lead-form-status').value,
    custom_hook: document.getElementById('lead-form-custom-hook').value.trim(),
    notes: document.getElementById('lead-form-notes').value.trim()
  };

  try {
    let res;
    if (id) {
      res = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Save failed');

    showToast(id ? 'Contact updated!' : 'Contact created!');
    closeLeadFormModal();
    loadAnalytics();
    loadLeads();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteLead(leadId) {
  if (!confirm('Are you sure you want to delete this contact and all its message history?')) return;
  try {
    const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    showToast('Contact deleted');
    loadAnalytics();
    loadLeads();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Import Modal
function openImportModal() {
  document.getElementById('modal-import').classList.add('active');
}

function closeImportModal() {
  document.getElementById('modal-import').classList.remove('active');
}

async function executeImport() {
  const csvData = document.getElementById('import-csv-textarea').value.trim();
  if (!csvData) {
    showToast('Please paste CSV data', 'error');
    return;
  }

  try {
    const res = await fetch('/api/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_data: csvData })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Import failed');

    const s = data.stats || {};
    showToast(`Imported! ${s.created || 0} created, ${s.updated || 0} updated.`);
    closeImportModal();
    loadAnalytics();
    loadLeads();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Utility HTML escape
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
