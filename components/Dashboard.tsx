'use client';

/**
 * Main Dashboard Component — Apple-inspired clean design
 * Now driven by admin config for tab/column visibility, theming, and data display settings
 */

import { useAppStore } from '@/lib/store';
import { GMAnalytics } from '@/lib/data-processor';
import { useMemo, useState } from 'react';
import React from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useAdminConfig } from '@/lib/AdminConfigContext';
import { getVisibleColumns, formatPct } from '@/lib/admin-config';

type DashboardTab = 'overview' | 'seasons' | 'playoffs' | 'h2h';

const COLORS = ['#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA', '#FF6B35', '#5856D6', '#30D158', '#64D2FF', '#BF5AF2'];

const seasonLabel = (s: string) => `${s}-${(parseInt(s) + 1).toString().slice(-2)}`;

// Shared card wrapper — uses CSS variables for theming
function Card({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      className={`bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl border border-gray-200/60 dark:border-white/10 ${className}`}
      style={{ borderRadius: 'var(--card-border-radius)', boxShadow: 'var(--card-shadow)' }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-6 py-5">
      <h3 className="text-[17px] font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h3>
      {subtitle && <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function StatBox({ value, label, className = '' }: { value: string | number; label: string; className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <div className="text-[28px] font-bold tracking-tight text-gray-900 dark:text-white">{value}</div>
      <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { gmAnalytics, setSelectedGM, leagueData } = useAppStore();
  const config = useAdminConfig();

  const visibleTabs = useMemo(() => {
    return config.tabs
      .filter(t => t.visible)
      .sort((a, b) => a.order - b.order)
      .map(t => ({ key: t.key as DashboardTab, label: t.label }));
  }, [config.tabs]);

  const [activeTab, setActiveTab] = useState<DashboardTab | null>(null);

  // Set default tab to first visible
  const currentTab = activeTab && visibleTabs.some(t => t.key === activeTab)
    ? activeTab
    : visibleTabs[0]?.key || 'overview';

  const sortedGMs = useMemo(() => {
    if (!gmAnalytics) return [];
    const arr = Array.from(gmAnalytics.values());
    // Sort by GOAT titles (championships) desc, then win percentage desc
    return arr.sort((a, b) => {
      if (b.championships !== a.championships) return b.championships - a.championships;
      return b.winPercentage - a.winPercentage;
    });
  }, [gmAnalytics]);


  const allSeasons = useMemo(() => {
    const s = new Set<string>();
    sortedGMs.forEach(gm => Object.keys(gm.seasons).forEach(sz => s.add(sz)));
    return Array.from(s).sort();
  }, [sortedGMs]);

  const leagueStats = useMemo(() => {
    if (!sortedGMs.length) return null;
    return {
      totalGMs: sortedGMs.length,
      totalSeasons: allSeasons.length,
      uniqueChampions: sortedGMs.filter(gm => gm.championships > 0).length,
      totalGames: sortedGMs.reduce((sum, gm) => sum + gm.totalWins + gm.totalLosses + gm.totalTies, 0),
    };
  }, [sortedGMs, allSeasons]);

  if (!gmAnalytics || !sortedGMs.length) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">No data available</p>
        <p className="text-sm mt-1">Select a league to get started.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      {/* League Header */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-black dark:to-gray-900 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[28px] font-bold tracking-tight">{leagueData?.name || 'League Analytics'}</h2>
            <p className="text-[15px] text-white/60 mt-1">
              {allSeasons.length > 0 && `${seasonLabel(allSeasons[0])} to ${seasonLabel(allSeasons[allSeasons.length - 1])}`}
            </p>
          </div>
          <a href="/admin" className="text-white/30 hover:text-white/60 transition-colors" title="Admin Settings">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { v: leagueStats?.totalGMs, l: 'GMs' },
            { v: leagueStats?.totalSeasons, l: 'Seasons' },
            { v: leagueStats?.uniqueChampions, l: 'GOAT Winners' },
            { v: leagueStats?.totalGames, l: 'Games' },
          ].map(s => (
            <div key={s.l} className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="text-[24px] font-bold">{s.v}</div>
              <div className="text-[11px] font-medium text-white/50 uppercase tracking-wider">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Segmented Control (Apple-style tabs) */}
      {visibleTabs.length > 1 && (
        <div className="flex gap-0.5 bg-gray-100 dark:bg-[#2c2c2e] rounded-xl p-1 overflow-x-auto">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-0 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap ${
                currentTab === tab.key
                  ? 'bg-white dark:bg-[#3a3a3c] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {currentTab === 'overview' && <OverviewTab sortedGMs={sortedGMs} allSeasons={allSeasons} onSelectGM={setSelectedGM} />}
      {currentTab === 'seasons' && <SeasonsTab sortedGMs={sortedGMs} allSeasons={allSeasons} onSelectGM={setSelectedGM} />}
      {currentTab === 'playoffs' && <PlayoffsTab sortedGMs={sortedGMs} allSeasons={allSeasons} onSelectGM={setSelectedGM} />}
      {currentTab === 'h2h' && <HeadToHeadTab sortedGMs={sortedGMs} onSelectGM={setSelectedGM} />}
    </div>
  );
}

// ============================================================================
// OVERVIEW
// ============================================================================

function OverviewTab({ sortedGMs, allSeasons, onSelectGM }: { sortedGMs: GMAnalytics[]; allSeasons: string[]; onSelectGM: (id: string) => void }) {
  const config = useAdminConfig();
  const visibleCols = getVisibleColumns('overview-power-rankings', config);

  const trendData = useMemo(() => allSeasons.map(season => {
    const entry: any = { season: seasonLabel(season) };
    sortedGMs.forEach(gm => { if (gm.seasons[season]) entry[gm.managerName] = gm.seasons[season].rank; });
    return entry;
  }), [sortedGMs, allSeasons]);

  const seasonCount = allSeasons.length;
  const useArea = config.dataDisplay.chartPreferences.rankingTrends === 'area';

  // Column renderer map
  const colRenderers: Record<string, (gm: GMAnalytics, i: number) => React.ReactNode> = {
    rank: (gm, i) => (
      <td key="rank" className="px-4 py-3.5">
        <span className={`text-[13px] font-bold ${i < 3 ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{i + 1}</span>
      </td>
    ),
    gm: (gm, i) => (
      <td key="gm" className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[13px] font-bold`}
            style={{ backgroundColor: i === 0 ? 'var(--color-primary)' : i === 1 ? '#6b7280' : i === 2 ? 'var(--color-warning)' : '#d1d5db' }}>
            {gm.managerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-[14px] font-semibold text-gray-900 dark:text-white">{gm.managerName}</div>
            <div className="text-[11px] text-gray-400">{Object.keys(gm.seasons).length} seasons</div>
          </div>
        </div>
      </td>
    ),
    avgRank: (gm) => (
      <td key="avgRank" className="px-4 py-3.5 text-[14px] font-bold tabular-nums text-gray-900 dark:text-white" title="Average finish position across all seasons (lower = better)">{gm.overallRanking.toFixed(config.dataDisplay.decimalPlaces)}</td>
    ),
    record: (gm) => (
      <td key="record" className="px-4 py-3.5 text-[13px] tabular-nums">
        <span style={{ color: 'var(--color-success)' }} className="font-semibold">{gm.totalWins}</span>
        <span className="text-gray-300 dark:text-gray-600 mx-0.5">-</span>
        <span style={{ color: 'var(--color-danger)' }} className="font-semibold">{gm.totalLosses}</span>
        {gm.totalTies > 0 && <><span className="text-gray-300 mx-0.5">-</span><span className="text-gray-500">{gm.totalTies}</span></>}
      </td>
    ),
    winPct: (gm) => (
      <td key="winPct" className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="w-12 h-[5px] bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{
              width: `${gm.winPercentage * 100}%`,
              backgroundColor: gm.winPercentage >= 0.55 ? 'var(--color-success)' : gm.winPercentage >= 0.45 ? 'var(--color-warning)' : 'var(--color-danger)',
            }} />
          </div>
          <span className="text-[12px] tabular-nums font-medium text-gray-500">{formatPct(gm.winPercentage, config.dataDisplay)}</span>
        </div>
      </td>
    ),
    bestWorst: (gm) => (
      <td key="bestWorst" className="px-4 py-3.5 text-[13px] tabular-nums text-gray-500">
        <span style={{ color: 'var(--color-success)' }} className="font-medium">{gm.bestFinish || '-'}</span>
        <span className="text-gray-300 mx-1">/</span>
        <span style={{ color: 'var(--color-danger)' }}>{gm.worstFinish || '-'}</span>
      </td>
    ),
    playoffs: (gm) => (
      <td key="playoffs" className="px-4 py-3.5 text-[13px] tabular-nums text-gray-500 font-medium">{gm.playoffAppearances}/{seasonCount}</td>
    ),
    titles: (gm) => (
      <td key="titles" className="px-4 py-3.5">
        {gm.championships > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
            {gm.championships}x
          </span>
        ) : <span className="text-[13px] text-gray-300 dark:text-gray-600">-</span>}
      </td>
    ),
    trend: (gm) => {
      const trend = gm.rankingTrend;
      const tDir = trend.length >= 2 ? trend[trend.length - 1].rank - trend[trend.length - 2].rank : 0;
      return (
        <td key="trend" className="px-4 py-3.5">
          {tDir < 0 ? <span style={{ color: 'var(--color-success)' }} className="text-[12px] font-bold">+{Math.abs(tDir)}</span>
           : tDir > 0 ? <span style={{ color: 'var(--color-danger)' }} className="text-[12px] font-bold">-{tDir}</span>
           : <span className="text-gray-300 text-[12px]">--</span>}
        </td>
      );
    },
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Power Rankings" subtitle="Click any GM for detailed breakdown" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-gray-100 dark:border-white/5">
                {visibleCols.map(col => (
                  <th key={col.key} className="px-4 py-3 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-left">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedGMs.map((gm, i) => {
                const id = gm.managerGuid || gm.managerId;
                return (
                  <tr key={id} onClick={() => onSelectGM(id)} className="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/5 cursor-pointer transition-colors">
                    {visibleCols.map(col => colRenderers[col.key]?.(gm, i))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {trendData.length > 1 && (
        <Card className="p-6">
          <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-1">Ranking Trends</h3>
          <p className="text-[13px] text-gray-400 mb-5">Lower = better (1st place at top)</p>
          <ResponsiveContainer width="100%" height={320}>
            {useArea ? (
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="season" stroke="#9ca3af" style={{ fontSize: '11px' }} />
                <YAxis reversed stroke="#9ca3af" style={{ fontSize: '11px' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1c1c1e', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} formatter={(v: number, n: string) => [`Rank ${v}`, n]} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {sortedGMs.map((gm, i) => (
                  <Area key={gm.managerGuid || gm.managerId} type="monotone" dataKey={gm.managerName} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} connectNulls />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="season" stroke="#9ca3af" style={{ fontSize: '11px' }} />
                <YAxis reversed stroke="#9ca3af" style={{ fontSize: '11px' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1c1c1e', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} formatter={(v: number, n: string) => [`Rank ${v}`, n]} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {sortedGMs.map((gm, i) => (
                  <Line key={gm.managerGuid || gm.managerId} type="monotone" dataKey={gm.managerName} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} connectNulls />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </Card>
      )}

      {/* Category Win Rates */}
      {sortedGMs.length > 0 && Object.keys(sortedGMs[0].categoryDominance).length > 0 && (
        <CategoryWinsTable sortedGMs={sortedGMs} onSelectGM={onSelectGM} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedGMs.slice(0, 6).map((gm, i) => {
          const id = gm.managerGuid || gm.managerId;
          return (
            <Card key={id} className="p-5 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onSelectGM(id)}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[14px] font-bold"
                    style={{ backgroundColor: i === 0 ? 'var(--color-primary)' : i === 1 ? '#6b7280' : i === 2 ? 'var(--color-warning)' : '#d1d5db' }}>
                    {gm.managerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold text-gray-900 dark:text-white">{gm.managerName}</div>
                    <div className="text-[11px] text-gray-400">#{i + 1} overall</div>
                  </div>
                </div>
                {gm.championships > 0 && (
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                    {gm.championships}x GOAT
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StatBox value={gm.overallRanking.toFixed(config.dataDisplay.decimalPlaces)} label="Avg Rank" />
                <StatBox value={`${gm.totalWins}-${gm.totalLosses}`} label="Record" />
                <StatBox value={formatPct(gm.winPercentage, config.dataDisplay)} label="Win%" />
              </div>
              <div className="mt-4 flex gap-0.5 items-end h-8">
                {gm.rankingTrend.map(t => {
                  const max = Math.max(...gm.rankingTrend.map(r => r.rank), 10);
                  const h = Math.max(3, ((max - t.rank + 1) / max) * 28);
                  return (
                    <div key={t.season} className="flex-1 flex flex-col items-center justify-end" title={`${t.season}: #${t.rank}`}>
                      <div className="w-full rounded-sm opacity-40" style={{ height: `${h}px`, backgroundColor: 'var(--color-primary)' }} />
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// CATEGORY WINS TABLE
// ============================================================================

function CategoryWinsTable({ sortedGMs, onSelectGM }: { sortedGMs: GMAnalytics[]; onSelectGM: (id: string) => void }) {
  // Collect all category names across all GMs
  const categories = useMemo(() => {
    const catSet = new Set<string>();
    sortedGMs.forEach(gm => Object.keys(gm.categoryDominance).forEach(c => catSet.add(c)));
    return Array.from(catSet).sort();
  }, [sortedGMs]);

  // Sort GMs by total category wins across all categories
  const rankedGMs = useMemo(() => {
    return [...sortedGMs].sort((a, b) => {
      const aTotal = Object.values(a.categoryDominance).reduce((s, c) => s + c.wins, 0);
      const bTotal = Object.values(b.categoryDominance).reduce((s, c) => s + c.wins, 0);
      return bTotal - aTotal;
    });
  }, [sortedGMs]);

  if (categories.length === 0) return null;

  // Find best win rate per category for highlighting
  const bestPerCat: Record<string, number> = {};
  categories.forEach(cat => {
    bestPerCat[cat] = Math.max(...sortedGMs.map(gm => gm.categoryDominance[cat]?.winRate || 0));
  });

  return (
    <Card>
      <CardHeader title="Category Win Rates" subtitle="How often each GM wins in each stat category" />
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-t border-gray-100 dark:border-white/5">
              <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-left sticky left-0 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur z-10 min-w-[120px]">GM</th>
              {categories.map(cat => (
                <th key={cat} className="px-2 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center min-w-[60px]">
                  {cat}
                </th>
              ))}
              <th className="px-3 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center min-w-[60px]">Total W</th>
            </tr>
          </thead>
          <tbody>
            {rankedGMs.map(gm => {
              const id = gm.managerGuid || gm.managerId;
              const totalWins = Object.values(gm.categoryDominance).reduce((s, c) => s + c.wins, 0);
              return (
                <tr key={id} onClick={() => onSelectGM(id)} className="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur z-10 whitespace-nowrap">{gm.managerName}</td>
                  {categories.map(cat => {
                    const d = gm.categoryDominance[cat];
                    if (!d || d.total === 0) return <td key={cat} className="px-2 py-3 text-center text-gray-300 dark:text-gray-600">-</td>;
                    const pct = d.winRate * 100;
                    const isBest = d.winRate === bestPerCat[cat] && d.winRate > 0;
                    const color = pct >= 55 ? 'var(--color-success)' : pct >= 45 ? 'var(--color-warning)' : 'var(--color-danger)';
                    return (
                      <td key={cat} className="px-2 py-3 text-center tabular-nums" title={`${d.wins}W / ${d.total} matchups`}>
                        <span className={`text-[12px] font-semibold ${isBest ? 'underline decoration-2' : ''}`} style={{ color }}>
                          {pct.toFixed(0)}%
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center tabular-nums text-[13px] font-bold text-gray-900 dark:text-white">{totalWins}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-2.5 border-t border-gray-100 dark:border-white/5 text-[11px] text-gray-400">
        Win rate = % of matchups where GM had better stat. Best in each category is underlined. Hover for details.
      </div>
    </Card>
  );
}

// ============================================================================
// SEASONS
// ============================================================================

function SeasonsTab({ sortedGMs, allSeasons, onSelectGM }: { sortedGMs: GMAnalytics[]; allSeasons: string[]; onSelectGM: (id: string) => void }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Season-by-Season Breakdown" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-t border-gray-100 dark:border-white/5">
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-left sticky left-0 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur z-10">GM</th>
                {allSeasons.map(s => (
                  <th key={s} className="px-3 py-3 text-[11px] font-semibold text-gray-400 text-center" colSpan={2}>{seasonLabel(s)}</th>
                ))}
              </tr>
              <tr className="border-t border-gray-50 dark:border-white/5">
                <th className="sticky left-0 bg-white/80 dark:bg-[#1c1c1e]/80 z-10"></th>
                {allSeasons.map(s => (
                  <React.Fragment key={s}>
                    <th className="px-2 py-1 text-[10px] text-gray-300 text-center">Rank</th>
                    <th className="px-2 py-1 text-[10px] text-gray-300 text-center">W-L</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedGMs.map(gm => (
                <tr key={gm.managerGuid || gm.managerId} onClick={() => onSelectGM(gm.managerGuid || gm.managerId)} className="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur z-10 whitespace-nowrap">{gm.managerName}</td>
                  {allSeasons.map(s => {
                    const d = gm.seasons[s];
                    if (!d) return <React.Fragment key={s}><td className="px-2 py-3 text-center text-gray-200 dark:text-gray-700">-</td><td className="px-2 py-3 text-center text-gray-200 dark:text-gray-700">-</td></React.Fragment>;
                    const c = d.rank === 1 ? 'text-amber-600 dark:text-amber-400 font-bold' : d.rank <= 3 ? 'font-semibold' : d.rank >= sortedGMs.length ? '' : 'text-gray-600 dark:text-gray-300';
                    const rankStyle = d.rank <= 3 ? { color: 'var(--color-success)' } : d.rank >= sortedGMs.length ? { color: 'var(--color-danger)' } : {};
                    return (
                      <React.Fragment key={s}>
                        <td className={`px-2 py-3 text-center tabular-nums ${c}`} style={d.rank !== 1 ? rankStyle : undefined}>{d.championship ? `${d.rank}*` : d.rank}</td>
                        <td className="px-2 py-3 text-center tabular-nums text-gray-500 whitespace-nowrap">{d.wins}-{d.losses}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-2.5 border-t border-gray-100 dark:border-white/5 text-[11px] text-gray-400">* = GOAT Winner (Playoff Champion)</div>
      </Card>

      {/* Regular Season Winners + GOAT Winners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-4">Regular Season Winners</h3>
          <div className="space-y-2">
            {allSeasons.map(s => {
              const winner = sortedGMs.find(gm => gm.seasons[s]?.rank === 1);
              return (
                <div key={s} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-white/5 last:border-0">
                  <span className="text-[13px] text-gray-400">{seasonLabel(s)}</span>
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{winner?.managerName || 'N/A'}</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-[15px] font-semibold text-amber-600 dark:text-amber-400 mb-4">GOAT Winners (Playoff Champions)</h3>
          <div className="space-y-2">
            {allSeasons.map(s => {
              const champ = sortedGMs.find(gm => gm.seasons[s]?.championship);
              return (
                <div key={s} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-white/5 last:border-0">
                  <span className="text-[13px] text-gray-400">{seasonLabel(s)}</span>
                  <span className="text-[13px] font-bold text-amber-600 dark:text-amber-400">{champ?.managerName || 'N/A'}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// PLAYOFFS
// ============================================================================

function PlayoffsTab({ sortedGMs, allSeasons, onSelectGM }: { sortedGMs: GMAnalytics[]; allSeasons: string[]; onSelectGM: (id: string) => void }) {
  const config = useAdminConfig();
  const visibleCols = getVisibleColumns('playoffs-power-rankings', config);

  const playoffRankings = useMemo(() => [...sortedGMs].filter(gm => gm.playoffAppearances > 0).sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    if (b.finalsAppearances !== a.finalsAppearances) return b.finalsAppearances - a.finalsAppearances;
    if (b.playoffWinPercentage !== a.playoffWinPercentage) return b.playoffWinPercentage - a.playoffWinPercentage;
    return b.playoffWins - a.playoffWins;
  }), [sortedGMs]);

  const playoffBarData = useMemo(() => playoffRankings.map(gm => ({
    name: gm.managerName.length > 12 ? gm.managerName.slice(0, 11) + '.' : gm.managerName,
    fullName: gm.managerName, wins: gm.playoffWins, losses: gm.playoffLosses,
  })), [playoffRankings]);

  const playoffSeasons = useMemo(() => allSeasons.filter(s => sortedGMs.some(gm => gm.seasons[s]?.playoff)), [sortedGMs, allSeasons]);

  const trophyCase = useMemo(() => {
    const champs: { season: string; name: string; seed: number; record: string }[] = [];
    allSeasons.forEach(s => sortedGMs.forEach(gm => {
      const p = gm.seasons[s]?.playoff;
      if (p?.champion) champs.push({ season: s, name: gm.managerName, seed: p.seed, record: `${p.playoffWins}-${p.playoffLosses}` });
    }));
    return champs;
  }, [sortedGMs, allSeasons]);

  const hasData = playoffRankings.length > 0 && playoffRankings.some(gm => gm.playoffWins + gm.playoffLosses > 0);
  const usePie = config.dataDisplay.chartPreferences.playoffRecord === 'pie';

  // Column renderers for playoff table
  const colRenderers: Record<string, (gm: GMAnalytics, i: number) => React.ReactNode> = {
    rank: (_, i) => <td key="rank" className="px-4 py-3.5 font-bold text-gray-400">{i + 1}</td>,
    gm: (gm) => (
      <td key="gm" className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ backgroundColor: 'var(--color-primary)' }}>{gm.managerName.charAt(0).toUpperCase()}</div>
          <span className="font-semibold text-gray-900 dark:text-white">{gm.managerName}</span>
        </div>
      </td>
    ),
    titles: (gm) => (
      <td key="titles" className="px-4 py-3.5">{gm.championships > 0 ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{gm.championships}x</span> : <span className="text-gray-300">0</span>}</td>
    ),
    finals: (gm) => (
      <td key="finals" className="px-4 py-3.5 tabular-nums">{gm.finalsAppearances > 0 ? <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{gm.finalsAppearances}</span> : <span className="text-gray-300">0</span>}</td>
    ),
    playoffApps: (gm) => (
      <td key="playoffApps" className="px-4 py-3.5 tabular-nums text-gray-500 font-medium">{gm.playoffAppearances}/{Object.keys(gm.seasons).length}</td>
    ),
    playoffRecord: (gm) => (
      <td key="playoffRecord" className="px-4 py-3.5 tabular-nums">
        <span style={{ color: 'var(--color-success)' }} className="font-semibold">{gm.playoffWins}</span>
        <span className="text-gray-300 mx-0.5">-</span>
        <span style={{ color: 'var(--color-danger)' }} className="font-semibold">{gm.playoffLosses}</span>
      </td>
    ),
    winPct: (gm) => {
      const total = gm.playoffWins + gm.playoffLosses;
      return (
        <td key="winPct" className="px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-[4px] bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{
                width: `${total > 0 ? gm.playoffWinPercentage * 100 : 0}%`,
                backgroundColor: gm.playoffWinPercentage >= 0.6 ? 'var(--color-success)' : gm.playoffWinPercentage >= 0.4 ? 'var(--color-warning)' : 'var(--color-danger)',
              }} />
            </div>
            <span className="text-[11px] tabular-nums text-gray-400">{total > 0 ? formatPct(gm.playoffWinPercentage, config.dataDisplay) : '-'}</span>
          </div>
        </td>
      );
    },
    bestSeed: (gm) => (
      <td key="bestSeed" className="px-4 py-3.5 tabular-nums text-gray-500">{gm.bestPlayoffSeed > 0 ? `#${gm.bestPlayoffSeed}` : '-'}</td>
    ),
  };

  if (!hasData) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-1">No Playoff Data Yet</h3>
        <p className="text-[13px] text-gray-400">Playoff matchups haven&apos;t been played yet for the selected seasons.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {trophyCase.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 rounded-2xl border border-amber-200/60 dark:border-amber-800/30 p-6">
          <h3 className="text-[17px] font-semibold text-amber-800 dark:text-amber-300 mb-4">GOAT Winners</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {trophyCase.map(c => (
              <div key={c.season} className="bg-white/60 dark:bg-black/20 backdrop-blur rounded-xl p-4 text-center">
                <div className="text-[12px] text-gray-500 dark:text-gray-400">{seasonLabel(c.season)}</div>
                <div className="text-[15px] font-bold text-amber-700 dark:text-amber-300 mt-1">{c.name}</div>
                <div className="text-[11px] text-gray-400 mt-1">#{c.seed} seed &middot; {c.record}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader title="Playoff Power Rankings" subtitle="Ranked by GOAT titles, finals, then playoff win%" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-t border-gray-100 dark:border-white/5">
                {visibleCols.map(col => (
                  <th key={col.key} className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-left">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {playoffRankings.map((gm, i) => {
                const id = gm.managerGuid || gm.managerId;
                return (
                  <tr key={id} onClick={() => onSelectGM(id)} className="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                    {visibleCols.map(col => colRenderers[col.key]?.(gm, i))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {playoffBarData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-4">Playoff Wins & Losses</h3>
          {usePie ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {playoffBarData.filter(d => d.wins + d.losses > 0).map(d => (
                <div key={d.fullName} className="text-center">
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={[{ name: 'W', value: d.wins }, { name: 'L', value: d.losses }]} cx="50%" cy="50%" innerRadius={25} outerRadius={45} dataKey="value">
                        <Cell fill="var(--color-success)" />
                        <Cell fill="var(--color-danger)" />
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1c1c1e', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 mt-1">{d.fullName}</p>
                  <p className="text-[11px] text-gray-400">{d.wins}-{d.losses}</p>
                </div>
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, playoffBarData.length * 35)}>
              <BarChart data={playoffBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis type="number" stroke="#9ca3af" style={{ fontSize: '11px' }} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" style={{ fontSize: '11px' }} width={100} />
                <Tooltip contentStyle={{ backgroundColor: '#1c1c1e', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} labelFormatter={(l: string) => playoffBarData.find(d => d.name === l)?.fullName || l} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="wins" stackId="a" fill="var(--color-success)" name="Wins" />
                <Bar dataKey="losses" stackId="a" fill="var(--color-danger)" name="Losses" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      {playoffSeasons.length > 0 && (
        <Card>
          <CardHeader title="Playoff Journey by Season" subtitle="How deep each GM went" />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-t border-gray-100 dark:border-white/5">
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-left sticky left-0 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur z-10">GM</th>
                  {playoffSeasons.map(s => <th key={s} className="px-3 py-3 text-[11px] font-semibold text-gray-400 text-center">{seasonLabel(s)}</th>)}
                </tr>
              </thead>
              <tbody>
                {sortedGMs.filter(gm => playoffSeasons.some(s => gm.seasons[s]?.playoff)).map(gm => (
                  <tr key={gm.managerGuid || gm.managerId} onClick={() => onSelectGM(gm.managerGuid || gm.managerId)} className="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur z-10 whitespace-nowrap">{gm.managerName}</td>
                    {playoffSeasons.map(s => {
                      const p = gm.seasons[s]?.playoff;
                      if (!p) return <td key={s} className="px-3 py-3 text-center text-[12px] text-gray-300 dark:text-gray-600">{gm.seasons[s] ? 'Missed' : '-'}</td>;
                      const bg = p.champion ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-bold'
                        : p.finalsAppearance ? 'bg-purple-50 dark:bg-purple-900/10 font-semibold' : p.eliminatedRound === 'Semifinals' ? 'bg-blue-50 dark:bg-blue-900/10' : 'text-gray-500';
                      const textStyle = p.finalsAppearance && !p.champion ? { color: 'var(--color-accent)' } : p.eliminatedRound === 'Semifinals' && !p.finalsAppearance ? { color: 'var(--color-primary)' } : {};
                      return (
                        <td key={s} className={`px-3 py-3 text-center text-[12px] ${bg}`} style={textStyle}>
                          <div>{p.champion ? 'GOAT' : p.eliminatedRound}</div>
                          <div className="text-[10px] mt-0.5 opacity-60">#{p.seed} &middot; {p.playoffWins}-{p.playoffLosses}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// HEAD-TO-HEAD
// ============================================================================

function HeadToHeadTab({ sortedGMs, onSelectGM }: { sortedGMs: GMAnalytics[]; onSelectGM: (id: string) => void }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Head-to-Head Matrix" subtitle="Win-loss record (row GM's wins shown)" />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-t border-gray-100 dark:border-white/5">
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 text-left sticky left-0 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur z-10 min-w-[100px]">vs.</th>
                {sortedGMs.map(gm => (
                  <th key={gm.managerGuid || gm.managerId} className="px-2 py-2 text-center font-semibold text-gray-400 min-w-[60px]">
                    <span className="block truncate max-w-[55px]" title={gm.managerName}>{gm.managerName.length > 7 ? gm.managerName.slice(0, 6) + '.' : gm.managerName}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedGMs.map(gm => {
                const id = gm.managerGuid || gm.managerId;
                return (
                  <tr key={id} className="border-t border-gray-50 dark:border-white/5">
                    <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur z-10 cursor-pointer" style={{ color: undefined }} onClick={() => onSelectGM(id)}>
                      <span className="hover:opacity-70 transition-opacity" style={{ color: 'var(--color-primary)' }}>{gm.managerName}</span>
                    </td>
                    {sortedGMs.map(opp => {
                      const oid = opp.managerGuid || opp.managerId;
                      if (id === oid) return <td key={oid} className="px-2 py-2.5 text-center bg-gray-50 dark:bg-white/5 text-gray-300">-</td>;
                      const r = gm.headToHead[oid];
                      if (!r) return <td key={oid} className="px-2 py-2.5 text-center text-gray-200 dark:text-gray-700">-</td>;
                      const t = r.wins + r.losses + r.ties;
                      const wr = t > 0 ? r.wins / t : 0.5;
                      const style = wr > 0.55 ? { color: 'var(--color-success)', backgroundColor: 'color-mix(in srgb, var(--color-success) 10%, transparent)' }
                        : wr < 0.45 ? { color: 'var(--color-danger)', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)' }
                        : {};
                      return <td key={oid} className={`px-2 py-2.5 text-center tabular-nums ${wr !== 0.5 ? 'font-semibold' : 'text-gray-500'}`} style={style}>{r.wins}-{r.losses}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-4">Top Rivalries</h3>
        <div className="space-y-2">
          {(() => {
            const rivalries: Array<{ gm1: string; gm2: string; total: number; record: string }> = [];
            const seen = new Set<string>();
            sortedGMs.forEach(gm => {
              const id = gm.managerGuid || gm.managerId;
              Object.entries(gm.headToHead).forEach(([oid, r]) => {
                const key = [id, oid].sort().join('-');
                if (seen.has(key)) return;
                seen.add(key);
                rivalries.push({ gm1: gm.managerName, gm2: r.opponentName, total: r.wins + r.losses + r.ties, record: `${r.wins}-${r.losses}${r.ties > 0 ? `-${r.ties}` : ''}` });
              });
            });
            return rivalries.sort((a, b) => b.total - a.total).slice(0, 5).map((r, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-bold text-gray-300 w-4">{i + 1}</span>
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{r.gm1}</span>
                  <span className="text-[11px] text-gray-400">vs</span>
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{r.gm2}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono font-bold tabular-nums text-gray-700 dark:text-gray-300">{r.record}</span>
                  <span className="text-[11px] text-gray-400">({r.total}g)</span>
                </div>
              </div>
            ));
          })()}
        </div>
      </Card>
    </div>
  );
}


