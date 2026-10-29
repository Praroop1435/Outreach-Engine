"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Activity,
  Inbox,
  LayoutDashboard,
  Layers,
  MousePointerClick,
  Paperclip,
  SendHorizontal,
  Share2,
  Upload,
} from 'lucide-react';
import type { SidebarTab } from '@/app/page';

export interface SidebarCounts {
  pipeline: number;
  founders: number;
  templates: number;
  clicks: number;
  inbox: number;
}

interface NavItem {
  id: SidebarTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: (c: SidebarCounts) => number | undefined;
  alert?: boolean;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Workspace',
    items: [
      { id: 'pipeline', label: 'Pipeline', icon: LayoutDashboard, count: c => c.pipeline },
      { id: 'founder_dms', label: 'Founder DMs', icon: SendHorizontal, count: c => c.founders },
      { id: 'inbox', label: 'Inbox', icon: Inbox, count: c => c.inbox || undefined, alert: true },
    ],
  },
  {
    title: 'Tools',
    items: [
      { id: 'templates', label: 'Templates', icon: Layers, count: c => c.templates },
      { id: 'clicks', label: 'Link clicks', icon: MousePointerClick, count: c => c.clicks || undefined },
      { id: 'settings', label: 'System & sync', icon: Activity },
    ],
  },
];

// The share view only shows outreach progress: no inbox, templates, clicks or settings
const SHARE_NAV_IDS: SidebarTab[] = ['pipeline', 'founder_dms'];

function shareLink() {
  const url = new URL(window.location.href);
  url.searchParams.set('view', 'share');
  if (!SHARE_NAV_IDS.includes(url.searchParams.get('tab') as SidebarTab)) url.searchParams.set('tab', 'pipeline');
  return url.toString();
}

interface SidebarProps {
  active: SidebarTab;
  onNavigate: (tab: SidebarTab) => void;
  counts: SidebarCounts;
  backendOnline: boolean | null;
  resumeFilename: string;
  resumeSizeKb: number;
  onUploadResume: () => void;
  email: string;
  shareMode: boolean;
}

export function SidebarContent({ active, onNavigate, counts, backendOnline, resumeFilename, resumeSizeKb, onUploadResume, email, shareMode }: SidebarProps) {
  const groups = shareMode
    ? NAV_GROUPS.map(g => ({ ...g, items: g.items.filter(i => SHARE_NAV_IDS.includes(i.id)) })).filter(g => g.items.length > 0)
    : NAV_GROUPS;

  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  const measure = useCallback(() => {
    const el = navRef.current?.querySelector<HTMLButtonElement>(`[data-nav="${active}"]`);
    if (el) setIndicator({ top: el.offsetTop, height: el.offsetHeight });
  }, [active]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2">
        <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight text-slate-900 leading-none">Outreach</div>
          {shareMode ? (
            <div className="mt-1 text-[11px] text-slate-400">Job search progress</div>
          ) : <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                backendOnline === null ? 'bg-slate-300' : backendOnline ? 'bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129/0.15)]' : 'bg-rose-500'
              }`}
            />
            {backendOnline === null ? 'Connecting' : backendOnline ? 'Backend online' : 'Backend offline'}
          </div>}
        </div>
      </div>

      {/* Navigation */}
      <nav ref={navRef} className="relative mt-7 flex-1 space-y-6">
        {indicator && (
          <span
            className="absolute left-0 right-0 rounded-xl bg-white ring-1 ring-slate-200/80 transition-[top,height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ top: indicator.top, height: indicator.height, boxShadow: 'var(--shadow-soft)' }}
          />
        )}
        {groups.map(group => (
          <div key={group.title}>
            <div className="eyebrow mb-1.5 px-3">{group.title}</div>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const isActive = item.id === active;
                const count = item.count?.(counts);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    data-nav={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`relative z-10 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium ${
                      isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-900/[0.035]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {count !== undefined && (
                      <span
                        className={`tabular-nums text-[11px] font-medium ${
                          item.alert && count > 0
                            ? 'rounded-full bg-brand-600 px-1.5 py-px text-white'
                            : isActive ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Resume + account (hidden in the share view) */}
      {!shareMode && <div className="space-y-3 pt-4">
        <button
          type="button"
          onClick={() => window.open(shareLink(), '_blank', 'noopener')}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-900/[0.035] hover:text-slate-900"
          title="Open a read-only view without your email, resume or backend details"
        >
          <Share2 className="h-4 w-4 text-slate-400" />
          Open share view
        </button>
        <button
          type="button"
          onClick={onUploadResume}
          className="group flex w-full items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-2.5 text-left hover:border-slate-300"
          style={{ boxShadow: 'var(--shadow-soft)' }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500 ring-1 ring-rose-100">
            <Paperclip className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-slate-800">{resumeFilename}</div>
            <div className="text-[11px] text-slate-400">{resumeSizeKb} KB resume</div>
          </div>
          <Upload className="h-3.5 w-3.5 text-slate-300 group-hover:text-brand-600" />
        </button>
        <div className="truncate px-2 text-[11px] text-slate-400">{email}</div>
      </div>}
    </div>
  );
}
