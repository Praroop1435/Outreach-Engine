"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Filter,
  LayoutDashboard,
  Menu,
  SendHorizontal,
  Radio,
  Share2
} from 'lucide-react';

import TemplatesStudioView from '@/components/views/TemplatesStudioView';
import { SidebarContent } from '@/components/shell/Sidebar';
import { Drawer, Modal, useLastDefined } from '@/components/ui/overlay';
import { formatRelative } from '@/lib/format';
import { tagLinks } from '@/lib/utm';
import { AnimatedNumber, Avatar, EmptyState, SegmentedTabs, SkeletonRows, StatusBadge, Toaster, useToasts } from '@/components/ui/primitives';
import ClicksTrackingView from '@/components/views/ClicksTrackingView';
import InboxRepliesView from '@/components/views/InboxRepliesView';
import SystemSettingsView from '@/components/views/SystemSettingsView';

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

export type SidebarTab = 'pipeline' | 'founder_dms' | 'templates' | 'clicks' | 'inbox' | 'settings';

// Resilient API Fetch Helper: Calls Render directly in production with Vercel proxy fallback
async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const isBrowser = typeof window !== 'undefined';
  const isLocalhost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  let targetUrl = endpoint;
  if (!targetUrl.startsWith('http')) {
    const cleanPath = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
    // Prefer direct backend call in production browser to bypass Vercel Hobby 10s serverless timeout
    if (isBrowser && !isLocalhost) {
      targetUrl = `${BACKEND_BASE}${cleanPath}`;
    } else {
      targetUrl = cleanPath;
    }
  }

  try {
    const res = await fetch(targetUrl, options);
    // If direct render call fails (e.g. adblocker), fallback to proxy
    if (!res.ok && targetUrl.startsWith(BACKEND_BASE)) {
      const fallbackUrl = targetUrl.replace(BACKEND_BASE, '');
      return await fetch(fallbackUrl, options);
    }
    return res;
  } catch (err) {
    if (targetUrl.startsWith(BACKEND_BASE)) {
      const fallbackUrl = targetUrl.replace(BACKEND_BASE, '');
      return await fetch(fallbackUrl, options);
    }
    throw err;
  }
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingMailbox, setIsSyncingMailbox] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Sidebar Navigation State (6 full dedicated page views)
  const [activeSidebarNav, setActiveSidebarNav] = useState<SidebarTab>('pipeline');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [founderStatusFilter, setFounderStatusFilter] = useState('ALL');

  const handleNavChange = (tab: SidebarTab) => {
    setActiveSidebarNav(tab);
    setIsMobileSidebarOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState(null, '', url.toString());
    } catch (_) {}

    if (tab === 'clicks') {
      loadClicks(null);
    } else if (tab === 'inbox') {
      apiFetch('/api/analytics/replies').then(res => res.json()).then(data => {
        if (Array.isArray(data)) setReplies(data);
      }).catch(() => {});
    }
  };

  // Drawers and Modals
  const [activeDrawerLead, setActiveDrawerLead] = useState<Lead | null>(null);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
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
  const [enableUTMTracking, setEnableUTMTracking] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Lead Form state
  const [leadForm, setLeadForm] = useState({
    id: 0,
    first_name: '',
    last_name: '',
    email: '',
    website_url: '',
    company: '',
    role: '',
    status: 'NOT_CONTACTED',
    custom_hook: '',
    notes: ''
  });

  // CSV Import State
  const [csvInput, setCsvInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const { toasts, push: showToast, dismiss: dismissToast } = useToasts();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all live data once on mount, sync, or mutation
  const fetchData = useCallback(async () => {
    try {
      const [leadsRes, analyticsRes, templatesRes, resumeRes, repliesRes] = await Promise.all([
        apiFetch('/api/leads?status=ALL&limit=500'),
        apiFetch('/api/analytics/overview'),
        apiFetch('/api/templates'),
        apiFetch('/api/resume/status'),
        apiFetch('/api/analytics/replies')
      ]);

      setBackendOnline(leadsRes.ok);
      if (leadsRes.ok) {
        const lData = await leadsRes.json();
        setLeads(lData);
        try { localStorage.setItem('cached_outreach_leads', JSON.stringify(lData)); } catch (_) {}
      }
      if (analyticsRes.ok) {
        const aData = await analyticsRes.json();
        setAnalytics(aData);
        try { localStorage.setItem('cached_outreach_analytics', JSON.stringify(aData)); } catch (_) {}
      }
      if (templatesRes.ok) {
        const tData = await templatesRes.json();
        setTemplates(tData);
        try { localStorage.setItem('cached_outreach_templates', JSON.stringify(tData)); } catch (_) {}
      }
      if (resumeRes.ok) setResumeStatus(await resumeRes.json());
      if (repliesRes.ok) setReplies(await repliesRes.json());
    } catch (err) {
      setBackendOnline(false);
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Segregate founder directory leads vs general outreach pipeline
  const founderLeads = useMemo(() => {
    return leads.filter(l => (l.source && l.source.includes('1500+')) || (l.status && l.status.includes('DM')) || !!l.x_handle);
  }, [leads]);

  const regularLeads = useMemo(() => {
    return leads.filter(l => !(l.source && l.source.includes('1500+')) && !(l.status && l.status.includes('DM')));
  }, [leads]);

  // In-memory instant filtering for regular pipeline leads
  const filteredLeads = useMemo(() => {
    return regularLeads.filter(lead => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        const s = (lead.status || '').toUpperCase();
        if (statusFilter === 'BOUNCED') {
          if (s !== 'BOUNCED' && s !== 'INVALID_EMAIL') return false;
        } else if (statusFilter === 'REPLIED') {
          if (s !== 'REPLIED' && s !== 'INTERESTED') return false;
        } else if (statusFilter === 'CONTACTED') {
          if (!['CONTACTED', 'FOLLOWED_UP', 'REPLIED', 'INTERESTED'].includes(s)) return false;
        } else if (statusFilter === 'FOLLOWED_UP') {
          if (s !== 'FOLLOWED_UP') return false;
        } else if (s !== statusFilter) {
          return false;
        }
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase();
        const email = (lead.email || '').toLowerCase();
        const comp = (lead.company || '').toLowerCase();
        const role = (lead.role || '').toLowerCase();
        const hook = (lead.custom_hook || '').toLowerCase();
        const notes = (lead.notes || '').toLowerCase();
        return fullName.includes(q) || email.includes(q) || comp.includes(q) || role.includes(q) || hook.includes(q) || notes.includes(q);
      }

      return true;
    });
  }, [regularLeads, statusFilter, searchQuery]);

  // In-memory instant filtering for Founder X DMs
  const filteredFounderLeads = useMemo(() => {
    return founderLeads.filter(lead => {
      if (founderStatusFilter !== 'ALL') {
        if (lead.status !== founderStatusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase();
        const comp = (lead.company || '').toLowerCase();
        const handle = (lead.x_handle || '').toLowerCase();
        const notes = (lead.notes || '').toLowerCase();
        return fullName.includes(q) || comp.includes(q) || handle.includes(q) || notes.includes(q);
      }
      return true;
    });
  }, [founderLeads, founderStatusFilter, searchQuery]);

  // Dynamically computed tab counts in 0ms
  const tabCounts = useMemo(() => {
    return {
      all: regularLeads.length,
      notContacted: regularLeads.filter(l => l.status === 'NOT_CONTACTED').length,
      contacted: regularLeads.filter(l => ['CONTACTED', 'FOLLOWED_UP', 'REPLIED', 'INTERESTED'].includes(l.status)).length,
      replied: regularLeads.filter(l => ['REPLIED', 'INTERESTED'].includes(l.status)).length,
      followedUp: regularLeads.filter(l => l.status === 'FOLLOWED_UP').length,
      bounced: regularLeads.filter(l => ['BOUNCED', 'INVALID_EMAIL'].includes(l.status)).length
    };
  }, [regularLeads]);

  // Dynamically computed founder tab counts
  const founderTabCounts = useMemo(() => {
    return {
      all: founderLeads.length,
      pending: founderLeads.filter(l => l.status === 'PENDING_DM').length,
      staged: founderLeads.filter(l => l.status === 'DM_STAGED').length,
      dmed: founderLeads.filter(l => l.status === 'DMED').length,
      closed: founderLeads.filter(l => l.status === 'DM_CLOSED').length,
      invalid: founderLeads.filter(l => l.status === 'INVALID_PROFILE').length
    };
  }, [founderLeads]);

  const handleMarkDMed = async (leadId: number) => {
    try {
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DMED' })
      });
      setLeads(prev => {
        const updated = prev.map(l => l.id === leadId ? { ...l, status: 'DMED' } : l);
        try { localStorage.setItem('cached_outreach_leads', JSON.stringify(updated)); } catch (_) {}
        return updated;
      });
      showToast('Lead marked as DMED in Neon DB');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const copyFounderPitch = (lead: Lead) => {
    const fn = lead.first_name || 'there';
    const comp = lead.company || 'your team';
    const msg = `Hey ${fn}, been following ${comp}.\n\n` +
      `I'm an AI engineer at Relu Consultancy, shipping production RAG, agent and backend systems for clients. Here's a short Loom of one I built for a US insurance agency:\n` +
      `https://www.loom.com/share/5f715f784c3142e690f16f8df66f3799\n\n` +
      `I'm looking for a remote AI or backend role. Open to a quick call? Happy to start with a small paid trial.\n` +
      `https://praroop.site`;
    navigator.clipboard.writeText(tagLinks(msg, lead.company, `lead_${lead.id}`, 'x_dm'));
    showToast(`Pitch for ${lead.first_name || 'Founder'} copied to clipboard!`);
  };

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
    // 0. Restore tab from URL search param if present
    try {
      const urlTab = new URLSearchParams(window.location.search).get('tab') as SidebarTab | null;
      if (urlTab && ['pipeline', 'founder_dms', 'templates', 'clicks', 'inbox', 'settings'].includes(urlTab)) {
        setActiveSidebarNav(urlTab);
      }
    } catch (_) {}

    // 1. Instant render from localStorage cache
    try {
      const cachedLeads = localStorage.getItem('cached_outreach_leads');
      const cachedAnalytics = localStorage.getItem('cached_outreach_analytics');
      const cachedTemplates = localStorage.getItem('cached_outreach_templates');
      if (cachedLeads) setLeads(JSON.parse(cachedLeads));
      if (cachedAnalytics) setAnalytics(JSON.parse(cachedAnalytics));
      if (cachedTemplates) setTemplates(JSON.parse(cachedTemplates));
      if (cachedLeads) setIsLoading(false);
    } catch (e) {
      console.error('Failed to parse cache:', e);
    }
    // 2. Background revalidation
    fetchData();
  }, [fetchData]);

  // "/" focuses search, like most data tools
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  // Load click logs (Link clicks page) or open them in a modal for one prospect
  const openClicksModal = (leadId: number | null = null) => {
    setIsClicksModalOpen(true);
    loadClicks(leadId);
  };

  const loadClicks = async (leadId: number | null = null) => {
    setClicksModalLeadId(leadId);
    setIsLoadingClicks(true);
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
    // Open instantly with what we already have, then fill in the thread
    const cached = leads.find(l => l.id === leadId);
    if (cached) setActiveDrawerLead({ ...cached, messages: undefined, clicks: undefined });
    try {
      const res = await apiFetch(`/api/leads/${leadId}`);
      if (!res.ok) throw new Error('Failed to load contact details');
      const data = await res.json();
      setActiveDrawerLead(prev => (prev === null && cached ? prev : data));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Compose Modal Handlers
  const openCompose = (lead: Lead) => {
    setComposeLead(lead);
    setIsPreviewMode(false);
    
    // Choose sensible default template or custom
    const defaultTemplate = templates.find(t => t.category === 'Cold Outreach') || templates[0];
    if (defaultTemplate) {
      setComposeTemplateId(String(defaultTemplate.id));
      applyTemplateText(defaultTemplate, lead);
    } else {
      setComposeTemplateId('');
      setComposeSubject(`Loom for ${lead.company || 'your team'}`);
      setComposeBody(
        `Hi ${lead.first_name || 'there'},\n\n` +
        `I'm Praroop, an AI engineer at Relu Consultancy. I ship production AI systems (RAG, agents, async backends) for international clients. Here's a short Loom of one:\n` +
        `https://www.loom.com/share/5f715f784c3142e690f16f8df66f3799\n\n` +
        `I'm looking for a remote AI or backend role. Open to a 15 minute call this week? Happy to start with a small paid trial.\n\n` +
        `Praroop\nhttps://praroop.site`
      );
      setAttachResume(false);
    }
    setIsComposeModalOpen(true);
  };

  const openComposeByLeadId = async (leadId: number) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      openCompose(lead);
    } else {
      try {
        const res = await apiFetch(`/api/leads/${leadId}`);
        if (res.ok) {
          const lData = await res.json();
          openCompose(lData);
        }
      } catch (_) {}
    }
  };

  const handleUpdateLeadStatus = async (leadId: number, newStatus: string) => {
    try {
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');
      setLeads(prev => {
        const updated = prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l);
        try { localStorage.setItem('cached_outreach_leads', JSON.stringify(updated)); } catch (_) {}
        return updated;
      });
      showToast(`Lead status updated to ${newStatus}`);
      fetchData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const applyTemplateText = (tpl: Template, lead: Lead) => {
    const fn = lead.first_name || 'there';
    const comp = lead.company || 'your team';
    // Mirrors render_template / clean_custom_hook in app/services/email_sender.py
    const rawHook = (lead.custom_hook || '').trim().replace(/\.$/, '');
    const hook = !rawHook || /https?:\/\/|linkedin\.com|^what you are building at/i.test(rawHook) ? 'your recent work' : rawHook;
    const role = lead.role || 'team';
    const jobRole = lead.notes || 'AI Engineer';

    const fill = (text: string) => text
      .replace(/{{\s*(firstName|first_name)\s*}}/gi, fn)
      .replace(/{{\s*(lastName|last_name)\s*}}/gi, lead.last_name || '')
      .replace(/{{\s*company\s*}}/gi, comp)
      .replace(/{{\s*role\s*}}/gi, role)
      .replace(/{{\s*(job_role|target_role)\s*}}/gi, jobRole)
      .replace(/{{\s*custom_hook\s*}}/gi, hook);

    setComposeSubject(fill(tpl.subject_template));
    setComposeBody(fill(tpl.body_template));
    // Resume only helps on applications; on founder cold emails it hurts deliverability
    setAttachResume(tpl.category === 'Job Application');
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
          enable_utm_tracking: enableUTMTracking,
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

  // Add / Edit Lead Handlers
  const openNewLeadModal = () => {
    setLeadForm({
      id: 0,
      first_name: '',
      last_name: '',
      email: '',
      website_url: '',
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
      website_url: lead.website_url || '',
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

  const filterTabs = [
    { id: 'ALL', label: 'All', count: tabCounts.all },
    { id: 'NOT_CONTACTED', label: 'New', count: tabCounts.notContacted },
    { id: 'CONTACTED', label: 'Contacted', count: tabCounts.contacted },
    { id: 'REPLIED', label: 'Replied', count: tabCounts.replied },
    { id: 'FOLLOWED_UP', label: 'Followed up', count: tabCounts.followedUp },
    { id: 'BOUNCED', label: 'Bounced', count: tabCounts.bounced }
  ];

  const founderFilterTabs = [
    { id: 'ALL', label: 'All', count: founderTabCounts.all },
    { id: 'PENDING_DM', label: 'Pending', count: founderTabCounts.pending },
    { id: 'DM_STAGED', label: 'Ready', count: founderTabCounts.staged },
    { id: 'DMED', label: 'DMed', count: founderTabCounts.dmed },
    { id: 'DM_CLOSED', label: 'Closed', count: founderTabCounts.closed },
    { id: 'INVALID_PROFILE', label: 'Invalid', count: founderTabCounts.invalid }
  ];

  const drawerLead = useLastDefined(activeDrawerLead);
  const replyCount = replies.filter(r => !/bounce|delivery status/i.test(r.subject || '')).length;
  const meta = PAGE_META[activeSidebarNav];
  const showContactActions = activeSidebarNav === 'pipeline' || activeSidebarNav === 'founder_dms';

  const sidebarProps = {
    active: activeSidebarNav,
    onNavigate: handleNavChange,
    counts: {
      pipeline: regularLeads.length,
      founders: founderLeads.length,
      templates: templates.length,
      clicks: analytics.total_link_clicks,
      inbox: replyCount,
    },
    backendOnline,
    resumeFilename: resumeStatus.filename,
    resumeSizeKb: resumeStatus.size_kb,
    onUploadResume: () => fileInputRef.current?.click(),
    email: 'anandpraroop@gmail.com',
  };

  const searchBox = (placeholder: string) => (
    <div className="relative w-full md:w-80">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={searchInputRef}
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="input pl-9 pr-12"
      />
      {searchQuery ? (
        <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-icon h-6 w-6" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="kbd absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:inline-flex">/</span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <Toaster toasts={toasts} onDismiss={dismissToast} />
      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />

      {/* Desktop sidebar */}
      <aside className="hidden lg:block sticky top-0 h-screen w-[248px] shrink-0 border-r border-slate-200/70 bg-[#f3f4f7] px-3 py-5">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile sidebar */}
      <Drawer open={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} side="left" widthClassName="max-w-[280px]">
        <div className="h-full bg-[#f3f4f7] px-3 py-5">
          <SidebarContent {...sidebarProps} />
        </div>
      </Drawer>

      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#f7f8fa]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8 h-16">
            <button type="button" onClick={() => setIsMobileSidebarOpen(true)} className="btn btn-secondary btn-icon lg:hidden" aria-label="Open menu">
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 key={activeSidebarNav} className="animate-fade-in truncate text-[17px] font-semibold tracking-tight text-slate-900">{meta.title}</h1>
              <p className="hidden sm:block truncate text-[13px] text-slate-500">{meta.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleManualSyncMailbox} disabled={isSyncingMailbox} className="btn btn-secondary" title="Check Gmail for replies and bounces">
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncingMailbox ? 'animate-spin text-brand-600' : 'text-slate-500'}`} />
                <span className="hidden sm:inline">{isSyncingMailbox ? 'Syncing' : 'Sync inbox'}</span>
              </button>
              {showContactActions && (
                <>
                  <button type="button" onClick={() => setIsImportModalOpen(true)} className="btn btn-secondary hidden md:inline-flex">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
                    Import
                  </button>
                  <button type="button" onClick={openNewLeadModal} className="btn btn-primary">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add contact</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main key={activeSidebarNav} className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-up">
          {activeSidebarNav === 'templates' && (
            <TemplatesStudioView templates={templates} fetchData={fetchData} showToast={showToast} apiFetch={apiFetch} />
          )}

          {activeSidebarNav === 'clicks' && (
            <ClicksTrackingView
              clicks={clicksData}
              isLoading={isLoadingClicks}
              onRefresh={() => loadClicks(null)}
              openLeadDrawer={openLeadDrawer}
              showToast={showToast}
            />
          )}

          {activeSidebarNav === 'inbox' && (
            <InboxRepliesView
              replies={replies}
              isSyncing={isSyncingMailbox}
              onSyncMailbox={handleManualSyncMailbox}
              openLeadDrawer={openLeadDrawer}
              openComposeByLeadId={openComposeByLeadId}
              onUpdateLeadStatus={handleUpdateLeadStatus}
              showToast={showToast}
            />
          )}

          {activeSidebarNav === 'settings' && (
            <SystemSettingsView
              resumeStatus={resumeStatus}
              onUploadResume={handleResumeUpload}
              fileInputRef={fileInputRef}
              isSyncingMailbox={isSyncingMailbox}
              onSyncMailbox={handleManualSyncMailbox}
              showToast={showToast}
              fetchData={fetchData}
              apiFetch={apiFetch}
            />
          )}

          {activeSidebarNav === 'founder_dms' && (
            <div className="space-y-6">
              <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="Founders" value={founderTabCounts.all} sub="from the founder sheet" icon={<Users className="h-4 w-4" />} active={founderStatusFilter === 'ALL'} onClick={() => setFounderStatusFilter('ALL')} />
                <StatCard label="DM ready" value={founderTabCounts.staged} sub="open DMs, verified" icon={<Sparkles className="h-4 w-4" />} active={founderStatusFilter === 'DM_STAGED'} onClick={() => setFounderStatusFilter('DM_STAGED')} />
                <StatCard label="DMed" value={founderTabCounts.dmed} sub="sent on X" icon={<Send className="h-4 w-4" />} active={founderStatusFilter === 'DMED'} onClick={() => setFounderStatusFilter('DMED')} />
                <StatCard label="DM closed" value={founderTabCounts.closed} sub="skipped, DMs off" icon={<X className="h-4 w-4" />} active={founderStatusFilter === 'DM_CLOSED'} onClick={() => setFounderStatusFilter('DM_CLOSED')} />
              </section>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <SegmentedTabs tabs={founderFilterTabs} value={founderStatusFilter} onChange={setFounderStatusFilter} />
                {searchBox('Search founder, company, @handle')}
              </div>

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <Th>Startup</Th>
                        <Th className="hidden md:table-cell">Founder</Th>
                        <Th className="hidden lg:table-cell">X profile</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Actions</Th>
                      </tr>
                    </thead>
                    <tbody key={`${founderStatusFilter}-${searchQuery}`} className="stagger">
                      {isLoading && founderLeads.length === 0 ? (
                        <SkeletonRows cols={5} />
                      ) : filteredFounderLeads.length === 0 ? (
                        <tr>
                          <td colSpan={5}>
                            <EmptyState icon={<SendHorizontal className="h-5 w-5" />} title="No founders here" description="Try a different filter or clear the search." />
                          </td>
                        </tr>
                      ) : (
                        filteredFounderLeads.map((lead, i) => {
                          const handle = (lead.x_handle || '').replace(/^@/, '');
                          const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Founder';
                          return (
                            <tr key={lead.id} style={{ '--i': i } as React.CSSProperties} className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                              <td className="px-3 sm:px-4 py-3.5">
                                <div className="max-w-[140px] sm:max-w-xs truncate font-medium text-slate-900">{lead.company}</div>
                                <div className="mt-0.5 max-w-[140px] sm:max-w-xs truncate text-xs text-slate-400">
                                  <span className="md:hidden">{name}{handle ? ` · @${handle}` : ''}</span>
                                  <span className="hidden md:inline">{lead.custom_hook}</span>
                                </div>
                              </td>
                              <td className="hidden md:table-cell px-4 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <Avatar name={name} size="sm" />
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-slate-800">{name}</div>
                                    <div className="truncate text-xs text-slate-400">{lead.role || 'Founder'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden lg:table-cell px-4 py-3.5">
                                {handle ? (
                                  <a href={`https://x.com/${handle}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-slate-600 hover:text-brand-600">
                                    @{handle}
                                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                  </a>
                                ) : (
                                  <span className="text-slate-300">None</span>
                                )}
                              </td>
                              <td className="px-3 sm:px-4 py-3.5"><StatusBadge status={lead.status} /></td>
                              <td className="px-3 sm:px-4 py-3.5">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button type="button" onClick={() => copyFounderPitch(lead)} className="btn btn-secondary btn-sm" title="Copy a short DM with your Loom">
                                    <Copy className="h-3 w-3" />
                                    <span className="hidden sm:inline">Copy DM</span>
                                  </button>
                                  <button type="button" onClick={() => handleMarkDMed(lead.id)} className="btn btn-primary btn-sm" disabled={lead.status === 'DMED'}>
                                    <Check className="h-3 w-3" />
                                    <span className="hidden sm:inline">{lead.status === 'DMED' ? 'DMed' : 'Mark DMed'}</span>
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
          )}

          {activeSidebarNav === 'pipeline' && (
            <div className="space-y-6">
              <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="Prospects" value={regularLeads.length} sub="in your pipeline" icon={<Users className="h-4 w-4" />} active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
                <StatCard label="Contacted" value={tabCounts.contacted} sub={`${analytics.total_sent_emails} emails sent`} icon={<Send className="h-4 w-4" />} active={statusFilter === 'CONTACTED'} onClick={() => setStatusFilter('CONTACTED')} />
                <StatCard label="Replied" value={tabCounts.replied} sub={tabCounts.contacted ? `${((tabCounts.replied / tabCounts.contacted) * 100).toFixed(1)}% reply rate` : 'no sends yet'} icon={<Inbox className="h-4 w-4" />} active={statusFilter === 'REPLIED'} onClick={() => setStatusFilter('REPLIED')} />
                <StatCard label="Follow-up due" value={analytics.follow_up_needed} sub="3+ days since last email" icon={<Clock className="h-4 w-4" />} active={statusFilter === 'FOLLOWED_UP'} onClick={() => setStatusFilter('FOLLOWED_UP')} tone="amber" />
              </section>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <SegmentedTabs tabs={filterTabs} value={statusFilter} onChange={setStatusFilter} />
                {searchBox('Search name, company, email')}
              </div>

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <Th>Contact</Th>
                        <Th className="hidden sm:table-cell">Company</Th>
                        <Th className="hidden md:table-cell">Email</Th>
                        <Th>Status</Th>
                        <Th className="hidden lg:table-cell">Last contacted</Th>
                        <Th className="text-right">Actions</Th>
                      </tr>
                    </thead>
                    <tbody key={`${statusFilter}-${searchQuery}`} className="stagger">
                      {isLoading && regularLeads.length === 0 ? (
                        <SkeletonRows cols={6} />
                      ) : filteredLeads.length === 0 ? (
                        <tr>
                          <td colSpan={6}>
                            <EmptyState
                              icon={<Inbox className="h-5 w-5" />}
                              title="No contacts found"
                              description="Try a different filter, clear the search, or add someone new."
                              action={<button type="button" onClick={openNewLeadModal} className="btn btn-secondary btn-sm"><Plus className="h-3.5 w-3.5" />Add contact</button>}
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredLeads.map((lead, i) => {
                          const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email.split('@')[0];
                          return (
                            <tr
                              key={lead.id}
                              style={{ '--i': i } as React.CSSProperties}
                              onClick={() => openLeadDrawer(lead.id)}
                              className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                            >
                              <td className="px-3 sm:px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar name={fullName} />
                                  <div className="min-w-0">
                                    <div className="max-w-[120px] sm:max-w-[220px] truncate font-medium text-slate-900 group-hover:text-brand-700">{fullName}</div>
                                    <div className="max-w-[120px] sm:max-w-[220px] truncate text-xs text-slate-400">
                                      {lead.role || 'No role'}
                                      {lead.company && <span className="sm:hidden"> · {lead.company}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden sm:table-cell px-4 py-3 font-medium text-slate-700">{lead.company || <span className="text-slate-300">None</span>}</td>
                              <td className="hidden md:table-cell px-4 py-3 font-mono text-xs text-slate-500">{lead.email}</td>
                              <td className="px-3 sm:px-4 py-3"><StatusBadge status={lead.status} /></td>
                              <td className="hidden lg:table-cell px-4 py-3 text-xs text-slate-500 tabular-nums">{formatRelative(lead.last_contacted_at)}</td>
                              <td className="px-3 sm:px-4 py-3" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <div className="hidden lg:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button type="button" onClick={() => openEditLeadModal(lead)} className="btn btn-ghost btn-icon" title="Edit contact">
                                      <Edit className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" onClick={() => handleDeleteLead(lead.id)} className="btn btn-danger btn-icon" title="Delete contact">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <button type="button" onClick={() => openCompose(lead)} className="btn btn-secondary btn-sm" aria-label="Write email">
                                    <Mail className="h-3 w-3" />
                                    <span className="hidden sm:inline">Email</span>
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
                {!isLoading && filteredLeads.length > 0 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
                    <span>{filteredLeads.length} of {regularLeads.length} contacts</span>
                    <span className="hidden sm:inline">Click a row to see the full thread</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Contact drawer */}
      <Drawer open={!!activeDrawerLead} onClose={() => setActiveDrawerLead(null)}>
        {drawerLead && (
          <>
            <div className="flex items-start gap-3 border-b border-slate-100 px-6 pt-6 pb-5">
              <Avatar name={`${drawerLead.first_name || ''} ${drawerLead.last_name || ''}`.trim() || drawerLead.email} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">
                  {`${drawerLead.first_name || ''} ${drawerLead.last_name || ''}`.trim() || 'Contact'}
                </h2>
                <p className="truncate text-[13px] text-slate-500">
                  {[drawerLead.role, drawerLead.company].filter(Boolean).join(' at ') || 'No role or company'}
                </p>
                <div className="mt-2.5"><StatusBadge status={drawerLead.status} /></div>
              </div>
              <button type="button" onClick={() => setActiveDrawerLead(null)} className="btn btn-ghost btn-icon" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-2 border-b border-slate-100 px-6 py-3">
              <button type="button" onClick={() => openCompose(drawerLead)} className="btn btn-primary flex-1">
                <Mail className="h-3.5 w-3.5" />
                Write email
              </button>
              <button type="button" onClick={() => openEditLeadModal(drawerLead)} className="btn btn-secondary">
                <Edit className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <dl className="space-y-3 text-[13px]">
                <InfoRow label="Email">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(drawerLead.email);
                      showToast('Email copied');
                    }}
                    className="group inline-flex items-center gap-1.5 font-mono text-xs text-slate-700 hover:text-brand-600"
                  >
                    {drawerLead.email}
                    <Copy className="h-3 w-3 text-slate-300 group-hover:text-brand-600" />
                  </button>
                </InfoRow>
                {drawerLead.website_url && (
                  <InfoRow label="Website">
                    <a href={drawerLead.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-700 hover:text-brand-600">
                      {drawerLead.website_url.replace(/^https?:\/\//, '')}
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </InfoRow>
                )}
                <InfoRow label="Source"><span className="text-slate-700">{drawerLead.source}</span></InfoRow>
                <InfoRow label="Last contacted"><span className="text-slate-700">{formatRelative(drawerLead.last_contacted_at)}</span></InfoRow>
              </dl>

              {(drawerLead.custom_hook || drawerLead.notes) && (
                <div className="space-y-3">
                  {drawerLead.custom_hook && (
                    <div className="rounded-xl bg-brand-50/60 p-3.5 ring-1 ring-brand-100">
                      <div className="eyebrow mb-1 text-brand-600/70">Personal hook</div>
                      <p className="text-[13px] leading-relaxed text-slate-800">{drawerLead.custom_hook}</p>
                    </div>
                  )}
                  {drawerLead.notes && (
                    <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70">
                      <div className="eyebrow mb-1">Notes</div>
                      <p className="text-[13px] leading-relaxed text-slate-700">{drawerLead.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {drawerLead.clicks && drawerLead.clicks.length > 0 && (
                <div>
                  <div className="eyebrow mb-2">Link clicks · {drawerLead.clicks.length}</div>
                  <div className="space-y-1.5">
                    {drawerLead.clicks.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs ring-1 ring-slate-200/60">
                        <span className="truncate font-medium text-slate-700">{c.target_url}</span>
                        <span className="shrink-0 text-slate-400">{formatRelative(c.clicked_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="eyebrow mb-3">Conversation{drawerLead.messages ? ` · ${drawerLead.messages.length}` : ''}</div>
                {!drawerLead.messages ? (
                  <div className="space-y-4">
                    {[0, 1].map(i => (
                      <div key={i} className="flex gap-3">
                        <div className="skeleton h-6 w-6 shrink-0 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="skeleton h-3 w-2/3" />
                          <div className="skeleton h-20 w-full rounded-xl" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : drawerLead.messages.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-[13px] text-slate-400">Nothing sent yet</div>
                ) : (
                  <ol className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                    {drawerLead.messages.map((msg, i) => {
                      const inbound = msg.direction === 'RECEIVED';
                      return (
                        <li key={msg.id} className="relative pl-9 animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                          <span className={`absolute left-0 top-1 flex h-[23px] w-[23px] items-center justify-center rounded-full ring-4 ring-white ${inbound ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-100 text-brand-600'}`}>
                            {inbound ? <Inbox className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                          </span>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] font-medium text-slate-900">{msg.subject}</span>
                            <span className="shrink-0 text-[11px] text-slate-400">{formatRelative(msg.sent_at)}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">{inbound ? 'Reply received' : msg.channel === 'X_DM' ? 'X DM sent' : 'Email sent'}</div>
                          {(msg.body_text || msg.snippet) && (
                            <div className={`mt-2 whitespace-pre-wrap rounded-xl p-3 text-[13px] leading-relaxed ${inbound ? 'bg-emerald-50/60 text-slate-800 ring-1 ring-emerald-100' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200/60'}`}>
                              {msg.body_text || msg.snippet}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </Drawer>

      {/* Compose */}
      <Modal
        open={isComposeModalOpen && !!composeLead}
        onClose={() => setIsComposeModalOpen(false)}
        icon={<Mail className="h-4 w-4" />}
        title="New email"
        description={composeLead && <>To <span className="font-medium text-slate-700">{`${composeLead.first_name || ''} ${composeLead.last_name || ''}`.trim() || composeLead.email}</span> · {composeLead.email}</>}
        footer={
          <>
            <span className="mr-auto text-xs text-slate-400 tabular-nums">
              {wordCount(composeBody)} words
              {wordCount(composeBody) > 140 && <span className="text-amber-600"> · try to stay under 120</span>}
            </span>
            <button type="button" onClick={() => setIsComposeModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="button" onClick={handleSendEmail} disabled={isSending} className="btn btn-primary min-w-[96px]">
              {isSending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {isSending ? 'Sending' : 'Send'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Template</label>
              <button
                type="button"
                onClick={() => {
                  setIsComposeModalOpen(false);
                  handleNavChange('templates');
                }}
                className="mb-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Edit templates
              </button>
            </div>
            <select value={composeTemplateId} onChange={handleTemplateChange} className="input">
              <option value="">Write from scratch</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Subject</label>
            <input type="text" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Keep it short and specific" className="input font-medium" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label mb-0">Message</label>
              <SegmentedTabs
                tabs={[{ id: 'edit', label: 'Write' }, { id: 'preview', label: 'Preview' }]}
                value={isPreviewMode ? 'preview' : 'edit'}
                onChange={id => setIsPreviewMode(id === 'preview')}
              />
            </div>
            {isPreviewMode ? (
              <div className="min-h-[260px] whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-800 ring-1 ring-slate-200/70 animate-fade-in">
                <div className="mb-3 border-b border-slate-200/70 pb-3 font-semibold text-slate-900">{composeSubject || 'No subject'}</div>
                {composeBody}
              </div>
            ) : (
              <textarea rows={11} value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Say who you are, show one thing you built, ask one clear question." className="input" />
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Insert</span>
              {['{{firstName}}', '{{company}}', '{{job_role}}', '{{custom_hook}}'].map(tok => (
                <button key={tok} type="button" onClick={() => insertVariableToken(tok)} className="chip border-slate-200 bg-white font-mono text-slate-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
                  {tok}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200/70">
            <Switch
              checked={attachResume}
              onChange={setAttachResume}
              label="Attach resume"
              hint={`${resumeStatus.filename}. Best for posted roles, skip for founder cold emails.`}
            />
            <Switch
              checked={enableUTMTracking}
              onChange={setEnableUTMTracking}
              label="Log clicks in dashboard"
              hint="Links always carry UTM tags. This also logs each click here, but routes links through a redirect that can push emails to spam."
            />
          </div>
        </div>
      </Modal>

      {/* Add / edit contact */}
      <Modal
        open={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        size="md"
        icon={<Users className="h-4 w-4" />}
        title={leadForm.id ? 'Edit contact' : 'Add contact'}
        description={leadForm.id ? leadForm.email : 'Add someone to your pipeline'}
        footer={
          <>
            <button type="button" onClick={() => setIsLeadModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="lead-form" className="btn btn-primary">{leadForm.id ? 'Save changes' : 'Add contact'}</button>
          </>
        }
      >
        <form id="lead-form" onSubmit={handleSaveLead} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name"><input type="text" value={leadForm.first_name} onChange={e => setLeadForm({ ...leadForm, first_name: e.target.value })} className="input" /></Field>
            <Field label="Last name"><input type="text" value={leadForm.last_name} onChange={e => setLeadForm({ ...leadForm, last_name: e.target.value })} className="input" /></Field>
          </div>
          <Field label="Email"><input type="email" required value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} className="input font-mono" placeholder="name@company.com" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company"><input type="text" value={leadForm.company} onChange={e => setLeadForm({ ...leadForm, company: e.target.value })} className="input" /></Field>
            <Field label="Their role"><input type="text" value={leadForm.role} onChange={e => setLeadForm({ ...leadForm, role: e.target.value })} className="input" placeholder="Founder, CTO" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Website"><input type="url" value={leadForm.website_url} onChange={e => setLeadForm({ ...leadForm, website_url: e.target.value })} placeholder="https://" className="input" /></Field>
            <Field label="Status">
              <select value={leadForm.status} onChange={e => setLeadForm({ ...leadForm, status: e.target.value })} className="input">
                <option value="NOT_CONTACTED">Not contacted</option>
                <option value="CONTACTED">Contacted</option>
                <option value="FOLLOWED_UP">Followed up</option>
                <option value="REPLIED">Replied</option>
                <option value="INTERESTED">Interested</option>
                <option value="BOUNCED">Bounced</option>
              </select>
            </Field>
          </div>
          <Field label="Personal hook" hint="A real detail about their product. Fills {{custom_hook}}.">
            <input type="text" value={leadForm.custom_hook} onChange={e => setLeadForm({ ...leadForm, custom_hook: e.target.value })} placeholder="your agent eval tooling" className="input" />
          </Field>
          <Field label="Role you're applying for" hint="Fills {{job_role}}.">
            <textarea rows={2} value={leadForm.notes} onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })} placeholder="Backend Engineer" className="input" />
          </Field>
        </form>
      </Modal>

      {/* CSV import */}
      <Modal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        icon={<FileSpreadsheet className="h-4 w-4" />}
        title="Import contacts"
        description="Upload a CSV or paste rows below"
        footer={
          <>
            <button type="button" onClick={() => setIsImportModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="button" onClick={handleImportCsv} disabled={isImporting || !csvInput.trim()} className="btn btn-primary">
              {isImporting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {isImporting ? 'Importing' : 'Import'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => csvFileInputRef.current?.click()}
            className="group flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-8 text-center hover:border-brand-300 hover:bg-brand-50/40"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 ring-1 ring-slate-200 group-hover:text-brand-600 group-hover:-translate-y-0.5 transition">
              <Upload className="h-4 w-4" />
            </div>
            <span className="text-[13px] font-medium text-slate-800">{csvInput ? 'File loaded, click to replace' : 'Choose a CSV file'}</span>
            <span className="mt-0.5 text-xs text-slate-400">Columns: First Name, Last Name, Email, Company, Role, Hook</span>
          </button>
          <input ref={csvFileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFileUpload} />
          <Field label="Or paste CSV">
            <textarea
              rows={6}
              value={csvInput}
              onChange={e => setCsvInput(e.target.value)}
              placeholder={'First Name,Last Name,Email,Company,Role,Custom Hook\nJohn,Doe,john@example.com,Acme,CTO,your LLM eval pipeline'}
              className="input font-mono text-xs"
            />
          </Field>
        </div>
      </Modal>

      {/* Link clicks for one prospect */}
      <Modal
        open={isClicksModalOpen}
        onClose={() => setIsClicksModalOpen(false)}
        icon={<MousePointerClick className="h-4 w-4" />}
        title={clicksModalLeadId ? 'Link clicks for this contact' : 'Link clicks'}
        description="Only recorded when click tracking was on for the email"
      >
        {isLoadingClicks ? (
          <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
        ) : clicksData.length === 0 ? (
          <EmptyState icon={<MousePointerClick className="h-5 w-5" />} title="No clicks yet" description="Clicks show up here when tracking is on. It is off by default to protect inbox placement." />
        ) : (
          <div className="stagger space-y-2">
            {clicksData.map((c, i) => (
              <div key={c.id} style={{ '--i': i } as React.CSSProperties} className="rounded-xl p-3 ring-1 ring-slate-200/70 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium text-slate-900">{c.lead_name || 'Prospect'}{c.lead_company ? ` · ${c.lead_company}` : ''}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatRelative(c.clicked_at)}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-brand-600">{c.target_url}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------------
   Page-level helpers
---------------------------------------------------------------- */

const PAGE_META: Record<SidebarTab, { title: string; subtitle: string }> = {
  pipeline: { title: 'Pipeline', subtitle: 'Everyone you are emailing, where they stand, and who needs a follow-up' },
  founder_dms: { title: 'Founder DMs', subtitle: 'Founders from the sheet with X handles, ready for a short DM' },
  templates: { title: 'Templates', subtitle: 'Short, Loom-first emails for remote AI, backend and automation roles' },
  clicks: { title: 'Link clicks', subtitle: 'Who opened your Loom or portfolio, when tracking is on' },
  inbox: { title: 'Inbox', subtitle: 'Replies and bounces synced from Gmail' },
  settings: { title: 'System & sync', subtitle: 'Database, Gmail and keep-alive health' },
};

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-3 sm:px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400 ${className}`}>{children}</th>;
}

function StatCard({ label, value, sub, icon, active, onClick, tone = 'brand' }: {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: 'brand' | 'amber';
}) {
  const iconTone = tone === 'amber' ? 'bg-amber-50 text-amber-600 ring-amber-100' : 'bg-brand-50 text-brand-600 ring-brand-100';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card group relative overflow-hidden p-4 sm:p-5 text-left hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)] duration-300 ${
        active ? 'ring-2 ring-brand-500/80 border-transparent' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 transition-transform duration-300 group-hover:scale-110 ${iconTone}`}>{icon}</span>
      </div>
      <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-slate-900">
        <AnimatedNumber value={value} />
      </div>
      <div className="mt-2 truncate text-xs text-slate-400">{sub}</div>
    </button>
  );
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 px-3.5 py-3">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-brand-600' : 'bg-slate-200'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.36,0.64,1)] ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
    </label>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}
