"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

/* ---------------- Animated number (count-up) ---------------- */

export function AnimatedNumber({ value, duration = 700 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = value;
    };
  }, [value, duration]);

  return <span className="tabular-nums">{display.toLocaleString()}</span>;
}

/* ---------------- Segmented tabs with sliding pill ---------------- */

export interface SegmentedTab {
  id: string;
  label: string;
  count?: number;
}

export function SegmentedTabs({ tabs, value, onChange }: { tabs: SegmentedTab[]; value: string; onChange: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  const measure = useCallback(() => {
    const el = containerRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(value)}"]`);
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure, tabs]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className="max-w-full overflow-x-auto [scrollbar-width:none]">
      <div ref={containerRef} className="relative inline-flex items-center gap-0.5 rounded-xl bg-slate-100/80 p-1 ring-1 ring-inset ring-slate-200/60">
        {pill && (
          <span
            className="absolute top-1 bottom-1 rounded-lg bg-white ring-1 ring-slate-200/70 transition-[left,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ left: pill.left, width: pill.width, boxShadow: 'var(--shadow-soft)' }}
          />
        )}
        {tabs.map(tab => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium ${
                active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`tabular-nums text-[11px] ${active ? 'text-brand-600 font-semibold' : 'text-slate-400'}`}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Avatar with stable color ---------------- */

const AVATAR_TONES = [
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const clean = name.trim() || '?';
  const initials = clean.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) | 0;
  const tone = AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
  const dims = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-[11px]';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white ${dims} ${tone}`}>
      {initials}
    </span>
  );
}

/* ---------------- Status badge ---------------- */

const STATUS_STYLES: Record<string, { label: string; dot: string; cls: string }> = {
  NOT_CONTACTED: { label: 'Not contacted', dot: 'bg-slate-400', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  CONTACTED: { label: 'Contacted', dot: 'bg-brand-500', cls: 'bg-brand-50 text-brand-700 border-brand-100' },
  FOLLOWED_UP: { label: 'Followed up', dot: 'bg-indigo-500', cls: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  REPLIED: { label: 'Replied', dot: 'bg-emerald-500', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  INTERESTED: { label: 'Interested', dot: 'bg-teal-500', cls: 'bg-teal-50 text-teal-700 border-teal-100' },
  NOT_INTERESTED: { label: 'Not interested', dot: 'bg-slate-400', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  BOUNCED: { label: 'Bounced', dot: 'bg-rose-500', cls: 'bg-rose-50 text-rose-700 border-rose-100' },
  INVALID_EMAIL: { label: 'Invalid email', dot: 'bg-rose-500', cls: 'bg-rose-50 text-rose-700 border-rose-100' },
  ARCHIVED: { label: 'Archived', dot: 'bg-slate-300', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  PENDING_DM: { label: 'Pending check', dot: 'bg-amber-500', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  DM_STAGED: { label: 'DM ready', dot: 'bg-sky-500', cls: 'bg-sky-50 text-sky-700 border-sky-100' },
  DM_OPEN: { label: 'DM open', dot: 'bg-emerald-500', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  DMED: { label: 'DMed', dot: 'bg-violet-500', cls: 'bg-violet-50 text-violet-700 border-violet-100' },
  DM_CLOSED: { label: 'DM closed', dot: 'bg-slate-400', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  INVALID_PROFILE: { label: 'Invalid profile', dot: 'bg-rose-500', cls: 'bg-rose-50 text-rose-700 border-rose-100' },
};

export function StatusBadge({ status }: { status: string }) {
  const key = (status || '').toUpperCase();
  const s = STATUS_STYLES[key] || { label: key.replace(/_/g, ' ').toLowerCase(), dot: 'bg-slate-400', cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* ---------------- Empty state ---------------- */

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-in">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-200/70">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Toasts ---------------- */

export interface Toast {
  id: number;
  text: string;
  type: 'success' | 'error';
  leaving?: boolean;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 220);
  }, []);

  const push = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    const id = nextId.current++;
    setToasts(prev => [...prev.slice(-3), { id, text, type }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return { toasts, push, dismiss };
}

export function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col items-end gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex w-full sm:w-auto sm:max-w-sm items-start gap-2.5 rounded-xl bg-slate-900 px-3.5 py-3 text-[13px] text-slate-100 ring-1 ring-white/10
            transition-[opacity,transform] duration-200 ${t.leaving ? 'opacity-0 translate-y-2 scale-[0.98]' : 'animate-fade-up'}`}
          style={{ boxShadow: 'var(--shadow-float)' }}
        >
          {t.type === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <span className="flex-1 leading-snug">{t.text}</span>
          <button type="button" onClick={() => onDismiss(t.id)} className="text-slate-500 hover:text-slate-200" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Table skeleton ---------------- */

export function SkeletonRows({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-slate-100 last:border-0">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-4">
              {c === 0 ? (
                <div className="flex items-center gap-3">
                  <div className="skeleton h-8 w-8 rounded-full" />
                  <div className="space-y-1.5">
                    <div className="skeleton h-3 w-28" />
                    <div className="skeleton h-2.5 w-16" />
                  </div>
                </div>
              ) : (
                <div className="skeleton h-3" style={{ width: `${40 + ((r * 7 + c * 13) % 45)}%` }} />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
