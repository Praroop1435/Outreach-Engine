"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Bookmark, CheckCircle2, Clock, Radar, RefreshCw, Search, X as XIcon } from 'lucide-react';
import { Avatar, EmptyState, SegmentedTabs } from '@/components/ui/primitives';
import { formatRelative } from '@/lib/format';

export interface XJobPost {
  id: number;
  url: string;
  handle: string;
  author_name?: string;
  text: string;
  links: { href: string; text: string }[];
  query?: string;
  posted_at?: string;
  score: number;
  tags: string[];
  pay?: string;
  status: 'NEW' | 'SAVED' | 'APPLIED' | 'DISMISSED';
  already_contacted: boolean;
  first_seen_at: string;
}

export interface XRadarSummary {
  counts: Record<XJobPost['status'], number>;
  last_run: { started_at: string; finished_at?: string; posts_seen: number; new_matches: number; error?: string } | null;
  last_success_at: string | null;
}

interface XRadarViewProps {
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<Response>;
  showToast: (text: string, type?: 'success' | 'error') => void;
  onSummary?: (summary: XRadarSummary) => void;
}

const TAG_STYLES: Record<string, string> = {
  ai: 'bg-violet-50 text-violet-700 border-violet-100',
  backend: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'full-stack': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
  eng: 'bg-slate-50 text-slate-600 border-slate-200',
  'intern/junior': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  remote: 'bg-sky-50 text-sky-700 border-sky-100',
  india: 'bg-amber-50 text-amber-700 border-amber-100',
  pay: 'bg-teal-50 text-teal-700 border-teal-100',
};
const HIDDEN_TAGS = new Set(['pay']); // pay is shown with its amount instead

function scoreTone(score: number) {
  if (score >= 9) return 'bg-emerald-600 text-white';
  if (score >= 7) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}

export default function XRadarView({ apiFetch, showToast, onSummary }: XRadarViewProps) {
  const [filter, setFilter] = useState<XJobPost['status'] | 'ALL'>('NEW');
  const [posts, setPosts] = useState<XJobPost[]>([]);
  const [summary, setSummary] = useState<XRadarSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const [listRes, sumRes] = await Promise.all([apiFetch(`/api/x-jobs?status=${filter}`), apiFetch('/api/x-jobs/summary')]);
      if (listRes.ok) setPosts(await listRes.json());
      if (sumRes.ok) {
        const s = await sumRes.json();
        setSummary(s);
        onSummary?.(s);
      }
    } catch {
      showToast('Could not load X Radar', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, filter, onSummary, showToast]);

  useEffect(() => {
    setIsLoading(true);
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const setStatus = async (post: XJobPost, status: XJobPost['status']) => {
    const prev = posts;
    setPosts(p => (filter === 'ALL' ? p.map(x => (x.id === post.id ? { ...x, status } : x)) : p.filter(x => x.id !== post.id)));
    setSummary(s => s && { ...s, counts: { ...s.counts, [post.status]: s.counts[post.status] - 1, [status]: s.counts[status] + 1 } });
    try {
      const res = await apiFetch(`/api/x-jobs/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPosts(prev);
      showToast('Could not update post', 'error');
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? posts.filter(p => `${p.text} ${p.handle} ${p.author_name}`.toLowerCase().includes(q)) : posts;
  }, [posts, query]);

  const c = summary?.counts;
  const lastRun = summary?.last_run;

  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Radar className="h-4 w-4" />
            {lastRun && !lastRun.error && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900">
              {lastRun?.error ? 'Last scan failed' : 'Scanning X every 45 minutes'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {lastRun?.error
                ? lastRun.error
                : summary?.last_success_at
                  ? `Last scan ${formatRelative(summary.last_success_at)} · ${lastRun?.posts_seen ?? 0} posts read, ${lastRun?.new_matches ?? 0} new matches`
                  : 'Waiting for the first scan from your Mac'}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => { setIsLoading(true); load(); }} className="btn btn-secondary btn-sm self-start sm:self-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SegmentedTabs
          tabs={[
            { id: 'NEW', label: 'New', count: c?.NEW },
            { id: 'SAVED', label: 'Saved', count: c?.SAVED },
            { id: 'APPLIED', label: 'Applied', count: c?.APPLIED },
            { id: 'DISMISSED', label: 'Dismissed', count: c?.DISMISSED },
            { id: 'ALL', label: 'All' },
          ]}
          value={filter}
          onChange={id => setFilter(id as XJobPost['status'] | 'ALL')}
        />
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search posts" className="input pl-8" />
        </div>
      </div>

      {!isLoading && visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Radar className="h-5 w-5" />}
            title={filter === 'NEW' ? 'No new job posts right now' : 'Nothing here yet'}
            description={filter === 'NEW' ? 'The radar checks X every 45 minutes while your Mac is awake. Strong matches also pop a notification.' : undefined}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((p, i) => {
            const isOpen = expanded.has(p.id);
            const long = p.text.length > 320;
            return (
              <li key={p.id} className="card p-4 sm:p-5 animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <div className="flex items-start gap-3">
                  <Avatar name={p.author_name || p.handle} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13px] font-semibold text-slate-900 truncate max-w-[14rem]">{p.author_name || p.handle}</span>
                      <a href={`https://x.com/${p.handle}`} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-brand-600">@{p.handle}</a>
                      <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelative(p.posted_at || p.first_seen_at)}
                      </span>
                      {p.already_contacted && (
                        <span className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">Already contacted</span>
                      )}
                      <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${scoreTone(p.score)}`} title="Match score">
                        {p.score}
                      </span>
                    </div>

                    <p className={`mt-2 whitespace-pre-line break-words text-[13px] leading-relaxed text-slate-700 ${long && !isOpen ? 'line-clamp-6' : ''}`}>
                      {p.text}
                    </p>
                    {long && (
                      <button
                        type="button"
                        onClick={() => setExpanded(s => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                        className="mt-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        {isOpen ? 'Show less' : 'Show more'}
                      </button>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {p.pay && (
                        <span className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">{p.pay}</span>
                      )}
                      {p.tags.filter(t => !HIDDEN_TAGS.has(t)).map(t => (
                        <span key={t} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${TAG_STYLES[t] || 'bg-rose-50 text-rose-700 border-rose-100'}`}>{t}</span>
                      ))}
                      {p.links.filter((l, idx, all) => all.findIndex(o => o.href === l.href) === idx).slice(0, 2).map(l => (
                        <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="inline-flex max-w-[16rem] items-center gap-1 truncate rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:border-brand-200 hover:text-brand-700">
                          <ArrowUpRight className="h-3 w-3 shrink-0" />
                          <span className="truncate">{l.text || l.href}</span>
                        </a>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                      <a href={p.url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                        Open on X
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                      {p.status !== 'SAVED' && (
                        <button type="button" onClick={() => setStatus(p, 'SAVED')} className="btn btn-secondary btn-sm">
                          <Bookmark className="h-3 w-3" /> Save
                        </button>
                      )}
                      {p.status !== 'APPLIED' && (
                        <button type="button" onClick={() => setStatus(p, 'APPLIED')} className="btn btn-secondary btn-sm">
                          <CheckCircle2 className="h-3 w-3" /> Applied
                        </button>
                      )}
                      {p.status !== 'DISMISSED' && (
                        <button type="button" onClick={() => setStatus(p, 'DISMISSED')} className="btn btn-ghost btn-sm ml-auto">
                          <XIcon className="h-3 w-3" /> Not for me
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
