"use client";

import React, { useState, useMemo } from 'react';
import { 
  MousePointerClick, 
  ExternalLink, 
  Search, 
  RefreshCw, 
  Users, 
  TrendingUp, 
  Globe, 
  Sparkles,
  ChevronRight,
  Filter
} from 'lucide-react';

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

export default function ClicksTrackingView({
  clicks,
  isLoading,
  onRefresh,
  openLeadDrawer,
  showToast
}: ClicksTrackingViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [destinationFilter, setDestinationFilter] = useState<'ALL' | 'portfolio' | 'loom' | 'github'>('ALL');

  // Compute Analytics Metrics
  const metrics = useMemo(() => {
    const total = clicks.length;
    const uniqueLeads = new Set(clicks.map(c => c.lead_id)).size;
    
    let portfolioCount = 0;
    let loomCount = 0;
    let githubCount = 0;

    clicks.forEach(c => {
      const u = (c.target_url || '').toLowerCase();
      if (u.includes('praroop.site')) portfolioCount++;
      else if (u.includes('loom.com')) loomCount++;
      else if (u.includes('github.com')) githubCount++;
    });

    return {
      total,
      uniqueLeads,
      portfolioCount,
      loomCount,
      githubCount
    };
  }, [clicks]);

  // Filter clicks
  const filteredClicks = useMemo(() => {
    return clicks.filter(c => {
      if (destinationFilter !== 'ALL') {
        const u = (c.target_url || '').toLowerCase();
        if (destinationFilter === 'portfolio' && !u.includes('praroop.site')) return false;
        if (destinationFilter === 'loom' && !u.includes('loom.com')) return false;
        if (destinationFilter === 'github' && !u.includes('github.com')) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (c.lead_name || '').toLowerCase();
        const comp = (c.lead_company || '').toLowerCase();
        const email = (c.lead_email || '').toLowerCase();
        const url = (c.target_url || '').toLowerCase();
        const source = (c.utm_source || '').toLowerCase();
        return name.includes(q) || comp.includes(q) || email.includes(q) || url.includes(q) || source.includes(q);
      }

      return true;
    });
  }, [clicks, destinationFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Total Clicks</span>
            <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-950 mt-2 font-mono">
            {metrics.total}
          </div>
          <p className="text-xs text-slate-400 mt-1">Tracked link interactions</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Engaged Prospects</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-950 mt-2 font-mono">
            {metrics.uniqueLeads}
          </div>
          <p className="text-xs text-slate-400 mt-1">Unique prospects clicked</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Portfolio Visits</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-950 mt-2 font-mono">
            {metrics.portfolioCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">praroop.site views</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Loom Demos Watched</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-950 mt-2 font-mono">
            {metrics.loomCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">InsightFlow demo views</p>
        </div>
      </section>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-sm text-slate-900">Live Click Event Stream</h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800 font-bold">
              {filteredClicks.length} events
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search prospect or URL..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>

            {/* Target Filter */}
            <div className="flex items-center gap-1 text-xs">
              {(['ALL', 'portfolio', 'loom', 'github'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDestinationFilter(tab)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    destinationFilter === tab
                      ? 'bg-cyan-100 text-cyan-900 font-bold border border-cyan-300'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {tab === 'ALL' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-60"
              title="Refresh click events"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-500 mb-2" />
              <span>Fetching telemetry data from Neon DB...</span>
            </div>
          ) : filteredClicks.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs p-6 space-y-2">
              <MousePointerClick className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No click telemetry recorded yet</p>
              <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                When prospects click links in your outreach emails, their visits to your portfolio or Loom demos will show up here with real-time attribution tokens.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Prospect</th>
                  <th className="py-3 px-4">Destination Link</th>
                  <th className="py-3 px-4">UTM Attribution</th>
                  <th className="py-3 px-4">Time Clicked</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClicks.map(click => (
                  <tr key={click.id} className="hover:bg-cyan-50/30 transition group">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {click.lead_name || 'Prospect'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {click.lead_company || 'Lead'} {click.lead_email ? `• ${click.lead_email}` : ''}
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <a
                        href={click.target_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-600 hover:text-cyan-800 font-semibold truncate group-hover:underline max-w-[280px]"
                      >
                        <span className="truncate">{click.target_url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </td>

                    <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                      <div><span className="text-slate-400">src:</span> {click.utm_source || 'direct'}</div>
                      {click.utm_campaign && <div><span className="text-slate-400">camp:</span> {click.utm_campaign}</div>}
                    </td>

                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {click.clicked_at ? new Date(click.clicked_at).toLocaleString() : 'Recent'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {click.lead_id ? (
                        <button
                          type="button"
                          onClick={() => openLeadDrawer(click.lead_id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg transition inline-flex items-center gap-1"
                        >
                          <span>View Contact</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
