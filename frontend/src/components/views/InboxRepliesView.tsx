"use client";

import React, { useState, useMemo } from 'react';
import { 
  Inbox, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Mail, 
  Send, 
  Search, 
  ChevronRight, 
  Sparkles,
  ArrowUpRight,
  ExternalLink,
  Clock,
  UserCheck
} from 'lucide-react';

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

export default function InboxRepliesView({
  replies,
  isSyncing,
  onSyncMailbox,
  openLeadDrawer,
  openComposeByLeadId,
  onUpdateLeadStatus,
  showToast
}: InboxRepliesViewProps) {
  const [selectedReply, setSelectedReply] = useState<ProspectReply | null>(replies[0] || null);
  const [inboxFilter, setInboxFilter] = useState<'ALL' | 'REPLIES' | 'BOUNCES'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync initial selection
  React.useEffect(() => {
    if (replies.length > 0 && (!selectedReply || !replies.some(r => r.id === selectedReply.id))) {
      setSelectedReply(replies[0]);
    }
  }, [replies]);

  // Compute Metrics
  const metrics = useMemo(() => {
    let bounceCount = 0;
    let replyCount = 0;

    replies.forEach(r => {
      const isBounce = (r.sender || '').includes('mailer-daemon') || (r.subject || '').includes('BOUNCE') || (r.subject || '').includes('Delivery Status');
      if (isBounce) bounceCount++;
      else replyCount++;
    });

    return {
      total: replies.length,
      bounces: bounceCount,
      replies: replyCount
    };
  }, [replies]);

  // Filter messages
  const filteredReplies = useMemo(() => {
    return replies.filter(r => {
      const isBounce = (r.sender || '').includes('mailer-daemon') || (r.subject || '').includes('BOUNCE') || (r.subject || '').includes('Delivery Status');
      if (inboxFilter === 'REPLIES' && isBounce) return false;
      if (inboxFilter === 'BOUNCES' && !isBounce) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sender = (r.sender || '').toLowerCase();
        const name = (r.lead_name || '').toLowerCase();
        const comp = (r.lead_company || '').toLowerCase();
        const subj = (r.subject || '').toLowerCase();
        const snip = (r.snippet || '').toLowerCase();
        return sender.includes(q) || name.includes(q) || comp.includes(q) || subj.includes(q) || snip.includes(q);
      }

      return true;
    });
  }, [replies, inboxFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Inbound Messages</span>
            <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-950 mt-2 font-mono">
            {metrics.total}
          </div>
          <p className="text-xs text-slate-400 mt-1">Processed from Gmail via IMAP SSL</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Prospect Replies</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-600 mt-2 font-mono">
            {metrics.replies}
          </div>
          <p className="text-xs text-slate-400 mt-1">Direct replies and interested founders</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Detected Bounces</div>
            <div className="text-3xl font-bold text-rose-600 mt-2 font-mono">
              {metrics.bounces}
            </div>
            <p className="text-xs text-slate-400 mt-1">Auto-flagged invalid addresses</p>
          </div>
          <button
            type="button"
            onClick={onSyncMailbox}
            disabled={isSyncing}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-sky-50 hover:border-sky-300 transition shadow-2xs flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </section>

      {/* Main 2-Column Split Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Messages Feed (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Mailbox Feed</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
              {filteredReplies.length} items
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search sender, company, or subject..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 font-medium"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5 text-xs">
            {(['ALL', 'REPLIES', 'BOUNCES'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setInboxFilter(tab)}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  inboxFilter === tab
                    ? 'bg-rose-100 text-rose-900 font-bold border border-rose-300'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab === 'ALL' ? 'All Messages' : tab === 'REPLIES' ? 'Replies Only' : 'Bounces'}
              </button>
            ))}
          </div>

          {/* Messages list scroll */}
          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {filteredReplies.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl p-4 space-y-1">
                <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">No messages found</p>
                <p className="text-[11px] text-slate-400">Click &ldquo;Sync Now&rdquo; to fetch latest messages from Gmail.</p>
              </div>
            ) : (
              filteredReplies.map(reply => {
                const isSelected = selectedReply?.id === reply.id;
                const isBounce = (reply.sender || '').includes('mailer-daemon') || (reply.subject || '').includes('BOUNCE') || (reply.subject || '').includes('Delivery Status');

                return (
                  <div
                    key={reply.id}
                    onClick={() => setSelectedReply(reply)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition relative group ${
                      isSelected
                        ? 'bg-rose-50/70 border-rose-400 ring-2 ring-rose-500/10 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-slate-900 truncate">
                        {reply.lead_name || reply.sender}
                      </div>
                      <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] shrink-0 font-bold ${
                        isBounce ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isBounce ? 'BOUNCE' : 'REPLY'}
                      </span>
                    </div>

                    <div className="text-[11px] font-semibold text-slate-800 mt-1 truncate">
                      {reply.subject}
                    </div>

                    {reply.snippet && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {reply.snippet}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                      <span>{reply.lead_company || 'Lead'}</span>
                      <span className="font-mono">
                        {reply.sent_at ? new Date(reply.sent_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Message Detail & Response Actions (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          {selectedReply ? (
            <div className="space-y-6">
              {/* Header card */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedReply.subject}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">From: {selectedReply.sender}</span>
                    <span>&bull;</span>
                    <span className="font-mono text-[11px]">
                      {selectedReply.sent_at ? new Date(selectedReply.sent_at).toLocaleString() : ''}
                    </span>
                  </div>
                </div>

                {selectedReply.lead_id && (
                  <button
                    type="button"
                    onClick={() => openLeadDrawer(selectedReply.lead_id!)}
                    className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition inline-flex items-center gap-1 shrink-0"
                  >
                    <span>View Contact History</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Prospect Metadata Card */}
              {selectedReply.lead_id && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Associated Lead</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {selectedReply.lead_name} ({selectedReply.lead_company})
                    </div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      {selectedReply.lead_email}
                    </div>
                  </div>

                  {/* Status update actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateLeadStatus(selectedReply.lead_id!, 'INTERESTED')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                    >
                      Mark Interested
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateLeadStatus(selectedReply.lead_id!, 'REPLIED')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                    >
                      Mark Replied
                    </button>
                    <button
                      type="button"
                      onClick={() => openComposeByLeadId(selectedReply.lead_id!)}
                      className="px-3 py-1 text-[11px] font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-lg shadow-2xs transition flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>Reply Now</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Message Body Content */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Message Content
                </div>
                <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 text-xs font-sans text-slate-800 whitespace-pre-wrap leading-relaxed min-h-[160px]">
                  {selectedReply.snippet || 'No message preview content available.'}
                </div>
              </div>

              {/* Guidance Notice */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">IMAP Sync Engine:</span> Responses and bounce notifications are automatically classified and attached to your leads table every 5 minutes.
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-24 text-slate-400 text-xs space-y-2">
              <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">Select a message from the list</p>
              <p className="text-slate-400">Click any message on the left to inspect its details and take action.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
