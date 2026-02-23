'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Cell, ReferenceLine, LabelList, ResponsiveContainer, Tooltip,
} from 'recharts';
import { fetchStandings, fetchLeagueSettings, fetchScoreboard } from '@/lib/yahoo-api';
import type { TeamData } from '@/lib/yahoo-api';
import { useAppStore } from '@/lib/store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimResult {
  team_key: string;
  team_name: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  currentRank: number;
  playoffProb: number;    // 0–1
  lastPlaceProb: number;  // 0–1
  avgRank: number;
  rankDist: number[];     // rankDist[i] = prob of finishing at rank i+1
}

type RemainingMatchup = [string, string]; // [team1Key, team2Key]

// ─── Simulation ───────────────────────────────────────────────────────────────

function runMonteCarlo(
  standings: TeamData[],
  remaining: RemainingMatchup[],
  numPlayoffTeams: number,
  N = 10000,
): SimResult[] {
  const numTeams = standings.length;

  // Laplace-smoothed win rates to avoid 0% / 100% extremes
  const winRates = new Map<string, number>();
  standings.forEach(t => {
    const total = t.standings.wins + t.standings.losses + t.standings.ties;
    winRates.set(t.team_key, (t.standings.wins + 2) / (total + 4));
  });

  // Accumulators
  const playoffCounts = new Map<string, number>();
  const lastCounts = new Map<string, number>();
  const rankSums = new Map<string, number>();
  const rankCountArrays = new Map<string, number[]>();
  standings.forEach(t => {
    playoffCounts.set(t.team_key, 0);
    lastCounts.set(t.team_key, 0);
    rankSums.set(t.team_key, 0);
    rankCountArrays.set(t.team_key, new Array(numTeams).fill(0));
  });

  for (let sim = 0; sim < N; sim++) {
    // Start each sim with actual W record + tiny points_for noise for tiebreaking
    const simWins = new Map<string, number>();
    const simPF = new Map<string, number>();
    standings.forEach(t => {
      simWins.set(t.team_key, t.standings.wins);
      simPF.set(t.team_key, t.standings.points_for + Math.random() * 0.001);
    });

    // Simulate remaining regular season games
    for (const [k1, k2] of remaining) {
      const r1 = winRates.get(k1) ?? 0.5;
      const r2 = winRates.get(k2) ?? 0.5;
      const p1 = r1 / (r1 + r2);
      if (Math.random() < p1) {
        simWins.set(k1, simWins.get(k1)! + 1);
      } else {
        simWins.set(k2, simWins.get(k2)! + 1);
      }
    }

    // Sort final standings: wins desc, then points_for desc
    const sorted = [...standings].sort((a, b) => {
      const wDiff = simWins.get(b.team_key)! - simWins.get(a.team_key)!;
      if (wDiff !== 0) return wDiff;
      return simPF.get(b.team_key)! - simPF.get(a.team_key)!;
    });

    sorted.forEach((t, idx) => {
      const rank = idx + 1;
      rankSums.set(t.team_key, rankSums.get(t.team_key)! + rank);
      rankCountArrays.get(t.team_key)![idx]++;
      if (rank <= numPlayoffTeams) playoffCounts.set(t.team_key, playoffCounts.get(t.team_key)! + 1);
      if (rank === numTeams) lastCounts.set(t.team_key, lastCounts.get(t.team_key)! + 1);
    });
  }

  return standings.map(t => ({
    team_key: t.team_key,
    team_name: t.name,
    wins: t.standings.wins,
    losses: t.standings.losses,
    ties: t.standings.ties,
    points_for: t.standings.points_for,
    currentRank: t.standings.rank,
    playoffProb: playoffCounts.get(t.team_key)! / N,
    lastPlaceProb: lastCounts.get(t.team_key)! / N,
    avgRank: rankSums.get(t.team_key)! / N,
    rankDist: rankCountArrays.get(t.team_key)!.map(c => c / N),
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function getStatus(playoffProb: number, lastPlaceProb: number): { label: string; cls: string } {
  if (playoffProb > 0.75) return { label: 'Safe',   cls: 'bg-green-900/50 text-green-400' };
  if (playoffProb > 0.50) return { label: 'In',     cls: 'bg-emerald-900/40 text-emerald-400' };
  if (playoffProb > 0.25) return { label: 'Bubble', cls: 'bg-yellow-900/50 text-yellow-400' };
  if (playoffProb >= 0.10 || lastPlaceProb <= 0.20) return { label: 'Out', cls: 'bg-orange-900/50 text-orange-400' };
  return { label: 'Danger', cls: 'bg-red-900/50 text-red-500' };
}

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function MiniHistogram({
  rankDist,
  numTeams,
  numPlayoffTeams,
}: {
  rankDist: number[];
  numTeams: number;
  numPlayoffTeams: number;
}) {
  const maxProb = Math.max(...rankDist, 0.001);
  return (
    <div className="flex items-end gap-px" style={{ height: 20 }}>
      {rankDist.map((prob, i) => {
        const h = Math.max(Math.round((prob / maxProb) * 20), 1);
        const isPlayoff = i < numPlayoffTeams;
        const isLast = i === numTeams - 1;
        const bg = isLast ? '#ef4444' : isPlayoff ? '#22c55e' : '#4b5563';
        return (
          <div
            key={i}
            style={{ width: 5, height: h, backgroundColor: bg, borderRadius: 1, opacity: 0.8 }}
            title={`Rank ${i + 1}: ${(prob * 100).toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlayoffPredictor() {
  const liveLeagueKey = useAppStore(s => s.liveLeagueKey);
  const liveCurrentWeek = useAppStore(s => s.liveCurrentWeek);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simResults, setSimResults] = useState<SimResult[] | null>(null);
  const [numPlayoffTeams, setNumPlayoffTeams] = useState(6);
  const [playoffStartWeek, setPlayoffStartWeek] = useState(0);
  const [endWeek, setEndWeek] = useState(22);
  const [weeksRemaining, setWeeksRemaining] = useState(0);

  useEffect(() => {
    if (!liveLeagueKey || liveCurrentWeek == null) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSimResults(null);

    async function fetchAndSimulate() {
      try {
        const [standingsData, settings] = await Promise.all([
          fetchStandings(liveLeagueKey!),
          fetchLeagueSettings(liveLeagueKey!),
        ]);
        if (cancelled) return;

        const numTeams = standingsData.length;
        const nPlayoff = settings.num_playoff_teams || (numTeams <= 8 ? 4 : 6);
        const ew = settings.end_week || 22;
        const psw = settings.playoff_start_week > 0 ? settings.playoff_start_week : ew - 2;

        setNumPlayoffTeams(nPlayoff);
        setPlayoffStartWeek(psw);
        setEndWeek(ew);

        // Collect future regular season week numbers
        const weekNums: number[] = [];
        for (let w = liveCurrentWeek! + 1; w <= psw - 1; w++) weekNums.push(w);
        setWeeksRemaining(weekNums.length);

        // Fetch all future weeks in parallel
        const futureMatchupArrays = weekNums.length > 0
          ? await Promise.all(weekNums.map(w => fetchScoreboard(liveLeagueKey!, w)))
          : [];
        if (cancelled) return;

        // Flatten to [team1Key, team2Key] pairs
        const remaining: RemainingMatchup[] = [];
        futureMatchupArrays.flat().forEach(mu => {
          if (mu.teams.length === 2) {
            remaining.push([mu.teams[0].team_key, mu.teams[1].team_key]);
          }
        });

        const results = runMonteCarlo(standingsData, remaining, nPlayoff);
        if (!cancelled) setSimResults(results);
      } catch (err: unknown) {
        if (!cancelled) setError((err as Error)?.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAndSimulate();
    return () => { cancelled = true; };
  }, [liveLeagueKey, liveCurrentWeek]);

  // ── No league selected ──────────────────────────────────────────────────────
  if (!liveLeagueKey) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="text-5xl mb-4">📊</div>
        <p className="text-white font-semibold text-base mb-1">No league selected</p>
        <p className="text-gray-500 text-sm">
          Go to the <span className="text-orange-400 font-medium">My Season</span> tab and select a league first.
        </p>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-5 w-40 bg-white/10 rounded-lg" />
        <div className="h-3 w-60 bg-white/5 rounded-lg" />
        <div className="h-80 bg-white/5 rounded-2xl" />
        <div className="h-64 bg-white/5 rounded-2xl" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-2xl bg-red-900/20 border border-red-800/30 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!simResults) return null;

  const numTeams = simResults.length;
  const inPlayoffs = liveCurrentWeek! >= playoffStartWeek && playoffStartWeek > 0;

  // Chart data sorted by playoff probability (highest → lowest)
  const chartData = [...simResults]
    .sort((a, b) => b.playoffProb - a.playoffProb)
    .map(r => ({
      name: r.team_name.length > 16 ? r.team_name.slice(0, 15) + '…' : r.team_name,
      playoffProb: Math.round(r.playoffProb * 100),
      fill: r.playoffProb > 0.6 ? '#22c55e' : r.playoffProb > 0.3 ? '#f59e0b' : '#ef4444',
    }));

  // Table sorted by current standings rank
  const tableData = [...simResults].sort((a, b) => a.currentRank - b.currentRank);

  const leader = tableData[0];
  const gamesBack = (t: SimResult) => {
    const gb = ((leader.wins - t.wins) + (t.losses - leader.losses)) / 2;
    return gb === 0 ? '—' : gb.toFixed(1);
  };

  const chartHeight = Math.max(numTeams * 42, 160);

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-white">Season Outlook</h2>
        <p className="text-gray-500 text-xs mt-0.5">
          {inPlayoffs
            ? `Playoffs in progress · Top ${numPlayoffTeams} qualified`
            : `Week ${liveCurrentWeek} of ${endWeek - 1} · ${weeksRemaining} week${weeksRemaining !== 1 ? 's' : ''} remaining · Top ${numPlayoffTeams} make playoffs`
          }
          {' '}· based on 10,000 simulations
        </p>
      </div>

      {inPlayoffs && (
        <div className="rounded-2xl bg-purple-900/20 border border-purple-800/30 p-3 text-xs text-purple-300 text-center">
          Regular season complete — these are the final qualifying probabilities
        </div>
      )}

      {/* ── Bar chart ──────────────────────────────────────────────────────── */}
      <div className="bg-white/[0.04] rounded-2xl p-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Playoff Probability
        </p>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 0, right: 52, left: 0, bottom: 0 }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={118}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background: '#1f2937',
                border: '1px solid #374151',
                borderRadius: 8,
                fontSize: 12,
                color: '#f3f4f6',
              }}
              formatter={(v: number) => [`${v}%`, 'Playoff chance']}
            />
            <ReferenceLine
              x={50}
              stroke="#4b5563"
              strokeDasharray="4 2"
              label={{ value: '50%', fill: '#6b7280', fontSize: 10, position: 'insideTopRight' }}
            />
            <Bar dataKey="playoffProb" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} fillOpacity={0.85} />
              ))}
              <LabelList
                dataKey="playoffProb"
                position="right"
                formatter={(v: number) => `${v}%`}
                style={{ fill: '#d1d5db', fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Playoff cutoff annotation */}
        <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-600 pl-[118px]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#22c55e' }} />
            {'>'}60%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#f59e0b' }} />
            30–60%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#ef4444' }} />
            {'<'}30%
          </span>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white/[0.04] rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Full Standings Breakdown
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-3 py-2 text-gray-500 font-medium w-7">#</th>
                <th className="text-left px-2 py-2 text-gray-500 font-medium">Team</th>
                <th className="text-center px-2 py-2 text-gray-500 font-medium">W‑L</th>
                <th className="text-center px-2 py-2 text-gray-500 font-medium">GB</th>
                <th className="text-center px-2 py-2 text-gray-500 font-medium">PO%</th>
                <th className="text-center px-2 py-2 text-gray-500 font-medium">Dist</th>
                <th className="text-center px-2 py-2 text-gray-500 font-medium">Last%</th>
                <th className="text-center px-2 py-2 text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => {
                const { label, cls } = getStatus(row.playoffProb, row.lastPlaceProb);
                const isLastPlayoffSlot = idx === numPlayoffTeams - 1;
                return (
                  <tr
                    key={row.team_key}
                    className={`border-b hover:bg-white/[0.03] transition-colors ${
                      isLastPlayoffSlot
                        ? 'border-b-2 border-dashed border-orange-700/50'
                        : 'border-white/[0.04]'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-gray-500">{row.currentRank}</td>
                    <td className="px-2 py-2.5 text-white font-medium max-w-[110px]">
                      <span className="block truncate">{row.team_name}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center text-gray-300 tabular-nums">
                      {row.wins}‑{row.losses}{row.ties > 0 ? `‑${row.ties}` : ''}
                    </td>
                    <td className="px-2 py-2.5 text-center text-gray-400 tabular-nums">
                      {gamesBack(row)}
                    </td>
                    <td className={`px-2 py-2.5 text-center font-semibold tabular-nums ${
                      row.playoffProb > 0.6 ? 'text-green-400' :
                      row.playoffProb > 0.3 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {pct(row.playoffProb)}
                    </td>
                    <td className="px-2 py-2.5">
                      <MiniHistogram
                        rankDist={row.rankDist}
                        numTeams={numTeams}
                        numPlayoffTeams={numPlayoffTeams}
                      />
                    </td>
                    <td className="px-2 py-2.5 text-center text-red-400/70 tabular-nums">
                      {pct(row.lastPlaceProb)}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
                        {label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 flex items-center gap-2 text-[10px] text-gray-600 border-t border-white/[0.04]">
          <span className="inline-block w-4 border-t-2 border-dashed border-orange-700/50" />
          Playoff cutoff line
          <span className="ml-3">·</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#22c55e', opacity: 0.8 }} />
            Playoff ranks
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#ef4444', opacity: 0.8 }} />
            Last place
          </span>
        </div>
      </div>

      <p className="text-[10px] text-gray-600 text-center pb-2">
        Simulations use Laplace-smoothed win rates. Results are probabilistic estimates only.
      </p>
    </div>
  );
}
