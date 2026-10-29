"use client";

import React, { useEffect, useState } from 'react';
import { Database, Eraser, FileText, Mail, RefreshCw, Server, Upload } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/primitives';

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

function Dot({ ok }: { ok: boolean | undefined }) {
  return (
    <span className={`relative flex h-2 w-2`}>
      {ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${ok === undefined ? 'bg-slate-300' : ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-[13px]">
      <span className="text-slate-400">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-slate-700">{value}</span>
    </div>
  );
}

function Panel({ icon, title, status, children, footer }: { icon: React.ReactNode; title: string; status?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="card flex flex-col">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-200/70">{icon}</span>
        <span className="flex-1 text-[13px] font-semibold text-slate-900">{title}</span>
        {status}
      </div>
      <div className="flex-1 divide-y divide-slate-100 px-5 py-1.5">{children}</div>
      {footer && <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 rounded-b-2xl">{footer}</div>}
    </div>
  );
}

export default function SystemSettingsView({ resumeStatus, fileInputRef, isSyncingMailbox, onSyncMailbox, showToast, fetchData, apiFetch }: SystemSettingsViewProps) {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [roundTrip, setRoundTrip] = useState<number | null>(null);

  const fetchHealth = async () => {
    setIsLoading(true);
    const start = performance.now();
    try {
      const res = await apiFetch('/api/system/health');
      if (res.ok) {
        setHealth(await res.json());
        setRoundTrip(Math.round(performance.now() - start));
      }
    } catch (e: any) {
      showToast(`Backend unreachable: ${e.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearCache = async () => {
    setIsClearing(true);
    try {
      ['cached_outreach_leads', 'cached_outreach_analytics', 'cached_outreach_templates'].forEach(k => localStorage.removeItem(k));
      const res = await apiFetch('/api/system/cache/clear', { method: 'POST' });
      if (res.ok) {
        showToast('Caches cleared');
        await Promise.all([fetchData(), fetchHealth()]);
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const online = health ? health.status === 'ok' : undefined;
  const skeleton = <span className="skeleton inline-block h-3 w-20 align-middle" />;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Contacts', value: health?.stats.total_leads },
          { label: 'Messages logged', value: health?.stats.total_messages },
          { label: 'Link clicks', value: health?.stats.total_clicks },
          { label: 'Round trip', value: roundTrip, suffix: 'ms' },
        ].map(s => (
          <div key={s.label} className="card p-4 sm:p-5">
            <div className="text-[13px] font-medium text-slate-500">{s.label}</div>
            <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-slate-900">
              {s.value == null ? <span className="skeleton inline-block h-7 w-16" /> : <><AnimatedNumber value={s.value} />{s.suffix && <span className="ml-1 text-sm font-medium text-slate-400">{s.suffix}</span>}</>}
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          icon={<Server className="h-3.5 w-3.5" />}
          title="Backend"
          status={<span className="inline-flex items-center gap-2 text-xs text-slate-500"><Dot ok={online} />{online === undefined ? 'Checking' : online ? 'Online' : 'Down'}</span>}
          footer={
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={fetchHealth} disabled={isLoading} className="btn btn-secondary btn-sm">
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Recheck
              </button>
              <button type="button" onClick={clearCache} disabled={isClearing} className="btn btn-ghost btn-sm">
                <Eraser className="h-3.5 w-3.5" />
                {isClearing ? 'Clearing' : 'Clear caches'}
              </button>
            </div>
          }
        >
          <Row label="Host" value="Render" />
          <Row label="Cached keys" value={health ? health.stats.cache_keys_cached : skeleton} />
          <Row label="Keep-alive" value="GitHub Actions, every 5 min" />
        </Panel>

        <Panel
          icon={<Database className="h-3.5 w-3.5" />}
          title="Database"
          status={<span className="inline-flex items-center gap-2 text-xs text-slate-500"><Dot ok={health?.database.connected} />{health ? (health.database.connected ? 'Connected' : 'Error') : 'Checking'}</span>}
        >
          <Row label="Provider" value={health ? health.database.provider : skeleton} />
          <Row label="Query latency" value={health ? `${Math.round(health.database.latency_ms)} ms` : skeleton} />
          {health?.database.error && <Row label="Error" value={<span className="text-rose-600">{health.database.error}</span>} />}
        </Panel>

        <Panel
          icon={<Mail className="h-3.5 w-3.5" />}
          title="Gmail"
          status={<span className="inline-flex items-center gap-2 text-xs text-slate-500"><Dot ok={health?.integrations.gmail_configured} />{health ? (health.integrations.gmail_configured ? 'Configured' : 'Missing app password') : 'Checking'}</span>}
          footer={
            <button type="button" onClick={onSyncMailbox} disabled={isSyncingMailbox} className="btn btn-secondary btn-sm">
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingMailbox ? 'animate-spin' : ''}`} />
              {isSyncingMailbox ? 'Syncing' : 'Sync inbox now'}
            </button>
          }
        >
          <Row label="Account" value={health ? health.integrations.gmail_user : skeleton} />
          <Row label="Sending" value={health ? health.integrations.smtp_server : skeleton} />
          <Row label="Reading" value={health ? health.integrations.imap_server : skeleton} />
        </Panel>

        <Panel
          icon={<FileText className="h-3.5 w-3.5" />}
          title="Resume"
          status={<span className="inline-flex items-center gap-2 text-xs text-slate-500"><Dot ok={resumeStatus.exists} />{resumeStatus.exists ? 'On file' : 'Missing'}</span>}
          footer={
            <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-secondary btn-sm">
              <Upload className="h-3.5 w-3.5" />
              Replace PDF
            </button>
          }
        >
          <Row label="File" value={resumeStatus.filename} />
          <Row label="Size" value={`${resumeStatus.size_kb} KB`} />
          <Row label="Attached" value="Only on application templates" />
        </Panel>
      </div>
    </div>
  );
}
