'use client';

import { useState, useEffect, useRef } from 'react';
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
  playoffProb: number;
  lastPlaceProb: number;
  avgRank: number;
  rankDist: number[];
}

type RemainingMatchup = [string, string];

interface WeekMatchupPair {
  team1Key: string;
  team2Key: string;
  team1Name: string;
  team2Name: string;
}

interface WeekMatchupData {
  week: number;
  weekStart?: string;
  weekEnd?: string;
  pairs: WeekMatchupPair[];
}

interface ScenarioMatchup {
  team1Key: string;
  team2Key: string;
  team1Name: string;
  team2Name: string;
  team1BaseProb: number;
  team2BaseProb: number;
  team1WinsProbs: { [teamKey: string]: number };
  team2WinsProbs: { [teamKey: string]: number };
  stakes: number; // combined impact: sum of |delta| for both teams
}

interface WeekScenario {
  week: number;
  weekStart?: string;
  weekEnd?: string;
  matchups: ScenarioMatchup[];
}

// ─── Simulation core ──────────────────────────────────────────────────────────

/**
 * Compute per-team strength using a hybrid of:
 * - Bayesian-smoothed win rate (60%)
 * - Normalised Points-For-Per-Game (40%)
 *
 * Using PPG as a secondary signal corrects for early-season luck variance
 * and gives a better predictor of future H2H outcomes.
 */
function buildStrengths(standings: TeamData[]): Map<string, number> {
  const strengths = new Map<string, number>();

  // League average PPG (only from teams that have played)
  let totalPPG = 0;
  let teamCount = 0;
  standings.forEach(t => {
    const g = t.standings.wins + t.standings.losses + t.standings.ties;
    if (g > 0) { totalPPG += t.standings.points_for / g; teamCount++; }
  });
  const leagueAvgPPG = teamCount > 0 ? totalPPG / teamCount : 1;

  standings.forEach(t => {
    const g = t.standings.wins + t.standings.losses + t.standings.ties;
    // Bayesian win rate with prior of 0.5 (5 prior games)
    const bayesWinRate = (t.standings.wins + 2.5) / (g + 5);
    // Normalised PPG: 1.0 = league average; scale to ~0.1–0.9
    const ppg = g > 0 ? t.standings.points_for / g : leagueAvgPPG;
    const ppgNorm = Math.min(Math.max((ppg / leagueAvgPPG) * 0.5, 0.1), 0.9);
    strengths.set(t.team_key, 0.6 * bayesWinRate + 0.4 * ppgNorm);
  });

  return strengths;
}

function runMonteCarlo(
  standings: TeamData[],
  remaining: RemainingMatchup[],
  numPlayoffTeams: number,
  N = 10000,
): SimResult[] {
  const numTeams = standings.length;
  const strengths = buildStrengths(standings);

  const playoffCounts = new Map<string, number>();
  const lastCounts    = new Map<string, number>();
  const rankSums      = new Map<string, number>();
  const rankCountArr  = new Map<string, number[]>();
  standings.forEach(t => {
    playoffCounts.set(t.team_key, 0);
    lastCounts.set(t.team_key, 0);
    rankSums.set(t.team_key, 0);
    rankCountArr.set(t.team_key, new Array(numTeams).fill(0));
  });

  for (let sim = 0; sim < N; sim++) {
    const simWins = new Map<string, number>();
    const simPF   = new Map<string, number>();
    standings.forEach(t => {
      simWins.set(t.team_key, t.standings.wins);
      // Add tiny noise to points_for so ties in wins are broken differently each sim
      simPF.set(t.team_key, t.standings.points_for + Math.random() * 0.01);
    });

    for (const [k1, k2] of remaining) {
      const s1 = strengths.get(k1) ?? 0.5;
      const s2 = strengths.get(k2) ?? 0.5;
      const p1 = s1 / (s1 + s2);
      if (Math.random() < p1) {
        simWins.set(k1, simWins.get(k1)! + 1);
      } else {
        simWins.set(k2, simWins.get(k2)! + 1);
      }
    }

    const sorted = [...standings].sort((a, b) => {
      const wDiff = simWins.get(b.team_key)! - simWins.get(a.team_key)!;
      if (wDiff !== 0) return wDiff;
      return simPF.get(b.team_key)! - simPF.get(a.team_key)!;
    });

    sorted.forEach((t, idx) => {
      const rank = idx + 1;
      rankSums.set(t.team_key, rankSums.get(t.team_key)! + rank);
      rankCountArr.get(t.team_key)![idx]++;
      if (rank <= numPlayoffTeams) playoffCounts.set(t.team_key, playoffCounts.get(t.team_key)! + 1);
      if (rank === numTeams)        lastCounts.set(t.team_key, lastCounts.get(t.team_key)! + 1);
    });
  }

  return standings.map(t => ({
    team_key:     t.team_key,
    team_name:    t.name,
    wins:         t.standings.wins,
    losses:       t.standings.losses,
    ties:         t.standings.ties,
    points_for:   t.standings.points_for,
    currentRank:  t.standings.rank,
    playoffProb:  playoffCounts.get(t.team_key)! / N,
    lastPlaceProb: lastCounts.get(t.team_key)! / N,
    avgRank:      rankSums.get(t.team_key)! / N,
    rankDist:     rankCountArr.get(t.team_key)!.map(c => c / N),
  }));
}

/**
 * Run a scenario simulation where one specific matchup has a forced winner.
 * Used to compute "what if Team A wins this week?" probabilities.
 */
function runScenarioProbs(
  standings: TeamData[],
  allRemaining: RemainingMatchup[],
  numPlayoffTeams: number,
  forceWinner: string,
  forceLoser: string,
  N = 3000,
): { [teamKey: string]: number } {
  // Apply forced result to standings record
  const adjusted = standings.map(t => ({
    ...t,
    standings: {
      ...t.standings,
      wins:   t.standings.wins   + (t.team_key === forceWinner ? 1 : 0),
      losses: t.standings.losses + (t.team_key === forceLoser  ? 1 : 0),
    },
  }));

  // Remove the first occurrence of this specific matchup
  let removed = false;
  const filtered = allRemaining.filter(([k1, k2]) => {
    if (!removed && (
      (k1 === forceWinner && k2 === forceLoser) ||
      (k1 === forceLoser  && k2 === forceWinner)
    )) { removed = true; return false; }
    return true;
  });

  const results = runMonteCarlo(adjusted, filtered, numPlayoffTeams, N);
  const probs: { [teamKey: string]: number } = {};
  results.forEach(r => { probs[r.team_key] = r.playoffProb; });
  return probs;
}

/** Compute all week-by-week scenarios. Synchronous but fast (<300ms for typical leagues). */
function computeAllScenarios(
  standings: TeamData[],
  allRemaining: RemainingMatchup[],
  weekMatchups: WeekMatchupData[],
  numPlayoffTeams: number,
  baseResults: SimResult[],
): WeekScenario[] {
  const baseProbs: { [k: string]: number } = {};
  baseResults.forEach(r => { baseProbs[r.team_key] = r.playoffProb; });

  return weekMatchups.map(wmd => ({
    week: wmd.week,
    weekStart: wmd.weekStart,
    weekEnd: wmd.weekEnd,
    matchups: wmd.pairs.map(pair => {
      const { team1Key, team2Key, team1Name, team2Name } = pair;
      const t1Base = baseProbs[team1Key] ?? 0;
      const t2Base = baseProbs[team2Key] ?? 0;

      const t1WinsProbs = runScenarioProbs(standings, allRemaining, numPlayoffTeams, team1Key, team2Key);
      const t2WinsProbs = runScenarioProbs(standings, allRemaining, numPlayoffTeams, team2Key, team1Key);

      // Stakes = combined swing for both teams when team1 wins (proxy for game importance)
      const stakes =
        Math.abs((t1WinsProbs[team1Key] ?? t1Base) - t1Base) +
        Math.abs((t1WinsProbs[team2Key] ?? t2Base) - t2Base);

      return { team1Key, team2Key, team1Name, team2Name, team1BaseProb: t1Base, team2BaseProb: t2Base, team1WinsProbs: t1WinsProbs, team2WinsProbs: t2WinsProbs, stakes };
    }),
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number) { return `${Math.round(v * 100)}%`; }
function deltaPct(v: number) {
  const n = Math.round(v * 100);
  return `${n >= 0 ? '+' : ''}${n}%`;
}
function formatWeekDate(iso?: string) {
  if (!iso) return '';
  const parts = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}`;
}

function getStatus(playoffProb: number, lastPlaceProb: number): { label: string; cls: string } {
  if (playoffProb > 0.75) return { label: 'Safe',   cls: 'bg-green-900/50 text-green-400' };
  if (playoffProb > 0.50) return { label: 'In',     cls: 'bg-emerald-900/40 text-emerald-400' };
  if (playoffProb > 0.25) return { label: 'Bubble', cls: 'bg-yellow-900/50 text-yellow-400' };
  if (playoffProb >= 0.10 || lastPlaceProb <= 0.20) return { label: 'Out', cls: 'bg-orange-900/50 text-orange-400' };
  return { label: 'Danger', cls: 'bg-red-900/50 text-red-500' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniHistogram({ rankDist, numTeams, numPlayoffTeams }: {
  rankDist: number[]; numTeams: number; numPlayoffTeams: number;
}) {
  const maxProb = Math.max(...rankDist, 0.001);
  return (
    <div className="flex items-end gap-px" style={{ height: 20 }}>
      {rankDist.map((prob, i) => {
        const h = Math.max(Math.round((prob / maxProb) * 20), 1);
        const bg = i === numTeams - 1 ? '#ef4444' : i < numPlayoffTeams ? '#22c55e' : '#4b5563';
        return (
          <div key={i} style={{ width: 5, height: h, backgroundColor: bg, borderRadius: 1, opacity: 0.8 }}
            title={`Rank ${i + 1}: ${(prob * 100).toFixed(1)}%`} />
        );
      })}
    </div>
  );
}

function OutcomeChip({ base, scenario, teamName }: { base: number; scenario: number | undefined; teamName: string }) {
  if (scenario === undefined) return null;
  const delta = scenario - base;
  const deltaColor = delta > 0.02 ? 'text-green-400' : delta < -0.02 ? 'text-red-400' : 'text-gray-500';
  const shortName = teamName.length > 12 ? teamName.slice(0, 11) + '…' : teamName;
  return (
    <span className="flex items-center gap-1">
      <span className="text-gray-400 text-[10px]">{shortName}</span>
      <span className="text-white font-semibold text-[11px]">{pct(scenario)}</span>
      <span className={`text-[10px] font-medium ${deltaColor}`}>{deltaPct(delta)}</span>
    </span>
  );
}

function StakesBadge({ stakes }: { stakes: number }) {
  if (stakes > 0.25) return <span className="text-orange-400 text-[11px]" title={`Impact: ${pct(stakes)}`}>★★★</span>;
  if (stakes > 0.12) return <span className="text-yellow-500 text-[11px]" title={`Impact: ${pct(stakes)}`}>★★</span>;
  return <span className="text-gray-700 text-[11px]" title={`Impact: ${pct(stakes)}`}>★</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlayoffPredictor() {
  const liveLeagueKey   = useAppStore(s => s.liveLeagueKey);
  const liveCurrentWeek = useAppStore(s => s.liveCurrentWeek);

  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [simResults, setSimResults]       = useState<SimResult[] | null>(null);
  const [weekScenarios, setWeekScenarios] = useState<WeekScenario[] | null>(null);
  const [computingScenarios, setComputingScenarios] = useState(false);
  const [numPlayoffTeams, setNumPlayoffTeams] = useState(6);
  const [playoffStartWeek, setPlayoffStartWeek] = useState(0);
  const [endWeek, setEndWeek]             = useState(22);
  const [weeksRemaining, setWeeksRemaining] = useState(0);
  const [remainingMatchupCount, setRemainingMatchupCount] = useState(0);

  // Cache standings + remaining for scenario re-use without re-fetching
  const standingsRef    = useRef<TeamData[]>([]);
  const allRemainingRef = useRef<RemainingMatchup[]>([]);
  const weekMatchupRef  = useRef<WeekMatchupData[]>([]);

  // ── Main fetch + simulation ─────────────────────────────────────────────────
  useEffect(() => {
    if (!liveLeagueKey || liveCurrentWeek == null) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSimResults(null);
    setWeekScenarios(null);

    async function fetchAndSimulate() {
      try {
        const [standingsData, settings] = await Promise.all([
          fetchStandings(liveLeagueKey!),
          fetchLeagueSettings(liveLeagueKey!),
        ]);
        if (cancelled) return;

        const numTeams = standingsData.length;
        const nPlayoff = settings.num_playoff_teams || (numTeams <= 8 ? 4 : 6);
        const ew       = settings.end_week || 22;
        const psw      = settings.playoff_start_week > 0 ? settings.playoff_start_week : ew - 2;

        setNumPlayoffTeams(nPlayoff);
        setPlayoffStartWeek(psw);
        setEndWeek(ew);

        // Future regular season weeks only
        const weekNums: number[] = [];
        for (let w = liveCurrentWeek! + 1; w <= psw - 1; w++) weekNums.push(w);
        setWeeksRemaining(weekNums.length);

        const futureMatchupArrays = weekNums.length > 0
          ? await Promise.all(weekNums.map(w => fetchScoreboard(liveLeagueKey!, w)))
          : [];
        if (cancelled) return;

        // Build flat remaining list + per-week structured data
        const allRemaining: RemainingMatchup[] = [];
        const weekMatchupData: WeekMatchupData[] = [];

        futureMatchupArrays.forEach((weekMus, idx) => {
          const week = weekNums[idx];
          const pairs: WeekMatchupPair[] = [];

          weekMus.forEach(mu => {
            const t0 = mu.teams[0];
            const t1 = mu.teams[1];
            // Validate both team_keys exist before using
            if (t0?.team_key && t1?.team_key) {
              allRemaining.push([t0.team_key, t1.team_key]);
              pairs.push({
                team1Key:  t0.team_key,
                team2Key:  t1.team_key,
                team1Name: t0.team_name,
                team2Name: t1.team_name,
              });
            }
          });

          if (pairs.length > 0) {
            weekMatchupData.push({
              week,
              weekStart: weekMus[0]?.week_start,
              weekEnd:   weekMus[0]?.week_end,
              pairs,
            });
          }
        });

        if (allRemaining.length === 0 && weekNums.length > 0) {
          console.warn('[PlayoffPredictor] Future week fetches returned no matchup data. ' +
            'Yahoo may not have published the schedule yet. Probabilities reflect current standings only.');
        }

        setRemainingMatchupCount(allRemaining.length);

        // Store for scenario computation
        standingsRef.current    = standingsData;
        allRemainingRef.current = allRemaining;
        weekMatchupRef.current  = weekMatchupData;

        const results = runMonteCarlo(standingsData, allRemaining, nPlayoff);
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

  // ── Scenario computation (after main sim) ───────────────────────────────────
  useEffect(() => {
    if (!simResults || weekMatchupRef.current.length === 0) return;

    setComputingScenarios(true);

    // Yield to renderer so the chart/table appear first, then compute scenarios
    const timer = setTimeout(() => {
      const scenarios = computeAllScenarios(
        standingsRef.current,
        allRemainingRef.current,
        weekMatchupRef.current,
        numPlayoffTeams,
        simResults,
      );
      setWeekScenarios(scenarios);
      setComputingScenarios(false);
    }, 80);

    return () => clearTimeout(timer);
  }, [simResults, numPlayoffTeams]);

  // ── Guard states ────────────────────────────────────────────────────────────
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

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-5 w-40 bg-white/10 rounded-lg" />
        <div className="h-3 w-60 bg-white/5 rounded-lg" />
        <div className="h-80 bg-white/5 rounded-2xl" />
        <div className="h-64 bg-white/5 rounded-2xl" />
        <div className="h-48 bg-white/5 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-900/20 border border-red-800/30 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!simResults) return null;

  const numTeams  = simResults.length;
  const inPlayoffs = liveCurrentWeek! >= playoffStartWeek && playoffStartWeek > 0;

  const chartData = [...simResults]
    .sort((a, b) => b.playoffProb - a.playoffProb)
    .map(r => ({
      name:        r.team_name.length > 16 ? r.team_name.slice(0, 15) + '…' : r.team_name,
      playoffProb: Math.round(r.playoffProb * 100),
      fill:        r.playoffProb > 0.6 ? '#22c55e' : r.playoffProb > 0.3 ? '#f59e0b' : '#ef4444',
    }));

  const tableData = [...simResults].sort((a, b) => a.currentRank - b.currentRank);
  const leader    = tableData[0];
  const gamesBack = (t: SimResult) => {
    const gb = ((leader.wins - t.wins) + (t.losses - leader.losses)) / 2;
    return gb === 0 ? '—' : gb.toFixed(1);
  };

  const chartHeight = Math.max(numTeams * 42, 160);
  const scheduleNote = remainingMatchupCount === 0 && weeksRemaining > 0
    ? '⚠ Schedule not yet published — probabilities reflect current standings only'
    : null;

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
          {' '}· 10,000 simulations
        </p>
      </div>

      {inPlayoffs && (
        <div className="rounded-2xl bg-purple-900/20 border border-purple-800/30 p-3 text-xs text-purple-300 text-center">
          Regular season complete — showing final qualifying probabilities
        </div>
      )}

      {scheduleNote && (
        <div className="rounded-2xl bg-yellow-900/20 border border-yellow-800/30 p-3 text-xs text-yellow-400">
          {scheduleNote}
        </div>
      )}

      {/* ── Bar chart ──────────────────────────────────────────────────────── */}
      <div className="bg-white/[0.04] rounded-2xl p-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Playoff Probability
        </p>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart layout="vertical" data={chartData} margin={{ top: 0, right: 52, left: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="name" width={118}
              tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12, color: '#f3f4f6' }}
              formatter={(v: number) => [`${v}%`, 'Playoff chance']}
            />
            <ReferenceLine x={50} stroke="#4b5563" strokeDasharray="4 2"
              label={{ value: '50%', fill: '#6b7280', fontSize: 10, position: 'insideTopRight' }} />
            <Bar dataKey="playoffProb" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
              {chartData.map((entry, idx) => <Cell key={idx} fill={entry.fill} fillOpacity={0.85} />)}
              <LabelList dataKey="playoffProb" position="right" formatter={(v: number) => `${v}%`}
                style={{ fill: '#d1d5db', fontSize: 11, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-600 pl-[118px]">
          {([['#22c55e', '>60%'], ['#f59e0b', '30–60%'], ['#ef4444', '<30%']] as const).map(([c, l]) => (
            <span key={l} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: c }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* ── Standings table ─────────────────────────────────────────────────── */}
      <div className="bg-white/[0.04] rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Full Standings Breakdown</p>
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
                  <tr key={row.team_key}
                    className={`border-b hover:bg-white/[0.03] transition-colors ${
                      isLastPlayoffSlot ? 'border-b-2 border-dashed border-orange-700/50' : 'border-white/[0.04]'
                    }`}>
                    <td className="px-3 py-2.5 text-gray-500">{row.currentRank}</td>
                    <td className="px-2 py-2.5 text-white font-medium max-w-[110px]">
                      <span className="block truncate">{row.team_name}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center text-gray-300 tabular-nums">
                      {row.wins}‑{row.losses}{row.ties > 0 ? `‑${row.ties}` : ''}
                    </td>
                    <td className="px-2 py-2.5 text-center text-gray-400 tabular-nums">{gamesBack(row)}</td>
                    <td className={`px-2 py-2.5 text-center font-semibold tabular-nums ${
                      row.playoffProb > 0.6 ? 'text-green-400' : row.playoffProb > 0.3 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{pct(row.playoffProb)}</td>
                    <td className="px-2 py-2.5">
                      <MiniHistogram rankDist={row.rankDist} numTeams={numTeams} numPlayoffTeams={numPlayoffTeams} />
                    </td>
                    <td className="px-2 py-2.5 text-center text-red-400/70 tabular-nums">{pct(row.lastPlaceProb)}</td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 flex items-center gap-3 text-[10px] text-gray-600 border-t border-white/[0.04]">
          <span className="inline-block w-4 border-t-2 border-dashed border-orange-700/50" />
          Playoff cutoff
          <span>·</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#22c55e', opacity: 0.8 }} />Playoff
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#ef4444', opacity: 0.8 }} />Last place
          </span>
        </div>
      </div>

      {/* ── Week-by-week scenario table ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Week-by-Week Scenarios
          </p>
          {computingScenarios && (
            <span className="text-[10px] text-gray-600 animate-pulse">Computing…</span>
          )}
        </div>

        {!weekScenarios && !computingScenarios && weeksRemaining === 0 && (
          <div className="bg-white/[0.04] rounded-2xl p-4 text-xs text-gray-500 text-center">
            No remaining regular season games — playoffs begin next week.
          </div>
        )}

        {computingScenarios && !weekScenarios && (
          <div className="space-y-3 animate-pulse">
            <div className="h-32 bg-white/5 rounded-2xl" />
            <div className="h-32 bg-white/5 rounded-2xl" />
          </div>
        )}

        {weekScenarios && weekScenarios.length === 0 && (
          <div className="bg-white/[0.04] rounded-2xl p-4 text-xs text-gray-500 text-center">
            Schedule data unavailable — Yahoo hasn't published future matchups yet.
          </div>
        )}

        {weekScenarios && weekScenarios.map(ws => (
          <div key={ws.week} className="bg-white/[0.04] rounded-2xl overflow-hidden mb-3">
            {/* Week header */}
            <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-bold text-white">Week {ws.week}</span>
              {ws.weekStart && (
                <span className="text-[10px] text-gray-500">
                  {formatWeekDate(ws.weekStart)} – {formatWeekDate(ws.weekEnd)}
                </span>
              )}
            </div>

            {/* Matchups */}
            {ws.matchups.map((mu, i) => (
              <div key={i} className={`px-4 py-3 ${i < ws.matchups.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                {/* Matchup header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px]">
                    <span className="text-white font-semibold">{mu.team1Name}</span>
                    <span className="text-gray-600 mx-1.5">vs</span>
                    <span className="text-white font-semibold">{mu.team2Name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600">stakes</span>
                    <StakesBadge stakes={mu.stakes} />
                  </div>
                </div>

                {/* Scenario rows */}
                <div className="space-y-1.5">
                  {/* If team 1 wins */}
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-gray-600 w-[52px] shrink-0 pt-0.5">
                      {mu.team1Name.split(' ')[0]} wins
                    </span>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      <OutcomeChip base={mu.team1BaseProb} scenario={mu.team1WinsProbs[mu.team1Key]} teamName={mu.team1Name} />
                      <OutcomeChip base={mu.team2BaseProb} scenario={mu.team1WinsProbs[mu.team2Key]} teamName={mu.team2Name} />
                    </div>
                  </div>
                  {/* If team 2 wins */}
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-gray-600 w-[52px] shrink-0 pt-0.5">
                      {mu.team2Name.split(' ')[0]} wins
                    </span>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      <OutcomeChip base={mu.team2BaseProb} scenario={mu.team2WinsProbs[mu.team2Key]} teamName={mu.team2Name} />
                      <OutcomeChip base={mu.team1BaseProb} scenario={mu.team2WinsProbs[mu.team1Key]} teamName={mu.team1Name} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 text-center pb-2">
        Model: win rate (Bayesian prior) + points-for/game, blended 60/40. Scenario sims: 3,000 each. Results are estimates.
      </p>
    </div>
  );
}
