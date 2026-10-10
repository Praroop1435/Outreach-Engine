"use client";

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
  Activity,
  Globe,
  Bell,
  RefreshCw,
  Users,
  Clock,
  ChevronRight,
  Copy,
  CheckCircle2,
  Inbox,
  ArrowUpRight,
  Eye,
  Filter
} from 'lucide-react';

interface ProspectReply {
  id: number;
  lead_id?: number;
  sender: string;
  recipient: string;
  subject: string;
  snippet?: string;
  sent_at: string;
  lead_name?: string;
  lead_company?: string;
  lead_email?: string;
  lead_status?: string;
}

interface EmailMessage {
  id: number;
  lead_id: number;
  message_id?: string;
  thread_id?: string;
  channel: 'EMAIL' | 'X_DM' | 'LINKEDIN_CONNECT' | 'LINKEDIN_DM';
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
  lead_name?: string;
  lead_company?: string;
  lead_email?: string;
  target_url: string;
  utm_source: string;
  utm_campaign?: string;
  utm_content?: string;
  clicked_at: string;
  ip_address?: string;
  user_agent?: string;
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
  bounced_count?: number;
  follow_up_needed: number;
  total_sent_emails: number;
  total_received_emails: number;
  total_link_clicks: number;
  reply_rate: number;
}

interface ResumeStatus {
  exists: boolean;
  filename: string;
  size_kb: number;
  updated_at: string | null;
}

const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://outreach-engine-h5lx.onrender.com").replace(/\/$/, "");

// Resilient API Fetch Helper that works across Vercel and Render
async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BACKEND_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  return fetch(url, options);
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
    bounced_count: 0,
    follow_up_needed: 0,
    total_sent_emails: 0,
    total_received_emails: 0,
    total_link_clicks: 0,
    reply_rate: 0
  });

  const [resumeStatus, setResumeStatus] = useState<ResumeStatus>({
    exists: true,
    filename: 'Praroop_Anand.pdf',
    size_kb: 102,
    updated_at: null
  });

  const [replies, setReplies] = useState<ProspectReply[]>([]);
  const [isRepliesModalOpen, setIsRepliesModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingMailbox, setIsSyncingMailbox] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Drawers and Modals
  const [activeDrawerLead, setActiveDrawerLead] = useState<Lead | null>(null);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Link Clicks Modal
  const [isClicksModalOpen, setIsClicksModalOpen] = useState(false);
  const [clicksData, setClicksData] = useState<LinkClick[]>([]);
  const [isLoadingClicks, setIsLoadingClicks] = useState(false);
  const [clicksModalLeadId, setClicksModalLeadId] = useState<number | null>(null);

  // Compose State
  const [composeLead, setComposeLead] = useState<Lead | null>(null);
  const [composeTemplateId, setComposeTemplateId] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [attachResume, setAttachResume] = useState(true);
  const [enableUTMTracking, setEnableUTMTracking] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
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
  const [isImporting, setIsImporting] = useState(false);
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
      const [leadsRes, analyticsRes, templatesRes, resumeRes, repliesRes] = await Promise.all([
        apiFetch(`/api/leads?status=${statusFilter}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`),
        apiFetch('/api/analytics/overview'),
        apiFetch('/api/templates'),
        apiFetch('/api/resume/status'),
        apiFetch('/api/analytics/replies')
      ]);

      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (templatesRes.ok) setTemplates(await templatesRes.json());
      if (resumeRes.ok) setResumeStatus(await resumeRes.json());
      if (repliesRes.ok) setReplies(await repliesRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  const handleManualSyncMailbox = async () => {
    setIsSyncingMailbox(true);
    try {
      const res = await apiFetch('/api/sync/mailbox', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Mailbox sync failed');
      showToast(`Mailbox sync complete! ${data.stats?.received || 0} messages synced.`);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSyncingMailbox(false);
    }
  };

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
      const res = await apiFetch('/api/resume/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Resume upload failed');
      showToast('Resume uploaded and verified successfully');
      setResumeStatus({
        exists: true,
        filename: data.filename || file.name,
        size_kb: data.size_kb || Math.round(file.size / 1024),
        updated_at: new Date().toISOString()
      });
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open Clicks Pop-up Modal
  const openClicksModal = async (leadId: number | null = null) => {
    setClicksModalLeadId(leadId);
    setIsLoadingClicks(true);
    setIsClicksModalOpen(true);
    try {
      const url = leadId ? `/api/analytics/clicks?lead_id=${leadId}` : '/api/analytics/clicks';
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Failed to fetch link clicks');
      const data = await res.json();
      setClicksData(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsLoadingClicks(false);
    }
  };

  // Drawer Handler
  const openLeadDrawer = async (leadId: number) => {
    try {
      const res = await apiFetch(`/api/leads/${leadId}`);
      if (!res.ok) throw new Error('Failed to load contact details');
      const data = await res.json();
      setActiveDrawerLead(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Compose Modal Handlers
  const openCompose = (lead: Lead) => {
    setComposeLead(lead);
    setIsPreviewMode(false);
    
    // Choose sensible default template or custom
    const defaultTemplate = templates.find(t => t.name.includes('Grounded') || t.name.includes('AI Startup')) || templates[0];
    if (defaultTemplate) {
      setComposeTemplateId(String(defaultTemplate.id));
      applyTemplateText(defaultTemplate, lead);
    } else {
      setComposeTemplateId('');
      setComposeSubject(`Engineering & AI systems for ${lead.company || 'your team'}: Praroop Anand`);
      setComposeBody(
        `Hi ${lead.first_name || 'there'},\n\n` +
        `I noticed what you are building at ${lead.company || 'your company'}${lead.custom_hook ? ` regarding ${lead.custom_hook}` : ''}.\n\n` +
        `I am a full-stack engineer and AI developer (FastAPI, Next.js, PostgreSQL, Redis, Docker). Right now at Relu Consultancy, I build production AI workflows and scalable backend pipelines for real client workloads.\n\n` +
        `Portfolio: https://praroop.site\nGitHub: https://github.com/Praroop1435\n\n` +
        `My resume is attached for quick reference. If you have an active problem or upcoming pipeline on your roadmap, I would be glad to build a working prototype to demonstrate my approach.\n\n` +
        `Best regards,\nPraroop Anand`
      );
    }
    setIsComposeModalOpen(true);
  };

  const applyTemplateText = (tpl: Template, lead: Lead) => {
    const fn = lead.first_name || 'there';
    const comp = lead.company || 'your team';
    const hook = lead.custom_hook || 'your technology roadmap';
    const role = lead.role || 'Full-Stack Engineer';

    let subj = tpl.subject_template
      .replace(/{{firstName}}/gi, fn)
      .replace(/{{first_name}}/gi, fn)
      .replace(/{{company}}/gi, comp)
      .replace(/{{role}}/gi, role)
      .replace(/{{custom_hook}}/gi, hook);

    let body = tpl.body_template
      .replace(/{{firstName}}/gi, fn)
      .replace(/{{first_name}}/gi, fn)
      .replace(/{{company}}/gi, comp)
      .replace(/{{role}}/gi, role)
      .replace(/{{custom_hook}}/gi, hook);

    setComposeSubject(subj);
    setComposeBody(body);
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setComposeTemplateId(val);
    if (!val || !composeLead) return;
    const tpl = templates.find(t => String(t.id) === val);
    if (tpl) {
      applyTemplateText(tpl, composeLead);
    }
  };

  const insertVariableToken = (token: string) => {
    setComposeBody(prev => prev + ` ${token} `);
  };

  const handleSendEmail = async () => {
    if (!composeLead) return;
    if (!composeSubject.trim()) {
      showToast('Please enter an email subject line', 'error');
      return;
    }
    if (!composeBody.trim()) {
      showToast('Please enter your outreach message', 'error');
      return;
    }

    setIsSending(true);
    try {
      const res = await apiFetch(`/api/leads/${composeLead.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: composeSubject,
          body_text: composeBody,
          attach_resume: attachResume,
          enable_tracking: enableUTMTracking,
          template_id: composeTemplateId ? parseInt(composeTemplateId) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Dispatch failed');

      showToast(`Email dispatched to ${composeLead.email}!`);
      setIsComposeModalOpen(false);
      fetchData();
      if (activeDrawerLead && activeDrawerLead.id === composeLead.id) {
        openLeadDrawer(composeLead.id);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Template Form Handlers
  const openTemplateBuilder = (tpl: Template | null = null) => {
    if (tpl) {
      setSelectedTemplateForEdit(tpl);
      setTemplateForm({
        id: tpl.id,
        name: tpl.name,
        category: tpl.category,
        subject_template: tpl.subject_template,
        body_template: tpl.body_template
      });
    } else {
      setSelectedTemplateForEdit(null);
      setTemplateForm({
        id: 0,
        name: '',
        category: 'Cold Outreach',
        subject_template: '',
        body_template: ''
      });
    }
    setIsTemplateBuilderOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.subject_template.trim() || !templateForm.body_template.trim()) {
      showToast('All template fields are required', 'error');
      return;
    }

    try {
      let res;
      if (templateForm.id) {
        res = await apiFetch(`/api/templates/${templateForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateForm)
        });
      } else {
        res = await apiFetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateForm)
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to save template');
      }

      showToast(`Template "${templateForm.name}" saved!`);
      setIsTemplateBuilderOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await apiFetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
      showToast('Template deleted');
      fetchData();
      if (templateForm.id === id) {
        openTemplateBuilder(null);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Add / Edit Lead Handlers
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
      status: lead.status || 'NOT_CONTACTED',
      custom_hook: lead.custom_hook || '',
      notes: lead.notes || ''
    });
    setIsLeadModalOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.email.trim()) {
      showToast('Contact email is required', 'error');
      return;
    }

    try {
      let res;
      if (leadForm.id) {
        res = await apiFetch(`/api/leads/${leadForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadForm)
        });
      } else {
        res = await apiFetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadForm)
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save contact');

      showToast(`Contact ${leadForm.email} saved successfully!`);
      setIsLeadModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteLead = async (leadId: number) => {
    if (!confirm('Delete this contact permanently?')) return;
    try {
      const res = await apiFetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete contact');
      showToast('Contact deleted');
      if (activeDrawerLead?.id === leadId) setActiveDrawerLead(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // CSV Import Handlers
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      setCsvInput(String(evt.target?.result || ''));
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (!csvInput.trim()) {
      showToast('Please upload a file or paste CSV content', 'error');
      return;
    }

    setIsImporting(true);
    try {
      const res = await apiFetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_content: csvInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Import failed');

      showToast(`Imported ${data.created || 0} new contacts (${data.skipped || 0} skipped).`);
      setIsImportModalOpen(false);
      setCsvInput('');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // Helper Badge Colors in Ocean Palette
  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'CONTACTED':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'REPLIED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'INTERESTED':
        return 'bg-teal-50 text-teal-700 border-teal-200 font-bold';
      case 'FOLLOWED_UP':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'BOUNCED':
      case 'INVALID_EMAIL':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const filterTabs = [
    { id: 'ALL', label: 'All', count: analytics.total_leads },
    { id: 'NOT_CONTACTED', label: 'Not Contacted', count: analytics.not_contacted_count },
    { id: 'CONTACTED', label: 'Contacted', count: analytics.contacted_count },
    { id: 'REPLIED', label: 'Replied', count: analytics.replied_count },
    { id: 'FOLLOWED_UP', label: 'Followed Up', count: analytics.follow_up_needed },
    { id: 'BOUNCED', label: 'Bounced', count: analytics.bounced_count || 0 }
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans antialiased">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${
          toastMessage.type === 'error'
            ? 'bg-rose-950 text-rose-100 border-rose-800'
            : 'bg-slate-900 text-slate-100 border-slate-800 shadow-sky-500/10'
        }`}>
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Top Header */}
        <header className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5">
              <img 
                src="/icon.svg" 
                alt="Outreach Engine Logo" 
                className="w-8 h-8 rounded-lg drop-shadow-xs hover:scale-105 transition-transform" 
              />
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-950 flex items-center gap-2">
                  <span>outreach engine</span>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
                    Neon Postgres
                  </span>
                </h1>
              </div>
            </div>

            <span className="text-xs text-sky-900 bg-sky-50/80 px-2.5 py-1 rounded-lg border border-sky-200 font-mono">
              anandpraroop@gmail.com
            </span>
            
            {/* Resume Upload Pill */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
              <Paperclip className="w-3.5 h-3.5 text-sky-600" />
              <span className="font-mono text-slate-800 text-[11px] font-medium truncate max-w-[140px]">
                {resumeStatus.filename}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({resumeStatus.size_kb} KB)
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ml-1 text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-0.5"
                title="Upload updated PDF resume"
              >
                <Upload className="w-3 h-3" />
                <span>Update</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleResumeUpload}
              />
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sync Mailbox Button */}
            <button
              type="button"
              onClick={handleManualSyncMailbox}
              disabled={isSyncingMailbox}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-sky-50/50 hover:border-sky-300 hover:text-sky-700 transition disabled:opacity-60 shadow-2xs"
              title="Poll Gmail IMAP for new prospect replies"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isSyncingMailbox ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncingMailbox ? 'Checking...' : 'Sync Inbox'}</span>
            </button>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setIsRepliesModalOpen(true)}
              className="relative p-2 text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-sky-50/50 hover:border-sky-300 transition shadow-2xs"
              title="Prospect Replies & Inbound Notifications"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              {replies.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-sky-600 text-white font-mono text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center font-bold shadow-xs">
                  {replies.length}
                </span>
              )}
            </button>

            {/* Templates Button */}
            <button
              type="button"
              onClick={() => openTemplateBuilder()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-sky-50/50 hover:border-sky-300 hover:text-sky-700 transition shadow-2xs"
            >
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <span>Templates</span>
            </button>

            {/* Import CSV Button */}
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-sky-50/50 hover:border-sky-300 hover:text-sky-700 transition shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" />
              <span>Import Sheet</span>
            </button>

            {/* Add Contact Primary Button */}
            <button
              type="button"
              onClick={openNewLeadModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl shadow-xs shadow-sky-500/25 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Contact</span>
            </button>
          </div>
        </header>

        {/* Interactive KPI Metrics Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Prospects */}
          <div 
            onClick={() => setStatusFilter('ALL')}
            className={`bg-white p-4 sm:p-5 rounded-2xl border transition cursor-pointer group shadow-xs ${
              statusFilter === 'ALL' ? 'border-sky-400 ring-2 ring-sky-500/10' : 'border-slate-200/80 hover:border-sky-300'
            }`}
            title="Click to view all prospects"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Prospects</span>
              <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600 group-hover:scale-105 transition">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-950 mt-2">
              {analytics.total_leads}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>in pipeline</span>
              <span className="text-sky-600 font-medium text-[11px] group-hover:underline">Filter &rarr;</span>
            </div>
          </div>

          {/* Card 2: Contacted */}
          <div 
            onClick={() => setStatusFilter('CONTACTED')}
            className={`bg-white p-4 sm:p-5 rounded-2xl border transition cursor-pointer group shadow-xs ${
              statusFilter === 'CONTACTED' ? 'border-sky-400 ring-2 ring-sky-500/10' : 'border-slate-200/80 hover:border-sky-300'
            }`}
            title="Click to filter contacted prospects"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contacted</span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:scale-105 transition">
                <Send className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-950 mt-2">
              {analytics.contacted_count}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>{analytics.total_sent_emails} sent messages</span>
              <span className="text-sky-600 font-medium text-[11px] group-hover:underline">Filter &rarr;</span>
            </div>
          </div>

          {/* Card 3: Link Clicks Activity */}
          <div 
            onClick={() => openClicksModal(null)}
            className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 hover:border-sky-300 transition cursor-pointer group shadow-xs"
            title="Click to inspect real-time link click logs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Link Clicks</span>
              <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600 group-hover:scale-105 transition">
                <MousePointerClick className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-950 mt-2 flex items-baseline gap-2">
              <span>{analytics.total_link_clicks}</span>
              <span className="text-xs text-sky-600 font-semibold group-hover:underline">View Log &rarr;</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              tracked portfolio & demo links
            </div>
          </div>

          {/* Card 4: Follow-up Due */}
          <div 
            onClick={() => setStatusFilter('FOLLOWED_UP')}
            className={`bg-white p-4 sm:p-5 rounded-2xl border transition cursor-pointer group shadow-xs ${
              statusFilter === 'FOLLOWED_UP' ? 'border-sky-400 ring-2 ring-sky-500/10' : 'border-slate-200/80 hover:border-sky-300'
            }`}
            title="Click to filter follow-ups"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Follow-up Due</span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 group-hover:scale-105 transition">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-950 mt-2">
              {analytics.follow_up_needed}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>&gt; 3 days since contact</span>
              <span className="text-sky-600 font-medium text-[11px] group-hover:underline">Filter &rarr;</span>
            </div>
          </div>
        </section>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Status Tabs */}
          <div className="inline-flex flex-wrap bg-white p-1 rounded-xl border border-slate-200 shadow-2xs gap-1">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name, company, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Prospect Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Name & Role</th>
                  <th className="px-4 py-3.5">Company</th>
                  <th className="px-4 py-3.5">Email & Handle</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Link Clicks</th>
                  <th className="px-4 py-3.5">Last Contacted</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-500 mb-2" />
                      <span>Loading outreach contacts...</span>
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                      <Inbox className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700 text-sm">No contacts found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try adjusting your filters or import your target outreach list.
                      </p>
                    </td>
                  </tr>
                ) : (
                  leads.map(lead => {
                    const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'No Name';
                    const lastContactedStr = lead.last_contacted_at
                      ? new Date(lead.last_contacted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '-';
                    const clicksCount = lead.click_count || 0;

                    return (
                      <tr 
                        key={lead.id} 
                        onClick={() => openLeadDrawer(lead.id)}
                        className="hover:bg-sky-50/30 transition cursor-pointer group"
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900 group-hover:text-sky-700 transition">
                            {fullName}
                          </div>
                          <div className="text-slate-400 text-[11px] truncate max-w-[200px]">
                            {lead.role || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-800">
                          {lead.company || '-'}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-mono text-[11px] text-slate-700">
                            {lead.email}
                          </div>
                          {lead.x_handle && (
                            <div className="text-sky-600 font-mono text-[10px] mt-0.5">
                              X: {lead.x_handle}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getStatusBadge(lead.status)}`}>
                            {lead.status.replace('_', ' ').toLowerCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openClicksModal(lead.id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition ${
                              clicksCount > 0
                                ? 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title="Inspect links clicked by this prospect"
                          >
                            <MousePointerClick className="w-3 h-3 text-sky-600" />
                            <span>{clicksCount} {clicksCount === 1 ? 'click' : 'clicks'}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                          {lastContactedStr}
                        </td>
                        <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openLeadDrawer(lead.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-sky-50/50 hover:border-sky-300 hover:text-sky-700 transition"
                            >
                              History
                            </button>
                            <button
                              type="button"
                              onClick={() => openCompose(lead)}
                              className="px-3 py-1 text-[11px] font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-lg shadow-2xs transition"
                            >
                              Message
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditLeadModal(lead)}
                              className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50/50 rounded-lg transition"
                              title="Edit contact details"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition"
                              title="Delete contact"
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

      {/* Prospect Replies & Inbox Modal */}
      {isRepliesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-600" />
                <h3 className="font-bold text-sm text-slate-950">Inbound Replies & Notifications</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                  {replies.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualSyncMailbox}
                  disabled={isSyncingMailbox}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-sky-50/50 disabled:opacity-60 transition"
                >
                  <RefreshCw className={`w-3 h-3 text-sky-600 ${isSyncingMailbox ? 'animate-spin' : ''}`} />
                  <span>{isSyncingMailbox ? 'Checking...' : 'Check Inbox'}</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setIsRepliesModalOpen(false)} 
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {replies.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl p-6">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800">No prospect replies yet</p>
                  <p className="text-slate-400 mt-1 text-[11px]">
                    The keepalive worker checks Gmail IMAP for new replies every 10 minutes.
                  </p>
                </div>
              ) : (
                replies.map(r => (
                  <div 
                    key={r.id} 
                    className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-sky-400 text-xs space-y-2 transition cursor-pointer group"
                    onClick={() => {
                      if (r.lead_id) openLeadDrawer(r.lead_id);
                      setIsRepliesModalOpen(false);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-900 group-hover:text-sky-700 transition">
                        {r.lead_name || r.sender}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {r.sent_at ? new Date(r.sent_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <div className="font-medium text-slate-800 text-[11px]">
                      {r.subject}
                    </div>
                    {r.snippet && (
                      <p className="text-slate-600 text-[11px] line-clamp-2 bg-slate-50 p-2 rounded-lg font-sans">
                        {r.snippet}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>{r.lead_company || 'Lead'}</span>
                      <span className="text-sky-600 font-semibold group-hover:underline flex items-center gap-0.5">
                        Open Thread <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/80 flex justify-end">
              <button
                type="button"
                onClick={() => setIsRepliesModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Drawer for Contact & History */}
      {activeDrawerLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-2xs" onClick={() => setActiveDrawerLead(null)}>
          <div 
            className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div>
                <h2 className="text-base font-bold text-slate-950">
                  {`${activeDrawerLead.first_name || ''} ${activeDrawerLead.last_name || ''}`.trim() || 'Contact Details'}
                </h2>
                <div className="text-xs text-slate-500 font-medium">
                  {activeDrawerLead.role || 'No Role'} &bull; {activeDrawerLead.company || 'No Company'}
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setActiveDrawerLead(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Meta information card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Email:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-900 font-medium">{activeDrawerLead.email}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeDrawerLead.email);
                        showToast('Email copied to clipboard!');
                      }}
                      className="p-1 text-slate-400 hover:text-sky-600 rounded"
                      title="Copy email"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {activeDrawerLead.x_handle && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">X Handle:</span>
                    <span className="font-mono text-sky-600 font-medium">{activeDrawerLead.x_handle}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getStatusBadge(activeDrawerLead.status)}`}>
                    {activeDrawerLead.status.replace('_', ' ').toLowerCase()}
                  </span>
                </div>
                {activeDrawerLead.custom_hook && (
                  <div className="pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 block mb-0.5">Custom Hook:</span>
                    <p className="text-slate-800 bg-white p-2 rounded-lg border border-slate-200/60 font-medium">
                      {activeDrawerLead.custom_hook}
                    </p>
                  </div>
                )}
                {activeDrawerLead.notes && (
                  <div className="pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 block mb-0.5">Notes:</span>
                    <p className="text-slate-700 bg-white p-2 rounded-lg border border-slate-200/60">
                      {activeDrawerLead.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Clicks tracking section */}
              {activeDrawerLead.clicks && activeDrawerLead.clicks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <MousePointerClick className="w-3.5 h-3.5 text-sky-600" />
                      <span>Link Clicks ({activeDrawerLead.clicks.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => openClicksModal(activeDrawerLead.id)}
                      className="text-[11px] text-sky-600 font-semibold hover:underline"
                    >
                      View Details
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {activeDrawerLead.clicks.map(c => (
                      <div key={c.id} className="p-2.5 rounded-xl bg-sky-50/50 border border-sky-100 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-600 mb-0.5">
                          <span className="font-semibold text-slate-900 truncate max-w-xs">{c.target_url}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(c.clicked_at).toLocaleString()}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          campaign: {c.utm_campaign || 'outreach'} &bull; content: {c.utm_content || 'prospect'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message History Thread */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Message History ({activeDrawerLead.messages?.length || 0})
                  </h3>
                  <button
                    type="button"
                    onClick={() => openCompose(activeDrawerLead)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl shadow-2xs transition"
                  >
                    Send Message
                  </button>
                </div>

                {!activeDrawerLead.messages || activeDrawerLead.messages.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
                    No message history recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeDrawerLead.messages.map(msg => (
                      <div 
                        key={msg.id} 
                        className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                          msg.direction === 'RECEIVED'
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                            msg.direction === 'RECEIVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}>
                            {msg.direction === 'RECEIVED' ? 'Inbound Reply' : 'Sent Email'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {msg.sent_at ? new Date(msg.sent_at).toLocaleString() : ''}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-900 text-xs">
                          {msg.subject}
                        </div>
                        <div className="text-slate-600 text-[11px] whitespace-pre-wrap leading-relaxed font-sans bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/60">
                          {msg.body_text || msg.snippet}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compose & Send Outreach Modal */}
      {isComposeModalOpen && composeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div>
                <h3 className="font-bold text-sm text-slate-950 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-sky-600" />
                  <span>Send Email Outreach</span>
                </h3>
                <div className="text-xs text-slate-500 font-medium">
                  To: <span className="text-slate-900 font-semibold">{composeLead.first_name} {composeLead.last_name}</span> ({composeLead.email})
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsComposeModalOpen(false)} 
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Template Picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Outreach Template</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsComposeModalOpen(false);
                      openTemplateBuilder();
                    }}
                    className="text-[11px] text-sky-600 font-semibold hover:underline"
                  >
                    Manage Templates
                  </button>
                </div>
                <select
                  value={composeTemplateId}
                  onChange={handleTemplateChange}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 font-medium shadow-2xs"
                >
                  <option value="">Custom Freeform Copy</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Subject Line</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 font-medium shadow-2xs"
                />
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Message Body</label>
                  <button
                    type="button"
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className="text-[11px] text-sky-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>{isPreviewMode ? 'Edit Mode' : 'Live Preview'}</span>
                  </button>
                </div>

                {isPreviewMode ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs whitespace-pre-wrap leading-relaxed font-sans min-h-[220px]">
                    {composeBody}
                  </div>
                ) : (
                  <textarea
                    rows={10}
                    value={composeBody}
                    onChange={e => setComposeBody(e.target.value)}
                    placeholder="Write your genuine, professional outreach copy..."
                    className="w-full p-3 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 leading-relaxed font-sans shadow-2xs"
                  />
                )}

                {/* Variable Tokens Helper Chips */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-400">Tokens:</span>
                  {['{{firstName}}', '{{company}}', '{{role}}', '{{custom_hook}}'].map(tok => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => insertVariableToken(tok)}
                      className="px-2 py-0.5 text-[10px] font-mono bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-md border border-sky-200 transition"
                      title={`Click to insert ${tok}`}
                    >
                      {tok}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options Checkboxes */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                  <input
                    type="checkbox"
                    checked={attachResume}
                    onChange={e => setAttachResume(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Attach PDF Resume ({resumeStatus.filename})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                  <input
                    type="checkbox"
                    checked={enableUTMTracking}
                    onChange={e => setEnableUTMTracking(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Tag links with UTM tracking parameters</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsComposeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={isSending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl shadow-xs shadow-sky-500/25 transition disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Dispatching...' : 'Send Outreach'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Builder Modal */}
      {isTemplateBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600" />
                <h3 className="font-bold text-sm text-slate-950">Outreach Template Builder</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsTemplateBuilderOpen(false)} 
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 flex-1 overflow-hidden">
              {/* Template list sidebar */}
              <div className="border-r border-slate-200 p-4 overflow-y-auto space-y-2 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => openTemplateBuilder(null)}
                  className="w-full py-2 px-3 text-xs font-semibold bg-white border border-dashed border-sky-300 text-sky-600 rounded-xl hover:bg-sky-50 flex items-center justify-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Template</span>
                </button>
                <div className="space-y-1.5 pt-2">
                  {templates.map(tpl => (
                    <div
                      key={tpl.id}
                      onClick={() => openTemplateBuilder(tpl)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                        templateForm.id === tpl.id
                          ? 'bg-white border-sky-500 shadow-xs'
                          : 'bg-white border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-slate-900 truncate">{tpl.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{tpl.category}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form panel */}
              <div className="col-span-2 p-6 overflow-y-auto space-y-4">
                <form onSubmit={handleSaveTemplate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Template Name</label>
                      <input
                        type="text"
                        value={templateForm.name}
                        onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                        placeholder="e.g. Founder Quick Pitch"
                        className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                      <select
                        value={templateForm.category}
                        onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 font-medium"
                      >
                        <option value="Cold Outreach">Cold Outreach</option>
                        <option value="Follow-up">Follow-up</option>
                        <option value="Referral">Referral</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Subject Line Template</label>
                    <input
                      type="text"
                      value={templateForm.subject_template}
                      onChange={e => setTemplateForm({ ...templateForm, subject_template: e.target.value })}
                      placeholder="e.g. Engineering & AI systems for {{company}}"
                      className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Body Template</label>
                    <textarea
                      rows={8}
                      value={templateForm.body_template}
                      onChange={e => setTemplateForm({ ...templateForm, body_template: e.target.value })}
                      placeholder="Write template copy using tokens like {{firstName}}, {{company}}..."
                      className="w-full p-3 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 font-sans leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {templateForm.id ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(templateForm.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      >
                        Delete Template
                      </button>
                    ) : <div />}

                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl shadow-xs transition"
                    >
                      {templateForm.id ? 'Update Template' : 'Create Template'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <h3 className="font-bold text-sm text-slate-950">
                {leadForm.id ? 'Edit Prospect' : 'Add New Prospect'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsLeadModalOpen(false)} 
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">First Name</label>
                  <input
                    type="text"
                    value={leadForm.first_name}
                    onChange={e => setLeadForm({ ...leadForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Last Name</label>
                  <input
                    type="text"
                    value={leadForm.last_name}
                    onChange={e => setLeadForm({ ...leadForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={leadForm.email}
                  onChange={e => setLeadForm({ ...leadForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Company</label>
                  <input
                    type="text"
                    value={leadForm.company}
                    onChange={e => setLeadForm({ ...leadForm, company: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Role / Title</label>
                  <input
                    type="text"
                    value={leadForm.role}
                    onChange={e => setLeadForm({ ...leadForm, role: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">X (Twitter) Handle</label>
                  <input
                    type="text"
                    value={leadForm.x_handle}
                    onChange={e => setLeadForm({ ...leadForm, x_handle: e.target.value })}
                    placeholder="@handle"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={leadForm.status}
                    onChange={e => setLeadForm({ ...leadForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 font-medium"
                  >
                    <option value="NOT_CONTACTED">Not Contacted</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="REPLIED">Replied</option>
                    <option value="FOLLOWED_UP">Followed Up</option>
                    <option value="BOUNCED">Bounced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Custom Personalization Hook</label>
                <input
                  type="text"
                  value={leadForm.custom_hook}
                  onChange={e => setLeadForm({ ...leadForm, custom_hook: e.target.value })}
                  placeholder="e.g. building autonomous agents in stealth"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={leadForm.notes}
                  onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLeadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl shadow-xs transition"
                >
                  Save Prospect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                <h3 className="font-bold text-sm text-slate-950">Import Prospects from CSV</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsImportModalOpen(false)} 
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-slate-200 hover:border-sky-400 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50"
                onClick={() => csvFileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-sky-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Click to upload a .csv file</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Supports First Name, Last Name, Email, Company, Role, Hook</p>
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvFileUpload}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Or Paste CSV Content</label>
                <textarea
                  rows={6}
                  value={csvInput}
                  onChange={e => setCsvInput(e.target.value)}
                  placeholder="First Name,Last Name,Email,Company,Role,Custom Hook&#10;John,Doe,john@example.com,Acme,CTO,scaling LLM pipelines"
                  className="w-full p-3 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 font-mono"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={isImporting}
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl shadow-xs transition disabled:opacity-60"
              >
                {isImporting ? 'Importing...' : 'Start Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Clicks Activity Modal */}
      {isClicksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-sky-600" />
                <h3 className="font-bold text-sm text-slate-950">
                  {clicksModalLeadId ? 'Prospect Click Activity' : 'Real-time Link Click Tracking'}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsClicksModalOpen(false)} 
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingClicks ? (
                <div className="text-center py-12 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-500 mb-2" />
                  <span>Loading click activity...</span>
                </div>
              ) : clicksData.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl p-6">
                  <MousePointerClick className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No link clicks recorded yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    When a prospect opens any link (portfolio, GitHub, demo) in your outreach emails, their click and UTM data will show up right here in real time.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clicksData.map(c => (
                    <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-sky-300 transition text-xs space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{c.lead_name || 'Prospect'} ({c.lead_company || 'Company'})</span>
                        <span className="text-[10px] text-slate-400 font-mono">{c.clicked_at ? new Date(c.clicked_at).toLocaleString() : ''}</span>
                      </div>
                      <div className="text-sky-600 font-medium truncate">
                        {c.target_url}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 font-mono pt-1">
                        <span>source: {c.utm_source || 'outreach'}</span>
                        <span>&bull;</span>
                        <span>campaign: {c.utm_campaign || 'outreach'}</span>
                        <span>&bull;</span>
                        <span>content: {c.utm_content || 'prospect'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/80 flex justify-end">
              <button
                type="button"
                onClick={() => setIsClicksModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}