"use client";

import React from 'react';
import { ArrowUpRight, Copy, MessageCircle, Send } from 'lucide-react';
import { Avatar, EmptyState } from '@/components/ui/primitives';
import { formatRelative } from '@/lib/format';

interface DmContact {
  lead_id: number;
  name: string;
  company?: string;
  handle: string;
  chat_url: string;
}

export interface DmReply extends DmContact {
  text: string;
  received_at: string;
  status: string;
}

export interface DmFollowUp extends DmContact {
  draft: string;
  last_sent_at: string;
  follow_up_number: number;
}

export interface DmActivity {
  replies: DmReply[];
  follow_ups: DmFollowUp[];
  last_run: { started_at: string; finished_at?: string; conversations: number; new_replies: number; error?: string } | null;
}

interface DmActivityListProps {
  mode: 'REPLIED' | 'FOLLOW_UP';
  activity: DmActivity;
  query: string;
  onCopy: (text: string, name: string) => void;
}

export default function DmActivityList({ mode, activity, query, onCopy }: DmActivityListProps) {
  const q = query.trim().toLowerCase();
  const matches = (c: DmContact) => !q || `${c.name} ${c.company} ${c.handle}`.toLowerCase().includes(q);
  const replies = mode === 'REPLIED' ? activity.replies.filter(matches) : [];
  const followUps = mode === 'FOLLOW_UP' ? activity.follow_ups.filter(matches) : [];
  const run = activity.last_run;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {run?.error ? `Last check failed: ${run.error}` : run ? `Last checked X ${formatRelative(run.finished_at || run.started_at)} · ${run.conversations} chats read` : 'Not checked yet'}
      </p>

      {replies.length === 0 && followUps.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={mode === 'REPLIED' ? <MessageCircle className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            title={mode === 'REPLIED' ? 'No DM replies yet' : 'No follow-ups due'}
            description={mode === 'REPLIED' ? 'Click Refresh DMs to check X for new replies.' : 'A follow-up shows up here 3 days after a DM with no reply.'}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {replies.map(r => (
            <Row key={r.lead_id} contact={r} when={`Replied ${formatRelative(r.received_at)}`} text={r.text}>
              <a href={r.chat_url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                Open chat
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </Row>
          ))}
          {followUps.map(f => (
            <Row key={f.lead_id} contact={f} when={`Last DM ${formatRelative(f.last_sent_at)} · follow-up ${f.follow_up_number}`} text={f.draft}>
              <button type="button" onClick={() => onCopy(f.draft, f.name)} className="btn btn-primary btn-sm">
                <Copy className="h-3 w-3" />
                Copy follow-up
              </button>
              <a href={f.chat_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                Open chat
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </Row>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ contact, when, text, children }: { contact: DmContact; when: string; text: string; children: React.ReactNode }) {
  return (
    <li className="card p-4 sm:p-5 animate-fade-up">
      <div className="flex items-start gap-3">
        <Avatar name={contact.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-semibold text-slate-900">{contact.name}</span>
            <a href={`https://x.com/${contact.handle}`} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-brand-600">@{contact.handle}</a>
            {contact.company && <span className="text-xs text-slate-400">{contact.company}</span>}
            <span className="text-xs text-slate-400 sm:ml-auto">{when}</span>
          </div>
          <p className="mt-2 whitespace-pre-line break-words text-[13px] leading-relaxed text-slate-700">{text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">{children}</div>
        </div>
      </div>
    </li>
  );
}
