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
  return { day, date: `${MONTH_SHORT[m - 1]} ${d}` };
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function cellColor(count: number): string {
  if (count === 0) return 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600';
  if (count === 1) return 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200';
  if (count === 2) return 'bg-green-400 dark:bg-green-700 text-green-900 dark:text-white';
  return 'bg-green-600 dark:bg-green-500 text-white dark:text-gray-900';
}

function totalColor(total: number, maxTotal: number): string {
  if (total === 0) return 'text-gray-400 dark:text-gray-600';
  const pct = total / maxTotal;
  if (pct >= 0.85) return 'text-green-600 dark:text-green-400 font-bold';
  if (pct >= 0.6) return 'text-green-500 dark:text-green-500 font-semibold';
  if (pct >= 0.35) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-500 dark:text-red-400';
}

export default function ScheduleGrid() {
  const [fromDate, setFromDate] = useState(todayISO());
  const [days, setDays] = useState(7);
  const [confFilter, setConfFilter] = useState<'All' | 'East' | 'West'>('All');
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/nba-schedule?from=${fromDate}&days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [fromDate, days]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const teams = data?.teams ?? [];
  const dates = data?.dates ?? [];
  const filtered = confFilter === 'All' ? teams : teams.filter(t => t.conference === confFilter);
  const maxTotal = filtered.length > 0 ? Math.max(...filtered.map(t => t.total)) : 1;

  return (
    <div className="w-full space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* From date */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Days selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Period</span>
          {[7, 14, 21].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Conference filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Conf</span>
          {(['All', 'East', 'West'] as const).map(c => (
            <button
              key={c}
              onClick={() => setConfFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                confFilter === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {loading && (
          <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Loading...</span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="font-medium">Games:</span>
        {[
          { label: '0', cls: 'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600' },
          { label: '1', cls: 'bg-green-200 dark:bg-green-900' },
          { label: '2', cls: 'bg-green-400 dark:bg-green-700' },
          { label: '3+', cls: 'bg-green-600 dark:bg-green-500' },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`inline-block w-5 h-5 rounded ${cls}`} />
            {label}
          </span>
        ))}
        <span className="text-gray-400 dark:text-gray-500 ml-2">Hover a cell for opponent info</span>
      </div>

      {error && (
        <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Grid */}
      {data && !loading && (
        <div className="relative overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {/* Team header */}
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 min-w-[120px]">
                  Team
                </th>
                {dates.map(iso => {
                  const { day, date } = formatDateLabel(iso);
                  return (
                    <th key={iso} className="px-1 py-2 text-center font-medium text-gray-600 dark:text-gray-400 min-w-[44px]">
                      <div className="text-[10px] text-gray-400 dark:text-gray-500">{day}</div>
                      <div>{date}</div>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 min-w-[48px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((team, idx) => (
                <tr
                  key={team.tricode}
                  className={`border-b border-gray-100 dark:border-gray-800 ${
                    idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/30'
                  }`}
                >
                  {/* Team name cell */}
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                          team.conference === 'East'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                            : 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                        }`}
                      >
                        {team.conference[0]}
                      </span>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white text-[11px]">{team.tricode}</div>
                        <div className="text-[9px] text-gray-500 dark:text-gray-400 leading-none">{team.city}</div>
                      </div>
                    </div>
                  </td>

                  {/* Game cells */}
                  {dates.map(iso => {
                    const { count, opponents } = team.games[iso] ?? { count: 0, opponents: [] };
                    const tooltipText = count === 0
                      ? `${team.tricode} — OFF`
                      : `${team.tricode} vs ${opponents.join(', ')} (${iso})`;
                    return (
                      <td
                        key={iso}
                        className={`text-center cursor-default select-none transition-opacity hover:opacity-80 ${cellColor(count)}`}
                        onMouseEnter={e => {
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, text: tooltipText });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <span className="block py-1.5 font-medium">
                          {count === 0 ? '—' : count}
                        </span>
                      </td>
                    );
                  })}

                  {/* Total */}
                  <td className={`text-center py-1.5 px-3 ${totalColor(team.total, maxTotal)}`}>
                    {team.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="fixed z-50 pointer-events-none bg-gray-900 dark:bg-gray-700 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg -translate-x-1/2 -translate-y-full whitespace-nowrap"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              {tooltip.text}
            </div>
          )}
        </div>
      )}

      {/* Summary stats */}
      {data && !loading && filtered.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span>
            <span className="font-semibold text-gray-900 dark:text-white">{filtered.length}</span> teams shown
          </span>
          <span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              {filtered[0]?.tricode}
            </span>{' '}
            leads with{' '}
            <span className="font-semibold text-green-600 dark:text-green-400">{filtered[0]?.total}</span> games
          </span>
          <span>
            Avg games:{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {(filtered.reduce((s, t) => s + t.total, 0) / filtered.length).toFixed(1)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
