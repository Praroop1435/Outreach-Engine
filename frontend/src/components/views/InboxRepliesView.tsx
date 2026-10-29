"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AlertOctagon, ArrowUpRight, Inbox, Mail, RefreshCw, Search, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Avatar, EmptyState, SegmentedTabs, StatusBadge } from '@/components/ui/primitives';
import { formatDateTime, formatRelative } from '@/lib/format';

export interface ProspectReply {
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

interface InboxRepliesViewProps {
  replies: ProspectReply[];
  isSyncing: boolean;
  onSyncMailbox: () => void;
  openLeadDrawer: (leadId: number) => void;
  openComposeByLeadId: (leadId: number) => void;
  onUpdateLeadStatus: (leadId: number, status: string) => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

const isBounce = (r: ProspectReply) =>
  (r.sender || '').includes('mailer-daemon') || /bounce|delivery status/i.test(r.subject || '');

export default function InboxRepliesView({ replies, isSyncing, onSyncMailbox, openLeadDrawer, openComposeByLeadId, onUpdateLeadStatus }: InboxRepliesViewProps) {
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const counts = useMemo(() => {
    const bounces = replies.filter(isBounce).length;
    return { all: replies.length, replies: replies.length - bounces, bounces };
  }, [replies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return replies.filter(r => {
      if (filter === 'REPLIES' && isBounce(r)) return false;
      if (filter === 'BOUNCES' && !isBounce(r)) return false;
      if (!q) return true;
      return [r.sender, r.lead_name, r.lead_company, r.subject, r.snippet].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [replies, filter, query]);

  useEffect(() => {
    if (!filtered.some(r => r.id === selectedId)) setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const selected = filtered.find(r => r.id === selectedId) || null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SegmentedTabs
          tabs={[
            { id: 'ALL', label: 'All', count: counts.all },
            { id: 'REPLIES', label: 'Replies', count: counts.replies },
            { id: 'BOUNCES', label: 'Bounces', count: counts.bounces },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search sender, company, subject" className="input pl-9" />
        </div>
      </div>

      {replies.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="Inbox is empty"
            description="Replies and bounces appear here after each Gmail sync. The background job checks every few minutes."
            action={
              <button type="button" onClick={onSyncMailbox} disabled={isSyncing} className="btn btn-secondary btn-sm">
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync now
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* List */}
          <div className="card overflow-hidden lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
            {filtered.length === 0 ? (
              <EmptyState icon={<Search className="h-5 w-5" />} title="Nothing matches" description="Try another filter or search." />
            ) : (
              <ul className="stagger divide-y divide-slate-100">
                {filtered.map((r, i) => {
                  const bounce = isBounce(r);
                  const active = r.id === selectedId;
                  return (
                    <li key={r.id} style={{ '--i': i } as React.CSSProperties}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className={`relative flex w-full gap-3 px-4 py-3.5 text-left ${active ? 'bg-brand-50/60' : 'hover:bg-slate-50/80'}`}
                      >
                        <span className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full transition-colors ${active ? 'bg-brand-600' : 'bg-transparent'}`} />
                        {bounce ? (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 ring-2 ring-white">
                            <AlertOctagon className="h-4 w-4" />
                          </span>
                        ) : (
                          <Avatar name={r.lead_name || r.sender} />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] font-medium text-slate-900">{bounce ? `Bounce · ${r.lead_company || 'Unknown'}` : r.lead_name || r.sender}</span>
                            <span className="shrink-0 text-[11px] text-slate-400">{formatRelative(r.sent_at)}</span>
                          </span>
                          <span className="block truncate text-xs text-slate-500">{bounce ? r.lead_email || r.recipient : r.subject}</span>
                          {!bounce && r.snippet && <span className="mt-0.5 block truncate text-xs text-slate-400">{r.snippet}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Detail */}
          <div className="card min-w-0">
            {selected ? (
              <div key={selected.id} className="animate-fade-in">
                <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{selected.subject || 'No subject'}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {selected.lead_name || selected.sender}
                      {selected.lead_company ? ` · ${selected.lead_company}` : ''} · {formatDateTime(selected.sent_at)}
                    </p>
                  </div>
                  {selected.lead_status && <StatusBadge status={selected.lead_status} />}
                </div>

                <div className="px-5 py-5">
                  {isBounce(selected) && (
                    <div className="mb-4 rounded-xl bg-rose-50/70 p-3.5 text-[13px] text-rose-800 ring-1 ring-rose-100">
                      This address doesn&apos;t exist, so the email never arrived. Find the right contact on their site or LinkedIn before trying again.
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{selected.snippet || 'No preview available.'}</div>
                </div>

                {selected.lead_id && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 rounded-b-2xl">
                    <button type="button" onClick={() => openLeadDrawer(selected.lead_id!)} className="btn btn-secondary btn-sm">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Open contact
                    </button>
                    {!isBounce(selected) && (
                      <>
                        <button type="button" onClick={() => onUpdateLeadStatus(selected.lead_id!, 'INTERESTED')} className="btn btn-ghost btn-sm">
                          <ThumbsUp className="h-3.5 w-3.5" />
                          Interested
                        </button>
                        <button type="button" onClick={() => onUpdateLeadStatus(selected.lead_id!, 'NOT_INTERESTED')} className="btn btn-ghost btn-sm">
                          <ThumbsDown className="h-3.5 w-3.5" />
                          Not interested
                        </button>
                        <button type="button" onClick={() => openComposeByLeadId(selected.lead_id!)} className="btn btn-primary btn-sm ml-auto">
                          <Mail className="h-3.5 w-3.5" />
                          Reply
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState icon={<Inbox className="h-5 w-5" />} title="Pick a message" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
