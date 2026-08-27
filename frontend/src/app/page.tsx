'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Mail, 
  Send, 
  Plus, 
  FileSpreadsheet, 
  Search, 
  Trash2, 
  Edit, 
  History, 
  X,
  FileText,
  Upload,
  Check,
  AlertCircle,
  Paperclip,
  Layers,
  Sparkles,
  ExternalLink,
  MousePointerClick,
  RefreshCw
} from 'lucide-react';

interface EmailMessage {
  id: number;
  lead_id: number;
  message_id?: string;
  thread_id?: string;
  channel: 'EMAIL' | 'X_DM';
  direction: 'SENT' | 'RECEIVED';
  sender: string;
  recipient: string;
  subject: string;
  snippet?: string;
  body_text?: string;
  sent_at: string;
}

interface LinkClick {
  id: number;
  lead_id: number;
  target_url: string;
  utm_source: string;
  utm_campaign?: string;
  utm_content?: string;
  clicked_at: string;
  ip_address?: string;
}

interface Lead {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  role?: string;
  x_handle?: string;
  website_url?: string;
  linkedin_url?: string;
  status: string;
  custom_hook?: string;
  notes?: string;
  source: string;
  last_contacted_at?: string;
  follow_up_due_at?: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  click_count?: number;
  messages?: EmailMessage[];
  clicks?: LinkClick[];
}

interface Template {
  id: number;
  name: string;
  subject_template: string;
  body_template: string;
  category: string;
}

interface Analytics {
  total_leads: number;
  contacted_count: number;
  not_contacted_count: number;
  replied_count: number;
  interested_count: number;
  follow_up_needed: number;
  total_sent_emails: number;
  total_received_emails: number;
  reply_rate: number;
}

interface XStatus {
  connected: boolean;
  username: string | null;
  name: string | null;
}

interface ResumeStatus {
  exists: boolean;
  filename: string;
  size_kb: number;
  updated_at: string | null;
}

export default function OutreachEngineDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    total_leads: 0,
    contacted_count: 0,
    not_contacted_count: 0,
    replied_count: 0,
    interested_count: 0,
    follow_up_needed: 0,
    total_sent_emails: 0,
    total_received_emails: 0,
    reply_rate: 0
  });
  const [xStatus, setXStatus] = useState<XStatus>({ connected: false, username: null, name: null });
  const [resumeStatus, setResumeStatus] = useState<ResumeStatus>({
    exists: false,
    filename: 'Praroop_Anand.pdf',
    size_kb: 0,
    updated_at: null
  });

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Drawer state
  const [activeDrawerLead, setActiveDrawerLead] = useState<Lead | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false);
  
  // Compose state
  const [composeLead, setComposeLead] = useState<Lead | null>(null);
  const [composeChannel, setComposeChannel] = useState<'EMAIL' | 'X_DM'>('EMAIL');
  const [composeXHandle, setComposeXHandle] = useState('');
  const [composeTemplateId, setComposeTemplateId] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [attachResume, setAttachResume] = useState(true);
  const [enableUTMTracking, setEnableUTMTracking] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Lead Form state
  const [leadForm, setLeadForm] = useState({
    id: 0,
    first_name: '',
    last_name: '',
    email: '',
    x_handle: '',
    company: '',
    role: '',
    status: 'NOT_CONTACTED',
    custom_hook: '',
    notes: ''
  });

  // Template Builder Form state
  const [templateForm, setTemplateForm] = useState<{
    id: number;
    name: string;
    category: string;
    subject_template: string;
    body_template: string;
  }>({
    id: 0,
    name: '',
    category: 'Cold Outreach',
    subject_template: '',
    body_template: ''
  });
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState<Template | null>(null);

  // CSV Import State
  const [csvInput, setCsvInput] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch all live data
  const fetchData = useCallback(async () => {
    try {
      const [leadsRes, analyticsRes, templatesRes, xRes, resumeRes] = await Promise.all([
        fetch(`/api/leads?status=${statusFilter}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`),
        fetch('/api/analytics/overview'),
        fetch('/api/templates'),
        fetch('/api/auth/x/status'),
        fetch('/api/resume/status')
      ]);

      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (templatesRes.ok) setTemplates(await templatesRes.json());
      if (xRes.ok) setXStatus(await xRes.json());
      if (resumeRes.ok) setResumeStatus(await resumeRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Resume Upload Handler
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please select a valid PDF file', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      showToast(`Resume uploaded: ${data.filename} (${data.size_kb} KB)`);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Sync X DMs Handler
  const [isSyncingX, setIsSyncingX] = useState(false);
  const handleSyncXDMs = async () => {
    setIsSyncingX(true);
    try {
      const res = await fetch('/api/auth/x/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'X DM sync failed');
      showToast(data.message || 'X DMs synced!');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSyncingX(false);
    }
  };

  // Drawer Handler
  const openLeadDrawer = async (leadId: number) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) throw new Error('Could not fetch lead details');
      const data = await res.json();
      setActiveDrawerLead(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Compose Handlers
  const openCompose = (lead: Lead) => {
    setComposeLead(lead);
    setComposeXHandle(lead.x_handle || '');
    setComposeChannel('EMAIL');
    setAttachResume(true);
    setEnableUTMTracking(true);
    setComposeTemplateId(templates.length > 0 ? String(templates[0].id) : '');
    
    if (templates.length > 0) {
      applyTemplate(templates[0], lead);
    } else {
      setComposeSubject('');
      setComposeBody('');
    }
    setIsComposeModalOpen(true);
  };

  const applyTemplate = (tmpl: Template, lead: Lead) => {
    const replaceVars = (str: string) => {
      return str
        .replace(/\{\{\s*(firstName|first_name)\s*\}\}/gi, lead.first_name || (lead.email.split('@')[0]))
        .replace(/\{\{\s*(lastName|last_name)\s*\}\}/gi, lead.last_name || '')
        .replace(/\{\{\s*company\s*\}\}/gi, lead.company || 'your team')
        .replace(/\{\{\s*role\s*\}\}/gi, lead.role || 'team')
        .replace(/\{\{\s*custom_hook\s*\}\}/gi, lead.custom_hook || 'your recent work')
        .replace(/\{\{\s*email\s*\}\}/gi, lead.email || '')
        .replace(/\{\{\s*x_handle\s*\}\}/gi, lead.x_handle ? lead.x_handle.replace('@', '') : '');
    };
    setComposeSubject(replaceVars(tmpl.subject_template));
    setComposeBody(replaceVars(tmpl.body_template));
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setComposeTemplateId(id);
    if (!id || !composeLead) return;
    const tmpl = templates.find(t => String(t.id) === id);
    if (tmpl) applyTemplate(tmpl, composeLead);
  };

  const handleSendMessage = async () => {
    if (!composeLead || !composeBody.trim()) {
      showToast('Please enter your outreach message', 'error');
      return;
    }

    setIsSending(true);
    try {
      if (composeChannel === 'EMAIL') {
        if (!composeSubject.trim()) {
          showToast('Please provide an email subject', 'error');
          setIsSending(false);
          return;
        }

        const res = await fetch(`/api/leads/${composeLead.id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            subject: composeSubject, 
            body: composeBody,
            attach_resume: attachResume,
            enable_utm_tracking: enableUTMTracking
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Email failed to send');
        showToast(`Email sent with UTM tracking & ${attachResume ? 'Praroop_Anand.pdf' : 'no attachment'}`);
      } else {
        // X DM
        if (!composeXHandle.trim()) {
          showToast('Please provide a valid X handle', 'error');
          setIsSending(false);
          return;
        }
        if (!xStatus.connected) {
          showToast('Please connect your X account first', 'error');
          setIsSending(false);
          return;
        }

        const res = await fetch(`/api/auth/x/leads/${composeLead.id}/send-dm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: composeBody, x_handle: composeXHandle })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'X DM failed to send');
        showToast(`X DM sent to ${composeXHandle}`);
      }

      setIsComposeModalOpen(false);
      if (activeDrawerLead && activeDrawerLead.id === composeLead.id) {
        openLeadDrawer(composeLead.id);
      }
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Template Builder Handlers
  const openTemplateBuilder = (tmpl?: Template) => {
    if (tmpl) {
      setSelectedTemplateForEdit(tmpl);
      setTemplateForm({
        id: tmpl.id,
        name: tmpl.name,
        category: tmpl.category,
        subject_template: tmpl.subject_template,
        body_template: tmpl.body_template
      });
    } else {
      setSelectedTemplateForEdit(null);
      setTemplateForm({
        id: 0,
        name: '',
        category: 'Cold Outreach',
        subject_template: 'Building AI systems that work in production for {{company}}',
        body_template: 'Hi {{firstName}},\n\nI came across {{company}} and noticed your work on {{custom_hook}}.\n\nBest regards,\nPraroop Anand'
      });
    }
    setIsTemplateBuilderOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.body_template.trim()) {
      showToast('Template name and body are required', 'error');
      return;
    }

    try {
      let res;
      if (templateForm.id) {
        res = await fetch(`/api/templates/${templateForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateForm)
        });
      } else {
        res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateForm)
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save template');
      showToast(templateForm.id ? 'Template updated' : 'Template created');
      fetchData();
      setIsTemplateBuilderOpen(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
      showToast('Template deleted');
      fetchData();
      if (selectedTemplateForEdit?.id === id) {
        openTemplateBuilder();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const insertVariable = (variable: string, field: 'subject' | 'body') => {
    if (field === 'subject') {
      setTemplateForm(prev => ({
        ...prev,
        subject_template: `${prev.subject_template} {{${variable}}}`
      }));
    } else {
      setTemplateForm(prev => ({
        ...prev,
        body_template: `${prev.body_template} {{${variable}}}`
      }));
    }
  };

  // Lead CRUD
  const openNewLeadModal = () => {
    setLeadForm({
      id: 0,
      first_name: '',
      last_name: '',
      email: '',
      x_handle: '',
      company: '',
      role: '',
      status: 'NOT_CONTACTED',
      custom_hook: '',
      notes: ''
    });
    setIsLeadModalOpen(true);
  };

  const openEditLeadModal = (lead: Lead) => {
    setLeadForm({
      id: lead.id,
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      email: lead.email,
      x_handle: lead.x_handle || '',
      company: lead.company || '',
      role: lead.role || '',
      status: lead.status,
      custom_hook: lead.custom_hook || '',
      notes: lead.notes || ''
    });
    setIsLeadModalOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.email) {
      showToast('Email is required', 'error');
      return;
    }

    try {
      let res;
      if (leadForm.id) {
        res = await fetch(`/api/leads/${leadForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadForm)
        });
      } else {
        res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadForm)
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save contact');
      showToast(leadForm.id ? 'Contact updated' : 'Contact created');
      setIsLeadModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteLead = async (leadId: number) => {
    if (!confirm('Are you sure you want to delete this contact and all its message history?')) return;
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Contact deleted');
      if (activeDrawerLead?.id === leadId) setActiveDrawerLead(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // CSV Import File Handler
  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvInput(content);
        showToast(`Loaded ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  const handleImportCSV = async () => {
    if (!csvInput.trim()) {
      showToast('Please paste CSV data or upload a file', 'error');
      return;
    }
    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_data: csvInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Import failed');
      showToast(`Imported! ${data.stats?.created || 0} created, ${data.stats?.updated || 0} updated.`);
      setIsImportModalOpen(false);
      setCsvInput('');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONTACTED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'REPLIED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FOLLOWED_UP':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'INTERESTED':
        return 'bg-green-50 text-green-800 border-green-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded shadow-lg text-xs font-medium">
          {toastMessage.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Check className="w-4 h-4 text-emerald-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 mb-6 border-b border-gray-200 gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-gray-950">Outreach Engine</h1>
            <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded border border-gray-200 font-mono">
              anandpraroop@gmail.com
            </span>
            
            {/* Resume Upload Pill */}
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded border border-gray-200 text-xs">
              <Paperclip className="w-3.5 h-3.5 text-gray-500" />
              <span className="font-mono text-gray-800 text-[11px] font-medium">
                {resumeStatus.filename}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                ({resumeStatus.size_kb} KB)
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="ml-1 text-[11px] font-medium text-gray-900 hover:underline flex items-center gap-0.5"
                title="Upload updated PDF resume"
              >
                <Upload className="w-3 h-3 text-gray-700" />
                <span>Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleResumeUpload}
              />
            </div>

            {xStatus.connected && xStatus.username ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-700 bg-gray-50 px-2.5 py-1 rounded border border-gray-200 font-medium">
                  X: @{xStatus.username}
                </span>
                <button
                  onClick={handleSyncXDMs}
                  disabled={isSyncingX}
                  className="text-xs text-gray-700 hover:text-black bg-white hover:bg-gray-50 px-2.5 py-1 rounded border border-gray-300 font-medium transition flex items-center gap-1 disabled:opacity-60"
                  title="Sync outreach DMs from X (skipping friends)"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingX ? 'animate-spin' : ''}`} />
                  <span>{isSyncingX ? 'Syncing...' : 'Sync X DMs'}</span>
                </button>
              </div>
            ) : (
              <a
                href="/api/auth/x/login"
                className="text-xs text-gray-700 hover:text-black bg-white hover:bg-gray-50 px-2.5 py-1 rounded border border-gray-300 font-medium transition"
              >
                Connect X
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openTemplateBuilder()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Templates</span>
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import Sheet / CSV</span>
            </button>
            <button
              onClick={openNewLeadModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-black transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Contact</span>
            </button>
          </div>
        </header>

        {/* KPI Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded border border-gray-200">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Prospects</div>
            <div className="text-2xl font-semibold text-gray-950 mt-1">{analytics.total_leads}</div>
            <div className="text-xs text-gray-400 mt-0.5">in pipeline</div>
          </div>
          <div className="bg-white p-4 rounded border border-gray-200">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contacted</div>
            <div className="text-2xl font-semibold text-gray-950 mt-1">{analytics.contacted_count}</div>
            <div className="text-xs text-gray-400 mt-0.5">{analytics.total_sent_emails} sent messages</div>
          </div>
          <div className="bg-white p-4 rounded border border-gray-200">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Replies Received</div>
            <div className="text-2xl font-semibold text-gray-950 mt-1">{analytics.replied_count}</div>
            <div className="text-xs text-gray-400 mt-0.5">{analytics.reply_rate}% reply rate</div>
          </div>
          <div className="bg-white p-4 rounded border border-gray-200">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Follow-up Due</div>
            <div className="text-2xl font-semibold text-gray-950 mt-1">{analytics.follow_up_needed}</div>
            <div className="text-xs text-gray-400 mt-0.5">&gt; 3 days since contact</div>
          </div>
        </section>

        {/* Controls Bar & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="inline-flex bg-gray-100 p-0.5 rounded border border-gray-200 text-xs font-medium">
            {['ALL', 'NOT_CONTACTED', 'CONTACTED', 'REPLIED', 'FOLLOWED_UP'].map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded transition ${
                  statusFilter === tab
                    ? 'bg-white text-gray-950 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'ALL' ? 'All' : tab.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name, company, email, X..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:border-gray-900 transition"
            />
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Name & Title</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Email & X Handle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Contacted</th>
                  <th className="px-4 py-3">Messages</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">
                      Loading outreach contacts...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      No contacts found in this view.
                    </td>
                  </tr>
                ) : (
                  leads.map(lead => {
                    const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'No Name';
                    const lastContactedStr = lead.last_contacted_at
                      ? new Date(lead.last_contacted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '—';

                    return (
                      <tr key={lead.id} className="hover:bg-gray-50/60 transition">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{fullName}</div>
                          <div className="text-gray-500 text-[11px]">{lead.role || '—'}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {lead.company || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 font-mono text-[11px]">{lead.email}</div>
                          {lead.x_handle && (
                            <div className="text-blue-600 font-mono text-[10px] mt-0.5">
                              X: {lead.x_handle}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadge(lead.status)}`}>
                            {lead.status.replace('_', ' ').toLowerCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {lastContactedStr}
                        </td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-[11px]">
                          {lead.message_count || 0} msgs
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openLeadDrawer(lead.id)}
                              className="px-2.5 py-1 text-[11px] font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
                            >
                              History
                            </button>
                            <button
                              onClick={() => openCompose(lead)}
                              className="px-2.5 py-1 text-[11px] font-medium text-white bg-gray-900 rounded hover:bg-black transition"
                            >
                              Message
                            </button>
                            <button
                              onClick={() => openEditLeadModal(lead)}
                              className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded hover:bg-gray-50 transition"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="px-2 py-1 text-[11px] text-red-600 hover:text-red-800 bg-white border border-red-200 rounded hover:bg-red-50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Slide-over Drawer for Contact & History */}
      {activeDrawerLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setActiveDrawerLead(null)}>
          <div 
            className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-950">
                  {`${activeDrawerLead.first_name || ''} ${activeDrawerLead.last_name || ''}`.trim() || 'Contact Details'}
                </h2>
                <div className="text-xs text-gray-500">
                  {activeDrawerLead.role || 'No Role'} &bull; {activeDrawerLead.company || 'No Company'}
                </div>
              </div>
              <button 
                onClick={() => setActiveDrawerLead(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Meta information */}
              <div className="bg-gray-50 p-4 rounded border border-gray-200 text-xs space-y-2">
                <div className="flex">
                  <span className="w-24 text-gray-500">Email:</span>
                  <span className="font-mono text-gray-900">{activeDrawerLead.email}</span>
                </div>
                {activeDrawerLead.x_handle && (
                  <div className="flex">
                    <span className="w-24 text-gray-500">X Handle:</span>
                    <span className="font-mono text-blue-600">{activeDrawerLead.x_handle}</span>
                  </div>
                )}
                <div className="flex">
                  <span className="w-24 text-gray-500">Status:</span>
                  <span className={`inline-flex px-2 py-0.2 rounded text-[10px] font-medium border ${getStatusBadge(activeDrawerLead.status)}`}>
                    {activeDrawerLead.status.replace('_', ' ').toLowerCase()}
                  </span>
                </div>
                {activeDrawerLead.custom_hook && (
                  <div className="flex">
                    <span className="w-24 text-gray-500">Custom Hook:</span>
                    <span className="text-gray-800">{activeDrawerLead.custom_hook}</span>
                  </div>
                )}
                {activeDrawerLead.notes && (
                  <div className="flex">
                    <span className="w-24 text-gray-500">Notes:</span>
                    <span className="text-gray-800">{activeDrawerLead.notes}</span>
                  </div>
                )}
              </div>

              {/* Clicks tracking section */}
              {activeDrawerLead.clicks && activeDrawerLead.clicks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <MousePointerClick className="w-3.5 h-3.5 text-blue-600" />
                      <span>Link Clicks ({activeDrawerLead.clicks.length})</span>
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {activeDrawerLead.clicks.map(c => (
                      <div key={c.id} className="p-2.5 rounded bg-blue-50/50 border border-blue-200 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-gray-600 mb-0.5">
                          <span className="font-medium text-gray-900 truncate max-w-xs">{c.target_url}</span>
                          <span className="text-[10px] text-gray-500">{new Date(c.clicked_at).toLocaleString()}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          utm_campaign: {c.utm_campaign || 'outreach'} &bull; content: {c.utm_content || 'prospect'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message History */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Message History ({activeDrawerLead.messages?.length || 0})
                  </h3>
                  <button
                    onClick={() => openCompose(activeDrawerLead)}
                    className="px-3 py-1 text-xs font-medium text-white bg-gray-900 rounded hover:bg-black transition"
                  >
                    Send Message
                  </button>
                </div>

                <div className="space-y-3">
                  {!activeDrawerLead.messages || activeDrawerLead.messages.length === 0 ? (
                    <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 rounded">
                      No messages exchanged yet.
                    </div>
                  ) : (
                    activeDrawerLead.messages.map(msg => {
                      const isSent = msg.direction === 'SENT';
                      const isXDM = msg.channel === 'X_DM';
                      return (
                        <div
                          key={msg.id}
                          className={`p-3.5 rounded border text-xs ${
                            isSent ? 'bg-white border-gray-200 border-l-2 border-l-gray-900' : 'bg-emerald-50/50 border-emerald-200 border-l-2 border-l-emerald-600'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                            <span className="font-medium text-gray-800">
                              {isSent ? 'Sent to: ' : 'From: '} {isSent ? msg.recipient : msg.sender} ({isXDM ? 'X DM' : 'Email'})
                            </span>
                            <span>{new Date(msg.sent_at).toLocaleString()}</span>
                          </div>
                          <div className="font-semibold text-gray-950 mb-1.5">{msg.subject}</div>
                          <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {msg.body_text || msg.snippet}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Channel Compose Modal */}
      {isComposeModalOpen && composeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg border border-gray-200 max-w-xl w-full shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-950">Send Outreach</h3>
              <button onClick={() => setIsComposeModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Channel Selector */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComposeChannel('EMAIL')}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                    composeChannel === 'EMAIL'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Email (Gmail)
                </button>
                <button
                  type="button"
                  onClick={() => setComposeChannel('X_DM')}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                    composeChannel === 'X_DM'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  X Direct Message
                </button>
              </div>

              {/* Recipient info */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {composeChannel === 'EMAIL' ? 'Recipient Email' : 'Email on File'}
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${composeLead.first_name || ''} <${composeLead.email}>`}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded text-gray-600 font-mono"
                />
              </div>

              {composeChannel === 'X_DM' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Target X Handle (Username without @ or URL)
                  </label>
                  <input
                    type="text"
                    value={composeXHandle}
                    onChange={e => setComposeXHandle(e.target.value)}
                    placeholder="e.g. jerry_ai"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900 font-mono"
                  />
                </div>
              )}

              {/* Template selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Choose Template</label>
                <select
                  value={composeTemplateId}
                  onChange={handleTemplateChange}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                >
                  <option value="">-- Custom Outreach --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
              </div>

              {composeChannel === 'EMAIL' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    placeholder="Email subject..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {composeChannel === 'EMAIL' ? 'Message Body' : 'Direct Message Pitch'}
                </label>
                <textarea
                  rows={7}
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  placeholder="Write your outreach message..."
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900 leading-relaxed font-sans"
                />
              </div>

              {/* Options */}
              {composeChannel === 'EMAIL' && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="attach-resume-check"
                      checked={attachResume}
                      onChange={e => setAttachResume(e.target.checked)}
                      className="rounded border-gray-300 text-gray-900 focus:ring-0 w-3.5 h-3.5"
                    />
                    <label htmlFor="attach-resume-check" className="text-xs text-gray-700 font-medium flex items-center gap-1 cursor-pointer">
                      <Paperclip className="w-3 h-3 text-gray-500" />
                      <span>Attach Resume (Praroop_Anand.pdf)</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="utm-tracking-check"
                      checked={enableUTMTracking}
                      onChange={e => setEnableUTMTracking(e.target.checked)}
                      className="rounded border-gray-300 text-gray-900 focus:ring-0 w-3.5 h-3.5"
                    />
                    <label htmlFor="utm-tracking-check" className="text-xs text-gray-700 font-medium flex items-center gap-1 cursor-pointer">
                      <Sparkles className="w-3 h-3 text-gray-500" />
                      <span>Disguise links with UTM parameters (utm_source=outreach&utm_campaign=...)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsComposeModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={handleSendMessage}
                className="px-4 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-black disabled:opacity-60 transition"
              >
                {isSending ? 'Sending...' : composeChannel === 'EMAIL' ? 'Send via Gmail' : 'Send via X'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Builder & Manager Modal */}
      {isTemplateBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg border border-gray-200 max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-gray-900" />
                <h3 className="text-sm font-semibold text-gray-950">Outreach Template Builder</h3>
              </div>
              <button onClick={() => setIsTemplateBuilderOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 flex-1 overflow-hidden">
              
              {/* Templates List Column */}
              <div className="p-4 overflow-y-auto space-y-2 bg-gray-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider">Templates</span>
                  <button
                    onClick={() => openTemplateBuilder()}
                    className="text-[11px] font-medium text-gray-900 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> New
                  </button>
                </div>

                {templates.map(tmpl => (
                  <div
                    key={tmpl.id}
                    onClick={() => openTemplateBuilder(tmpl)}
                    className={`p-3 rounded border cursor-pointer transition text-xs ${
                      templateForm.id === tmpl.id
                        ? 'bg-white border-gray-900 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-semibold text-gray-900 truncate">{tmpl.name}</div>
                    <div className="text-[10px] text-gray-500 mt-1 flex items-center justify-between">
                      <span>{tmpl.category}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(tmpl.id);
                        }}
                        className="text-red-500 hover:text-red-700"
                        title="Delete template"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Template Editor Form Column */}
              <div className="p-5 md:col-span-2 overflow-y-auto space-y-4">
                <form onSubmit={handleSaveTemplate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Template Name</label>
                      <input
                        type="text"
                        required
                        value={templateForm.name}
                        onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                        placeholder="e.g. AI Production Systems Pitch"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={templateForm.category}
                        onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                      >
                        <option value="Cold Outreach">Cold Outreach</option>
                        <option value="Follow-up">Follow-up</option>
                        <option value="X Direct Message">X Direct Message</option>
                        <option value="Partnership">Partnership</option>
                      </select>
                    </div>
                  </div>

                  {/* Variable Helper Chips */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                      Insert Placeholders (Click to Add)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {['firstName', 'company', 'role', 'custom_hook', 'email', 'x_handle'].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertVariable(v, 'body')}
                          className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-mono text-[10px] border border-gray-300 transition"
                        >
                          +{`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Subject Template</label>
                    <input
                      type="text"
                      value={templateForm.subject_template}
                      onChange={e => setTemplateForm({ ...templateForm, subject_template: e.target.value })}
                      placeholder="e.g. Building AI systems that work in production for {{company}}"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900 font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Body Template</label>
                    <textarea
                      rows={9}
                      required
                      value={templateForm.body_template}
                      onChange={e => setTemplateForm({ ...templateForm, body_template: e.target.value })}
                      placeholder="Write your genuine, professional outreach copy..."
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900 leading-relaxed font-sans"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsTemplateBuilderOpen(false)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-black transition"
                    >
                      Save Template
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Lead Modal */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg border border-gray-200 max-w-lg w-full shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-950">
                {leadForm.id ? 'Edit Contact' : 'Add New Contact'}
              </h3>
              <button onClick={() => setIsLeadModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLead}>
              <div className="p-5 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={leadForm.first_name}
                      onChange={e => setLeadForm({ ...leadForm, first_name: e.target.value })}
                      placeholder="Alex"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={leadForm.last_name}
                      onChange={e => setLeadForm({ ...leadForm, last_name: e.target.value })}
                      placeholder="Smith"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={leadForm.email}
                      onChange={e => setLeadForm({ ...leadForm, email: e.target.value })}
                      placeholder="alex@company.com"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">X Handle</label>
                    <input
                      type="text"
                      value={leadForm.x_handle}
                      onChange={e => setLeadForm({ ...leadForm, x_handle: e.target.value })}
                      placeholder="@alex_ai"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                    <input
                      type="text"
                      value={leadForm.company}
                      onChange={e => setLeadForm({ ...leadForm, company: e.target.value })}
                      placeholder="Acme AI"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                    <input
                      type="text"
                      value={leadForm.role}
                      onChange={e => setLeadForm({ ...leadForm, role: e.target.value })}
                      placeholder="Founder / CTO"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={leadForm.status}
                    onChange={e => setLeadForm({ ...leadForm, status: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                  >
                    <option value="NOT_CONTACTED">Not Contacted</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="FOLLOWED_UP">Followed Up</option>
                    <option value="REPLIED">Replied</option>
                    <option value="INTERESTED">Interested</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Custom Hook / Icebreaker</label>
                  <input
                    type="text"
                    value={leadForm.custom_hook}
                    onChange={e => setLeadForm({ ...leadForm, custom_hook: e.target.value })}
                    placeholder="your recent funding round / blog on agent memory"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={leadForm.notes}
                    onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })}
                    placeholder="Context, background, mutual connections..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900"
                  />
                </div>
              </div>

              <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLeadModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-black transition"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg border border-gray-200 max-w-lg w-full shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-950">Import Leads from Google Sheet / CSV</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Paste CSV data or upload a file. Auto-detects <strong>Email, Name, Company, Role, X Handle, Custom Hook, Notes</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => csvFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-gray-800 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition shrink-0 ml-2"
                >
                  <Upload className="w-3 h-3 text-gray-600" />
                  <span>Upload CSV</span>
                </button>
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleCSVFileChange}
                />
              </div>

              <div>
                <textarea
                  rows={8}
                  value={csvInput}
                  onChange={e => setCsvInput(e.target.value)}
                  placeholder={`Name, Company, Email, X Handle, Role, Custom Hook\nJerry, Lemma AI, jerry@uselemma.ai, @jerry_lemma, Founder, your production agent framework\nDavid, Xpander AI, david@xpander.ai, @david_xpander, CEO, reliable agent infrastructure`}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-900 font-mono leading-relaxed"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCSV}
                className="px-4 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-black transition"
              >
                Import Leads
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
