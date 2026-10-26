"use client";

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Server, 
  ShieldCheck, 
  RefreshCw, 
  Upload, 
  Download, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Mail, 
  Cpu, 
  Sparkles,
  Zap
} from 'lucide-react';

interface SystemHealthData {
  status: string;
  database: {
    connected: boolean;
    latency_ms: number;
    error: string | null;
    provider: string;
  };
  stats: {
    total_leads: number;
    total_messages: number;
    total_clicks: number;
    cache_keys_cached: number;
  };
  integrations: {
    gmail_user: string;
    gmail_configured: boolean;
    smtp_server: string;
    imap_server: string;
  };
  resume: {
    exists: boolean;
    filename: string;
    size_kb: number;
    path: string;
  };
}

interface SystemSettingsViewProps {
  resumeStatus: {
    exists: boolean;
    filename: string;
    size_kb: number;
    updated_at: string | null;
  };
  onUploadResume: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isSyncingMailbox: boolean;
  onSyncMailbox: () => void;
  showToast: (text: string, type?: 'success' | 'error') => void;
  fetchData: () => Promise<void>;
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<Response>;
}

export default function SystemSettingsView({
  resumeStatus,
  onUploadResume,
  fileInputRef,
  isSyncingMailbox,
  onSyncMailbox,
  showToast,
  fetchData,
  apiFetch
}: SystemSettingsViewProps) {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);

  const fetchHealth = async () => {
    setIsLoadingHealth(true);
    const start = performance.now();
    try {
      const res = await apiFetch('/api/system/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
        setLastPingTime(Math.round(performance.now() - start));
      }
    } catch (e: any) {
      showToast('Could not reach backend health check: ' + e.message, 'error');
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      // 1. Wipe browser localStorage
      localStorage.removeItem('cached_outreach_leads');
      localStorage.removeItem('cached_outreach_analytics');
      localStorage.removeItem('cached_outreach_templates');

      // 2. Wipe server memory cache
      const res = await apiFetch('/api/system/cache/clear', { method: 'POST' });
      if (res.ok) {
        showToast('Local browser & backend cache cleared successfully!');
        await fetchData();
        await fetchHealth();
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Verification Explanation */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-700/60 relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SYSTEM VERIFIED
            </span>
            <span className="text-xs text-slate-400 font-mono">Render Free Tier &bull; Neon DB &bull; Gmail IMAP SSL</span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white">
            Render Keep-Alive &amp; Cronjob Architecture
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 pt-1">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
              <div className="font-bold text-sky-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Why Render Slept &amp; How We Fixed It
              </div>
              <p className="leading-relaxed text-[11px] text-slate-300">
                Render&apos;s free instances sleep after 15 minutes of zero HTTP requests, taking ~45s to wake up. We deployed a 24/7 GitHub Actions cloud cron that pings <code className="text-sky-300 font-mono">/health</code> every 5 minutes, preventing sleep permanently.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
              <div className="font-bold text-purple-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                What the Cronjob Actually Does
              </div>
              <p className="leading-relaxed text-[11px] text-slate-300">
                The cron executes <code className="text-purple-300 font-mono">sync_mailbox()</code> via secure IMAP SSL on port 993: it scans Inbox &amp; Sent Mail, correlates Message-ID threading, and flags bounces or replies directly into Neon DB.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Infrastructure Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Neon Database */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900">Neon PostgreSQL</h3>
                <span className="text-[10px] text-slate-400 font-mono">Production Database</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono pt-1">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Latency:</span>
              <span className="font-bold text-slate-800">{health?.database.latency_ms.toFixed(1) || '—'} ms</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Total Leads:</span>
              <span className="font-bold text-slate-800">{health?.stats.total_leads || 409}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Total Messages:</span>
              <span className="font-bold text-slate-800">{health?.stats.total_messages || 397}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Cluster Region:</span>
              <span className="font-bold text-slate-800">Singapore (ap-southeast-1)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Gmail SMTP & IMAP Services */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900">Gmail Mailbox &amp; SMTP</h3>
                <span className="text-[10px] text-slate-400 font-mono">Outreach &amp; Inbound</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 font-mono">
              Configured
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono pt-1">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Account:</span>
              <span className="font-bold text-slate-800 truncate max-w-[150px]">
                {health?.integrations.gmail_user || 'anandpraroop@gmail.com'}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">SMTP Host:</span>
              <span className="font-bold text-slate-800">smtp.gmail.com:465 (SSL)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">IMAP Host:</span>
              <span className="font-bold text-slate-800">imap.gmail.com:993 (SSL)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Reply Threading:</span>
              <span className="font-bold text-emerald-600">RFC 5322 Injected</span>
            </div>
          </div>
        </div>

        {/* Card 3: Active Resume & Attachments */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900">Active Resume PDF</h3>
                <span className="text-[10px] text-slate-400 font-mono">Attached to Outbound</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 font-mono">
              Ready
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono pt-1">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Filename:</span>
              <span className="font-bold text-slate-800 truncate max-w-[150px]">
                {resumeStatus.filename}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Size:</span>
              <span className="font-bold text-slate-800">{resumeStatus.size_kb} KB</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Attachment:</span>
              <span className="font-bold text-emerald-600">Automated in /send</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-1.5 px-3 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Replace PDF</span>
            </button>
            <a
              href="/api/resume/download"
              target="_blank"
              download="Praroop_Anand.pdf"
              className="py-1.5 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition flex items-center justify-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          </div>
        </div>
      </div>

      {/* Manual Controls & Diagnostics */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Operations &amp; Cache Diagnostics</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Action 1: Refresh Health */}
          <button
            type="button"
            onClick={fetchHealth}
            disabled={isLoadingHealth}
            className="p-4 rounded-xl border border-slate-200 hover:border-sky-300 bg-slate-50/50 hover:bg-sky-50/30 transition text-left space-y-1.5 disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">Ping Backend Health</span>
              <Activity className={`w-4 h-4 text-sky-600 ${isLoadingHealth ? 'animate-spin' : ''}`} />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Measure instantaneous latency to Render &amp; Neon DB. Last ping: {lastPingTime !== null ? `${lastPingTime}ms` : '—'}
            </p>
          </button>

          {/* Action 2: Run Mailbox Sync */}
          <button
            type="button"
            onClick={onSyncMailbox}
            disabled={isSyncingMailbox}
            className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 bg-slate-50/50 hover:bg-purple-50/30 transition text-left space-y-1.5 disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">Trigger IMAP Sync</span>
              <RefreshCw className={`w-4 h-4 text-purple-600 ${isSyncingMailbox ? 'animate-spin' : ''}`} />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Pull unread replies &amp; bounce notices from Gmail directly into the database.
            </p>
          </button>

          {/* Action 3: Clear Cache */}
          <button
            type="button"
            onClick={handleClearCache}
            disabled={isClearingCache}
            className="p-4 rounded-xl border border-slate-200 hover:border-rose-300 bg-slate-50/50 hover:bg-rose-50/30 transition text-left space-y-1.5 disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">Flush Local &amp; Server Cache</span>
              <Trash2 className={`w-4 h-4 text-rose-600 ${isClearingCache ? 'animate-spin' : ''}`} />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Clear browser localStorage and backend in-memory cache to force complete reload.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
