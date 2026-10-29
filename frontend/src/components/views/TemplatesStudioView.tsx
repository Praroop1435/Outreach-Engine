"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, Layers, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { EmptyState, SegmentedTabs } from '@/components/ui/primitives';
import { useConfirm } from '@/components/ui/overlay';

export interface Template {
  id: number;
  name: string;
  subject_template: string;
  body_template: string;
  category: string;
}

interface TemplatesStudioViewProps {
  templates: Template[];
  fetchData: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<Response>;
}

type FormState = Omit<Template, 'id'> & { id: number };

const EMPTY_FORM: FormState = {
  id: 0,
  name: '',
  category: 'Cold Outreach',
  subject_template: 'Loom for {{company}}',
  body_template:
    "Hi {{firstName}},\n\nBeen reading up on {{company}}, especially {{custom_hook}}.\n\nI'm Praroop, an AI engineer at Relu Consultancy. Here's a short Loom of something I shipped:\nhttps://www.loom.com/share/5f715f784c3142e690f16f8df66f3799\n\nI'm looking for a remote AI or backend role. Open to a 15 minute call this week? Happy to start with a small paid trial.\n\nPraroop\nhttps://praroop.site",
};

const CATEGORIES = ['Cold Outreach', 'Job Application', 'Follow-up', 'Custom'];
const TOKENS = ['{{firstName}}', '{{company}}', '{{job_role}}', '{{custom_hook}}'];

const SAMPLE = {
  firstName: 'Manish',
  company: 'Clickpe',
  role: 'Co-Founder',
  job_role: 'Backend Engineer',
  custom_hook: 'your agentic lending workflows',
};

function fill(text: string) {
  return text
    .replace(/{{\s*(firstName|first_name)\s*}}/gi, SAMPLE.firstName)
    .replace(/{{\s*company\s*}}/gi, SAMPLE.company)
    .replace(/{{\s*(job_role|target_role)\s*}}/gi, SAMPLE.job_role)
    .replace(/{{\s*role\s*}}/gi, SAMPLE.role)
    .replace(/{{\s*custom_hook\s*}}/gi, SAMPLE.custom_hook);
}

function toForm(t: Template): FormState {
  return { id: t.id, name: t.name, category: t.category, subject_template: t.subject_template, body_template: t.body_template };
}

export default function TemplatesStudioView({ templates, fetchData, showToast, apiFetch }: TemplatesStudioViewProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(JSON.stringify(EMPTY_FORM));
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { askConfirm, confirmDialog } = useConfirm();
  const [view, setView] = useState<'edit' | 'preview'>('edit');

  const select = (t: Template) => {
    setSelectedId(t.id);
    setForm(toForm(t));
    setSavedSnapshot(JSON.stringify(toForm(t)));
  };

  const startNew = () => {
    setSelectedId(0);
    setForm(EMPTY_FORM);
    setSavedSnapshot('');
    setView('edit');
  };

  // Keep a valid selection whenever the list changes (first load, cache refresh, delete)
  useEffect(() => {
    if (selectedId === 0) return;
    const current = templates.find(t => t.id === selectedId);
    if (current) return;
    if (templates[0]) select(templates[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter(t => {
      if (category !== 'ALL' && t.category !== category) return false;
      if (!q) return true;
      return [t.name, t.subject_template, t.body_template].some(v => v.toLowerCase().includes(q));
    });
  }, [templates, category, query]);

  const categoryTabs = useMemo(() => {
    const present = CATEGORIES.filter(c => templates.some(t => t.category === c));
    return [{ id: 'ALL', label: 'All', count: templates.length }, ...present.map(c => ({ id: c, label: c.replace('Job Application', 'Applications'), count: templates.filter(t => t.category === c).length }))];
  }, [templates]);

  const dirty = JSON.stringify(form) !== savedSnapshot;
  const words = form.body_template.trim() ? form.body_template.trim().split(/\s+/).length : 0;
  const links = (form.body_template.match(/https?:\/\//g) || []).length;
  const hasDashes = /[—–]/.test(form.subject_template + form.body_template);
  const hasLoom = /loom\.com/.test(form.body_template);
  const checks = [
    { ok: words > 0 && words <= 120, label: `${words} words`, hint: 'under 120' },
    { ok: links <= 3, label: `${links} links`, hint: '3 or fewer' },
    { ok: hasLoom, label: hasLoom ? 'Has a Loom' : 'No Loom', hint: 'add one' },
    { ok: !hasDashes, label: hasDashes ? 'Has em dashes' : 'No em dashes', hint: 'remove them' },
  ];

  const insertToken = (token: string) => setForm(f => ({ ...f, body_template: `${f.body_template}${f.body_template.endsWith(' ') || !f.body_template ? '' : ' '}${token}` }));

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.name.trim() || !form.subject_template.trim() || !form.body_template.trim()) {
      showToast('Give it a name, subject and body first', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiFetch(form.id ? `/api/templates/${form.id}` : '/api/templates', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not save template');
      showToast(`Saved "${form.name}"`);
      setSelectedId(data.id ?? form.id);
      setForm(f => ({ ...f, id: data.id ?? f.id }));
      setSavedSnapshot(JSON.stringify({ ...form, id: data.id ?? form.id }));
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!form.id) return;
    const ok = await askConfirm({
      title: 'Delete this template?',
      description: <><span className="font-medium text-slate-700">{form.name}</span> will be removed permanently. Emails already sent with it are not affected.</>,
      confirmLabel: 'Delete template',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const res = await apiFetch(`/api/templates/${form.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete template');
      showToast('Template deleted');
      setSelectedId(null);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const duplicate = () => {
    setSelectedId(0);
    setForm(f => ({ ...f, id: 0, name: `${f.name} (copy)` }));
    setSavedSnapshot('');
  };

  // Cmd/Ctrl+S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Library */}
      <aside className="card flex flex-col overflow-hidden lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)]">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-slate-900">Library</span>
            <button type="button" onClick={startNew} className="btn btn-secondary btn-sm">
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search templates" className="input h-9 py-0 pl-8" />
          </div>
          <SegmentedTabs tabs={categoryTabs} value={category} onChange={setCategory} />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <EmptyState icon={<Layers className="h-5 w-5" />} title="No templates" description="Nothing matches this filter." />
          ) : (
            <div className="stagger space-y-1">
              {filtered.map((t, i) => {
                const active = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => select(t)}
                    style={{ '--i': i } as React.CSSProperties}
                    className={`w-full rounded-xl px-3 py-2.5 text-left ${active ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-[13px] font-medium ${active ? 'text-brand-800' : 'text-slate-800'}`}>{t.name}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{t.category.replace('Job Application', 'Application')}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-400">{t.subject_template}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Editor */}
      <form onSubmit={save} className="card flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{form.id ? form.name || 'Untitled' : 'New template'}</h2>
              {dirty && <span className="chip border-amber-200 bg-amber-50 text-amber-700 animate-fade-in">Unsaved</span>}
            </div>
            <p className="text-xs text-slate-400">Placeholders are filled from each contact when you send</p>
          </div>
          <SegmentedTabs tabs={[{ id: 'edit', label: 'Write' }, { id: 'preview', label: 'Preview' }]} value={view} onChange={id => setView(id as 'edit' | 'preview')} />
        </div>

        <div className="flex-1 space-y-4 px-5 py-5">
          {view === 'edit' ? (
            <div key="edit" className="space-y-4 animate-fade-in">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                <div>
                  <label className="label">Name</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Founder cold email" className="input" />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Subject</label>
                <input value={form.subject_template} onChange={e => setForm({ ...form, subject_template: e.target.value })} placeholder="Loom for {{company}}" className="input font-medium" />
              </div>
              <div>
                <label className="label">Body</label>
                <textarea rows={14} value={form.body_template} onChange={e => setForm({ ...form, body_template: e.target.value })} className="input" />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Insert</span>
                  {TOKENS.map(tok => (
                    <button key={tok} type="button" onClick={() => insertToken(tok)} className="chip border-slate-200 bg-white font-mono text-slate-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
                      {tok}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div key="preview" className="animate-fade-in">
              <div className="overflow-hidden rounded-xl ring-1 ring-slate-200/80">
                <div className="space-y-1 border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-[13px]">
                  <div><span className="text-slate-400">To </span><span className="text-slate-700">{SAMPLE.firstName} at {SAMPLE.company}</span></div>
                  <div className="font-semibold text-slate-900">{fill(form.subject_template) || 'No subject'}</div>
                </div>
                <div className="whitespace-pre-wrap px-4 py-4 text-[13px] leading-relaxed text-slate-800">{fill(form.body_template)}</div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Sample contact: {SAMPLE.firstName}, {SAMPLE.role} at {SAMPLE.company}, applying for {SAMPLE.job_role}</p>
            </div>
          )}

          {/* Guardrails */}
          <div className="flex flex-wrap gap-2">
            {checks.map(c => (
              <span key={c.label} className={`chip transition-colors ${c.ok ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                {c.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {c.label}
                {!c.ok && <span className="text-amber-600/80">, {c.hint}</span>}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 rounded-b-2xl">
          {form.id ? (
            <>
              <button type="button" onClick={remove} className="btn btn-danger btn-sm">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <button type="button" onClick={duplicate} className="btn btn-ghost btn-sm">
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </button>
            </>
          ) : null}
          <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
            <span className="kbd">⌘</span><span className="kbd">S</span> to save
          </span>
          <button type="submit" disabled={isSaving || !dirty} className="btn btn-primary min-w-[110px]">
            {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {isSaving ? 'Saving' : form.id ? 'Save changes' : 'Create'}
          </button>
        </div>
      </form>
      {confirmDialog}
    </div>
  );
}
