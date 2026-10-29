"use client";

import React, { useMemo } from 'react';
import { ArrowUpRight, Link2, MousePointerClick, RefreshCw, Users } from 'lucide-react';
import { AnimatedNumber, Avatar, EmptyState } from '@/components/ui/primitives';
import { formatRelative } from '@/lib/format';

export interface LinkClick {
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

interface ClicksTrackingViewProps {
  clicks: LinkClick[];
  isLoading: boolean;
  onRefresh: () => void;
  openLeadDrawer: (leadId: number) => void;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

function linkLabel(url: string) {
  if (/loom\.com/.test(url)) return 'Loom demo';
  if (/github\.com/.test(url)) return 'GitHub';
  if (/praroop\.site/.test(url)) return 'Portfolio';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function ClicksTrackingView({ clicks, isLoading, onRefresh, openLeadDrawer }: ClicksTrackingViewProps) {
  const stats = useMemo(() => {
    const people = new Set(clicks.map(c => c.lead_id)).size;
    const byLink = new Map<string, number>();
    clicks.forEach(c => byLink.set(linkLabel(c.target_url), (byLink.get(linkLabel(c.target_url)) || 0) + 1));
    const top = [...byLink.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total: clicks.length, people, top: top ? `${top[0]} (${top[1]})` : 'None yet' };
  }, [clicks]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Total clicks', value: <AnimatedNumber value={stats.total} />, icon: <MousePointerClick className="h-4 w-4" /> },
          { label: 'People who clicked', value: <AnimatedNumber value={stats.people} />, icon: <Users className="h-4 w-4" /> },
          { label: 'Most opened', value: stats.top, icon: <Link2 className="h-4 w-4" />, small: true },
        ].map(s => (
          <div key={s.label} className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-slate-500">{s.label}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">{s.icon}</span>
            </div>
            <div className={`mt-3 font-semibold tracking-tight text-slate-900 ${s.small ? 'truncate text-lg' : 'text-[28px] leading-none'}`}>{s.value}</div>
          </div>
        ))}
      </section>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <span className="text-[13px] font-semibold text-slate-900">Recent clicks</span>
          <button type="button" onClick={onRefresh} disabled={isLoading} className="btn btn-ghost btn-sm">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoading && clicks.length === 0 ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
        ) : clicks.length === 0 ? (
          <EmptyState
            icon={<MousePointerClick className="h-5 w-5" />}
            title="No clicks recorded"
            description="Click tracking is off by default because redirect links hurt inbox placement. Turn it on per email in the compose window if you want to measure a batch."
          />
        ) : (
          <ul className="stagger divide-y divide-slate-100">
            {clicks.map((c, i) => (
              <li key={c.id} style={{ '--i': i } as React.CSSProperties}>
                <button type="button" onClick={() => c.lead_id && openLeadDrawer(c.lead_id)} className="group flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50/80">
                  <Avatar name={c.lead_name || 'Prospect'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-900">
                      {c.lead_name || 'Prospect'}
                      {c.lead_company && <span className="font-normal text-slate-400"> · {c.lead_company}</span>}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      Opened <span className="font-medium text-brand-600">{linkLabel(c.target_url)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{formatRelative(c.clicked_at)}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-brand-600" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
