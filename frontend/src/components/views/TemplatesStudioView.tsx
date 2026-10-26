"use client";

import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  Eye, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  FileText,
  Search,
  CheckCircle2
} from 'lucide-react';

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

export default function TemplatesStudioView({
  templates,
  fetchData,
  showToast,
  apiFetch
}: TemplatesStudioViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(templates[0] || null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    id: number;
    name: string;
    category: string;
    subject_template: string;
    body_template: string;
  }>({
    id: 0,
    name: '',
    category: 'Cold Outreach',
    subject_template: '',
    body_template: ''
  });

  // Sample lead data for real-time live preview
  const sampleLead = {
    first_name: 'Manish',
    company: 'Clickpe',
    role: 'SDE Intern',
    custom_hook: 'autonomous agent workflows'
  };

  // Switch template or create new
  const handleSelectTemplate = (tpl: Template) => {
    setIsCreatingNew(false);
    setSelectedTemplate(tpl);
    setFormData({
      id: tpl.id,
      name: tpl.name,
      category: tpl.category,
      subject_template: tpl.subject_template,
      body_template: tpl.body_template
    });
  };

  const handleStartNew = () => {
    setIsCreatingNew(true);
    setSelectedTemplate(null);
    setFormData({
      id: 0,
      name: '',
      category: 'Cold Outreach',
      subject_template: 'Engineering & AI systems for {{company}}: Praroop Anand',
      body_template: 'Hi {{firstName}},\n\nSaw what you are building at {{company}} regarding {{custom_hook}}.\n\nI build production AI workflows and scalable backend systems (FastAPI, Next.js, PostgreSQL, Redis, Docker). Dropped a quick Loom demo of an enterprise intelligence platform I built, plus my portfolio:\n\nLoom: https://www.loom.com/share/5f715f784c3142e690f16f8df66f3799\nPortfolio: https://praroop.site\n\nResume attached. Would love to build a quick proof of concept if you have an active engineering backlog!\n\nBest,\nPraroop'
    });
  };

  // Sync initial selection
  React.useEffect(() => {
    if (!isCreatingNew && templates.length > 0 && (!selectedTemplate || !templates.some(t => t.id === selectedTemplate.id))) {
      handleSelectTemplate(templates[0]);
    }
  }, [templates]);

  // Insert token pill
  const handleInsertToken = (token: string, targetField: 'subject' | 'body') => {
    if (targetField === 'subject') {
      setFormData(prev => ({ ...prev, subject_template: prev.subject_template + ` ${token}` }));
    } else {
      setFormData(prev => ({ ...prev, body_template: prev.body_template + ` ${token}` }));
    }
  };

  // Check for forbidden dashes (em dash, en dash, spaced hyphens)
  const hasForbiddenDashes = useMemo(() => {
    const text = `${formData.subject_template} ${formData.body_template}`;
    return /[\u2014\u2013]|(\s-\s)/.test(text);
  }, [formData.subject_template, formData.body_template]);

  // Rendered live preview text
  const renderedSubject = useMemo(() => {
    return formData.subject_template
      .replace(/{{first_name}}|{{firstName}}/gi, sampleLead.first_name)
      .replace(/{{company}}/gi, sampleLead.company)
      .replace(/{{role}}|{{job_role}}/gi, sampleLead.role)
      .replace(/{{custom_hook}}/gi, sampleLead.custom_hook);
  }, [formData.subject_template]);

  const renderedBody = useMemo(() => {
    return formData.body_template
      .replace(/{{first_name}}|{{firstName}}/gi, sampleLead.first_name)
      .replace(/{{company}}/gi, sampleLead.company)
      .replace(/{{role}}|{{job_role}}/gi, sampleLead.role)
      .replace(/{{custom_hook}}/gi, sampleLead.custom_hook);
  }, [formData.body_template]);

  // Filter templates list
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.subject_template.toLowerCase().includes(q) || t.body_template.toLowerCase().includes(q);
      }
      return true;
    });
  }, [templates, categoryFilter, searchQuery]);

  // Save template
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.subject_template.trim() || !formData.body_template.trim()) {
      showToast('All template fields are required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      let res;
      if (formData.id) {
        res = await apiFetch(`/api/templates/${formData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        res = await apiFetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save template');
      }

      showToast(`Template "${formData.name}" saved!`);
      await fetchData();
      setIsCreatingNew(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete template
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template permanently?')) return;
    try {
      const res = await apiFetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
      showToast('Template deleted successfully');
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Quick copy raw text
  const handleCopyRaw = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Template body copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Active Templates</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-slate-950 mt-2 font-mono">
            {templates.length}
          </div>
          <p className="text-xs text-slate-400 mt-1">Pre-tested high-converting cold pitches</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Formatting Guardrail</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-emerald-600 mt-2 flex items-center gap-1.5">
            <span>Zero Em Dashes</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Strict human tone enforcement</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loom &amp; Proof of Work</div>
            <div className="text-xs font-mono text-sky-600 font-bold mt-1.5 truncate max-w-[200px]">
              InsightFlow + Portfolio
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Embedded in default drafts</p>
          </div>
          <button
            type="button"
            onClick={handleStartNew}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-xs transition shrink-0 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Pitch</span>
          </button>
        </div>
      </section>

      {/* Main 2-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Template Cards List (4 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Template Library</h3>
            <button
              type="button"
              onClick={handleStartNew}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates or subjects..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {['ALL', 'Cold Outreach', 'Follow-up', 'Job Application'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  categoryFilter === cat
                    ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template Cards Scroll */}
          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl p-4">
                No templates match this filter
              </div>
            ) : (
              filteredTemplates.map(tpl => {
                const isSelected = !isCreatingNew && selectedTemplate?.id === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition relative group ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-500/10 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-slate-900 truncate">
                        {tpl.name}
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] shrink-0 font-medium">
                        {tpl.category}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 mt-1 font-medium truncate">
                      Subj: <span className="text-slate-800">{tpl.subject_template}</span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {tpl.body_template}
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                      <span>{tpl.body_template.split(/\s+/).length} words</span>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleCopyRaw(tpl.body_template, tpl.id); }}
                          className="p-1 hover:text-slate-700 rounded"
                          title="Copy raw template"
                        >
                          {copiedId === tpl.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(tpl.id); }}
                          className="p-1 hover:text-rose-600 rounded"
                          title="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Editor & Real-Time Preview (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isCreatingNew ? 'Create New Pitch Template' : `Editing: ${formData.name || 'Template'}`}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Variables are auto-replaced with contact metadata during dispatch
              </p>
            </div>
            {formData.id > 0 && (
              <button
                type="button"
                onClick={() => handleDelete(formData.id)}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Template Name & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Template Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Founder Quick Pitch (AI Systems)"
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 font-medium text-slate-900"
                >
                  <option value="Cold Outreach">Cold Outreach</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Job Application">Job Application</option>
                  <option value="Founder X DM">Founder X DM</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>

            {/* Subject Template */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Subject Line Template <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-slate-400">Insert:</span>
                  <button
                    type="button"
                    onClick={() => handleInsertToken('{{company}}', 'subject')}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono"
                  >
                    {"{{company}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertToken('{{role}}', 'subject')}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono"
                  >
                    {"{{role}}"}
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={formData.subject_template}
                onChange={e => setFormData({ ...formData, subject_template: e.target.value })}
                placeholder="e.g. Engineering & AI systems for {{company}}: Praroop Anand"
                className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 font-medium text-slate-900"
              />
            </div>

            {/* Variable Token Quick-Pills for Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Email Body Template <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  <span className="text-slate-400 font-medium">Click to insert:</span>
                  {[
                    { label: '{{first_name}}', token: '{{first_name}}' },
                    { label: '{{company}}', token: '{{company}}' },
                    { label: '{{role}}', token: '{{role}}' },
                    { label: '{{custom_hook}}', token: '{{custom_hook}}' }
                  ].map(t => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => handleInsertToken(t.token, 'body')}
                      className="px-1.5 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 font-mono border border-amber-200 transition"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={9}
                value={formData.body_template}
                onChange={e => setFormData({ ...formData, body_template: e.target.value })}
                placeholder="Compose your personalized outreach message here..."
                className="w-full p-3.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 font-sans leading-relaxed text-slate-900"
              />
            </div>

            {/* Dash Guardrail Alert */}
            {hasForbiddenDashes && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Human Tone Warning:</span> Forbidden dash detected (em dash &ldquo;—&rdquo;, en dash &ldquo;–&rdquo;, or spaced hyphen &ldquo; - &rdquo;).
                  Please remove them so messages sound completely natural and human.
                </div>
              </div>
            )}

            {/* Live Rendered Preview Card */}
            <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-600" />
                  Live Rendered Preview
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Sample: {sampleLead.first_name} @ {sampleLead.company}
                </span>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-xs space-y-2 font-sans">
                <div className="font-bold text-slate-900">
                  Subject: <span className="font-semibold text-slate-700">{renderedSubject}</span>
                </div>
                <div className="text-slate-800 whitespace-pre-wrap leading-relaxed text-[11px] pt-1 border-t border-slate-100">
                  {renderedBody}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              {isCreatingNew && (
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-xs transition disabled:opacity-60 flex items-center gap-1.5"
              >
                {isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isCreatingNew ? 'Create Template' : 'Save Changes'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
