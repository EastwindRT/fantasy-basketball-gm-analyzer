'use client';

import { useState, useEffect, useCallback } from 'react';

interface TeamSchedule {
  tricode: string;
  name: string;
  city: string;
  conference: 'East' | 'West';
  games: Record<string, { count: number; opponents: string[] }>;
  total: number;
}

interface ScheduleData {
  teams: TeamSchedule[];
  dates: string[]; // YYYY-MM-DD
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateLabel(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  const date = new Date(iso + 'T12:00:00');
  const day = DAY_LABELS[date.getDay()];
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  return { day, date: `${MONTH_SHORT[m - 1]} ${d}`, isWeekend };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Compute number of days from fromISO through the Nth upcoming Sunday (inclusive).
 * weeks=1 → to this coming Sunday
 * weeks=2 → to the Sunday after that
 * weeks=3 → one more Sunday
 */
function computeDays(fromISO: string, weeks: number): number {
  const from = new Date(fromISO + 'T12:00:00');
  const dayOfWeek = from.getDay(); // 0=Sun … 6=Sat
  // Days remaining in this week including today (Sunday = 7 so it's a full week)
  const daysThisWeek = dayOfWeek === 0 ? 7 : (7 - dayOfWeek + 1);
  return daysThisWeek + (weeks - 1) * 7;
}

/** Red → amber → green scale based on games vs max */
function totalColor(total: number, maxTotal: number): { bg: string; text: string } {
  if (total === 0) return { bg: '', text: 'text-gray-600' };
  const pct = total / maxTotal;
  if (pct >= 0.85) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400 font-bold' };
  if (pct >= 0.60) return { bg: 'bg-green-500/10',   text: 'text-green-400 font-semibold' };
  if (pct >= 0.35) return { bg: 'bg-amber-500/10',   text: 'text-amber-400' };
  return               { bg: 'bg-rose-500/10',    text: 'text-rose-400' };
}

export default function ScheduleGrid() {
  const [fromDate, setFromDate] = useState(todayISO());
  const [weeks, setWeeks] = useState(1);
  const [confFilter, setConfFilter] = useState<'All' | 'East' | 'West'>('All');
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const days = computeDays(fromDate, weeks);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/nba-schedule?from=${fromDate}&days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [fromDate, days]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const teams    = data?.teams ?? [];
  const dates    = data?.dates ?? [];
  const filtered = confFilter === 'All' ? teams : teams.filter(t => t.conference === confFilter);
  const maxTotal = filtered.length > 0 ? Math.max(...filtered.map(t => t.total)) : 1;

  // Compute end-date label for display
  const endDateISO = (() => {
    if (!fromDate) return '';
    const d = new Date(fromDate + 'T12:00:00');
    d.setDate(d.getDate() + days - 1);
    const [, m, day] = d.toISOString().slice(0, 10).split('-').map(Number);
    return `${MONTH_SHORT[m - 1]} ${day}`;
  })();

  return (
    <div className="w-full space-y-3">
      {/* Controls — stacked on mobile */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* From date */}
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="border border-white/10 rounded-xl px-3 py-2 text-sm bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {fromDate && (
            <span className="text-xs text-gray-600">
              {days}d · ends {endDateISO}
            </span>
          )}
          {loading && <span className="text-xs text-gray-500 animate-pulse">Loading…</span>}
        </div>

        <div className="flex items-center gap-2">
          {/* Week buttons */}
          <span className="text-xs font-medium text-gray-500">Through</span>
          {([1, 2] as const).map(w => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors active:scale-95 ${
                weeks === w ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {w === 1 ? 'This Week' : 'Next Week'}
            </button>
          ))}

          {/* Conference filter */}
          <span className="text-xs font-medium text-gray-500 ml-2">Conf</span>
          {(['All', 'East', 'West'] as const).map(c => (
            <button
              key={c}
              onClick={() => setConfFilter(c)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors active:scale-95 ${
                confFilter === c ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-gray-400">
        <span className="font-medium text-gray-500">Total games:</span>
        {[
          { label: 'Most',   cls: 'bg-emerald-500/20 text-emerald-400' },
          { label: 'Good',   cls: 'bg-green-500/15 text-green-400' },
          { label: 'Avg',    cls: 'bg-amber-500/15 text-amber-400' },
          { label: 'Fewest', cls: 'bg-rose-500/15 text-rose-400' },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>{label}</span>
          </span>
        ))}
        <span className="text-gray-600 ml-1">· Cells show opponent · Hover for details</span>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Grid */}
      {data && !loading && (
        <div className="relative overflow-x-auto rounded-xl border border-white/10 bg-gray-950 shadow-sm">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                {/* Team header */}
                <th className="sticky left-0 z-10 bg-gray-950 px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 border-r border-white/10 min-w-[120px]">
                  Team
                </th>
                {dates.map(iso => {
                  const { day, date, isWeekend } = formatDateLabel(iso);
                  return (
                    <th
                      key={iso}
                      className={`px-1 py-2 text-center font-medium min-w-[44px] ${
                        isWeekend ? 'text-gray-500' : 'text-gray-500'
                      }`}
                    >
                      <div className={`text-[9px] uppercase tracking-wider ${isWeekend ? 'text-orange-400/70' : 'text-gray-600'}`}>
                        {day}
                      </div>
                      <div className="text-[11px] text-gray-400">{date}</div>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-center font-semibold text-gray-400 min-w-[52px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((team, idx) => {
                const { bg: totalBg, text: totalText } = totalColor(team.total, maxTotal);
                return (
                  <tr
                    key={team.tricode}
                    className={`border-b border-white/5 ${idx % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                  >
                    {/* Team name cell */}
                    <td className="sticky left-0 z-10 bg-gray-950 border-r border-white/10 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${
                            team.conference === 'East'
                              ? 'bg-blue-900/60 text-blue-300'
                              : 'bg-orange-900/60 text-orange-300'
                          }`}
                        >
                          {team.conference[0]}
                        </span>
                        <div>
                          <div className="font-bold text-white text-[12px]">{team.tricode}</div>
                          <div className="text-[9px] text-gray-600 leading-none">{team.city}</div>
                        </div>
                      </div>
                    </td>

                    {/* Game cells — binary: show opponent or rest */}
                    {dates.map(iso => {
                      const { count, opponents } = team.games[iso] ?? { count: 0, opponents: [] };
                      const hasGame = count > 0;
                      const opp = opponents[0] ?? '';
                      const tooltipText = hasGame
                        ? `${team.tricode} vs ${opponents.join(', ')}  •  ${iso}`
                        : `${team.tricode} — Rest`;
                      return (
                        <td
                          key={iso}
                          className={`text-center cursor-default select-none transition-colors ${
                            hasGame
                              ? 'bg-white/[0.06] hover:bg-white/10'
                              : 'hover:bg-white/[0.02]'
                          }`}
                          onMouseEnter={e => {
                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                            setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, text: tooltipText });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          <span className={`block py-2 text-[11px] font-semibold tabular-nums ${
                            hasGame ? 'text-gray-200' : 'text-gray-700'
                          }`}>
                            {hasGame ? opp : '—'}
                          </span>
                        </td>
                      );
                    })}

                    {/* Total — colored by schedule strength */}
                    <td className={`text-center py-2 px-3 font-bold text-[13px] tabular-nums ${totalBg} ${totalText}`}>
                      {team.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="fixed z-50 pointer-events-none bg-gray-800 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl -translate-x-1/2 -translate-y-full whitespace-nowrap border border-white/10"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              {tooltip.text}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {data && !loading && filtered.length > 0 && (
        <div className="flex flex-wrap gap-5 text-sm text-gray-500">
          <span>
            <span className="font-semibold text-white">{filtered.length}</span> teams
          </span>
          <span>
            <span className="font-bold text-emerald-400">{filtered[0]?.tricode}</span>
            {' '}leads with{' '}
            <span className="font-bold text-emerald-400">{filtered[0]?.total}</span> games
          </span>
          <span>
            Avg:{' '}
            <span className="font-semibold text-white">
              {(filtered.reduce((s, t) => s + t.total, 0) / filtered.length).toFixed(1)}
            </span>
          </span>
          <span className="text-gray-600">
            {dates[0]} → {dates[dates.length - 1]}
          </span>
        </div>
      )}
    </div>
  );
}
