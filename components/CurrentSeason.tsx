'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchUserLeagues,
  fetchStandings,
  fetchCurrentMatchup,
  fetchCurrentUserGuid,
  fetchStatCategories,
  fetchLeague,
  fetchTeamRoster,
  fetchPlayerAverages,
  fetchTeamWeekStats,
  getAuthState,
  isTokenExpired,
  initiateAuth,
} from '@/lib/yahoo-api';
import type { TeamData, MatchupData, RosterPlayer, StatCategory } from '@/lib/yahoo-api';
import { useAppStore } from '@/lib/store';

// Percentage stat dependencies: stat_id -> { made_id, att_id }
// Used to project FG%, FT%, 3PT% from underlying makes/attempts averages
const PCT_DEPS: { [id: string]: { made: string; att: string } } = {
  '5':  { made: '4',  att: '3'  },  // FG%  = FGM / FGA
  '8':  { made: '7',  att: '6'  },  // FT%  = FTM / FTA
  '11': { made: '10', att: '9'  },  // 3PT% = 3PTM / 3PTA
};

interface NbaScheduleData {
  teams: Array<{ tricode: string; games: Record<string, { count: number }> }>;
  dates: string[];
}

function fmtStat(val: number | null | undefined, statId: string): string {
  if (val == null) return '—';
  if (PCT_DEPS[statId]) {
    const s = val.toFixed(3);
    return s.startsWith('0.') ? s.slice(1) : s; // .456 not 0.456
  }
  if (val % 1 === 0) return String(Math.round(val));
  return val.toFixed(1);
}

/** Get the coming Sunday ISO date (or today if today is Sunday) */
function comingSundayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // 0=Sun
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  d.setDate(d.getDate() + daysToSunday);
  return d.toISOString().slice(0, 10);
}

function remainingDatesThisWeek(weekEnd: string): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(weekEnd + 'T12:00:00');
  const dates: string[] = [];
  for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Normalize Yahoo team abbreviations to NBA CDN tricodes */
const YAHOO_TO_NBA: Record<string, string> = {
  GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', PHO: 'PHX', UTAH: 'UTA',
};
function normalizeAbbr(abbr: string): string {
  const u = abbr.toUpperCase();
  return YAHOO_TO_NBA[u] ?? u;
}

type CatResult = 'win' | 'tied' | 'loss' | 'neutral';

function catResult(cat: StatCategory, my: number | null | undefined, opp: number | null | undefined): CatResult {
  if (my == null || opp == null) return 'neutral';
  const lowerBetter = cat.sort_order === '0';
  if (my === opp) return 'tied';
  return (lowerBetter ? my < opp : my > opp) ? 'win' : 'loss';
}

function recordFrom(cats: StatCategory[], myStats: Record<string, number>, oppStats: Record<string, number>) {
  return cats.reduce(
    (acc, cat) => {
      const r = catResult(cat, myStats[cat.stat_id] ?? null, oppStats[cat.stat_id] ?? null);
      if (r === 'win') acc.won++;
      else if (r === 'tied') acc.tied++;
      else if (r === 'loss') acc.lost++;
      return acc;
    },
    { won: 0, tied: 0, lost: 0 },
  );
}

export default function CurrentSeason() {
  const setLiveLeagueData = useAppStore(s => s.setLiveLeagueData);
  const [isAuth, setIsAuth] = useState(false);
  const [leagues, setLeagues] = useState<Array<{ league_key: string; name: string; season: string }>>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingProj, setLoadingProj] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // League data
  const [leagueName, setLeagueName] = useState('');
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [weekEnd, setWeekEnd] = useState<string | null>(null);
  const [standings, setStandings] = useState<TeamData[]>([]);
  const [matchups, setMatchups] = useState<MatchupData[]>([]);
  const [allCats, setAllCats] = useState<StatCategory[]>([]);
  const [userGuid, setUserGuid] = useState<string | null>(null);

  // Projections
  const [myRoster, setMyRoster] = useState<RosterPlayer[]>([]);
  const [oppRoster, setOppRoster] = useState<RosterPlayer[]>([]);
  const [myAvgs, setMyAvgs] = useState<Map<string, Record<string, number>>>(new Map());
  const [oppAvgs, setOppAvgs] = useState<Map<string, Record<string, number>>>(new Map());
  const [scheduleData, setScheduleData] = useState<NbaScheduleData | null>(null);
  // Week stats — fills in FGM/FGA/FTM/FTA that the scoreboard may omit
  const [myWeekStats,  setMyWeekStats]  = useState<Record<string, number>>({});
  const [oppWeekStats, setOppWeekStats] = useState<Record<string, number>>({});

  // ── Auth check ──
  useEffect(() => {
    const auth = getAuthState();
    setIsAuth(!!auth.accessToken && !isTokenExpired());
  }, []);

  // ── Load leagues on auth ──
  useEffect(() => {
    if (!isAuth) return;
    setLoadingLeagues(true);
    Promise.all([fetchUserLeagues('nba'), fetchCurrentUserGuid()])
      .then(([ls, guid]) => {
        const current = ls.filter(l => l.season === '2025' || l.season === '2026');
        const shown = current.length > 0 ? current : ls.slice(0, 5);
        setLeagues(shown);
        if (shown.length > 0) setSelectedKey(shown[0].league_key);
        setUserGuid(guid);
      })
      .catch(err => setError(`Failed to load leagues: ${err.message}`))
      .finally(() => setLoadingLeagues(false));
  }, [isAuth]);

  // ── Load league data ──
  const loadLeagueData = useCallback(async (leagueKey: string) => {
    if (!leagueKey) return;
    setLoadingData(true);
    setError(null);
    setMyRoster([]);
    setOppRoster([]);
    setMyAvgs(new Map());
    setOppAvgs(new Map());
    setScheduleData(null);
    setMyWeekStats({});
    setOppWeekStats({});
    try {
      const [leagueInfo, teamStandings, weekMatchups, cats] = await Promise.all([
        fetchLeague(leagueKey),
        fetchStandings(leagueKey),
        fetchCurrentMatchup(leagueKey),
        fetchStatCategories(leagueKey),
      ]);
      setLeagueName(leagueInfo.name);
      setCurrentWeek(leagueInfo.current_week ?? null);
      if (leagueInfo.current_week != null) setLiveLeagueData(leagueKey, leagueInfo.current_week);
      setStandings(teamStandings.sort((a, b) => a.standings.rank - b.standings.rank));
      setMatchups(weekMatchups);
      setAllCats(cats);
      if (weekMatchups[0]) {
        setWeekStart(weekMatchups[0].week_start ?? null);
        setWeekEnd(weekMatchups[0].week_end ?? null);
      }
    } catch (err: unknown) {
      setError(`Failed to load data: ${(err as Error).message}`);
    } finally {
      setLoadingData(false);
    }
  }, [setLiveLeagueData]);

  useEffect(() => {
    if (selectedKey) loadLeagueData(selectedKey);
  }, [selectedKey, loadLeagueData]);

  // ── Derived: identify user's team + matchup ──
  const userTeam = userGuid ? standings.find(t => t.manager.guid === userGuid) : null;
  const userMatchup = userTeam
    ? matchups.find(m => m.teams.some(t => t.team_key === userTeam.team_key))
    : null;
  const myTeam = userMatchup?.teams.find(t => t.team_key === userTeam?.team_key);
  const oppTeam = userMatchup?.teams.find(t => t.team_key !== userTeam?.team_key);

  // ── Load projections once we have both team keys ──
  // weekEnd may be null if Yahoo didn't return it — fall back to coming Sunday
  useEffect(() => {
    if (!myTeam || !oppTeam) return;
    let cancelled = false;
    const effectiveWeekEnd = weekEnd ?? comingSundayISO();

    async function loadProjections() {
      setLoadingProj(true);
      try {
        // Rosters
        const [mRoster, oRoster] = await Promise.all([
          fetchTeamRoster(myTeam!.team_key),
          fetchTeamRoster(oppTeam!.team_key),
        ]);
        if (cancelled) return;
        setMyRoster(mRoster);
        setOppRoster(oRoster);

        // Fetch current week stats for both teams (gives us FGM/FGA/FTM/FTA)
        const [mWeekStats, oWeekStats] = await Promise.all([
          fetchTeamWeekStats(myTeam!.team_key),
          fetchTeamWeekStats(oppTeam!.team_key),
        ]);
        if (cancelled) return;
        setMyWeekStats(mWeekStats);
        setOppWeekStats(oWeekStats);

        // Player averages (batch both rosters)
        const allKeys = [
          ...mRoster.map(p => p.player_key),
          ...oRoster.map(p => p.player_key),
        ];
        const avgsMap = await fetchPlayerAverages(allKeys);
        if (cancelled) return;

        const myMap = new Map<string, Record<string, number>>();
        const oppMap = new Map<string, Record<string, number>>();
        mRoster.forEach(p => { const a = avgsMap.get(p.player_key); if (a) myMap.set(p.player_key, a); });
        oRoster.forEach(p => { const a = avgsMap.get(p.player_key); if (a) oppMap.set(p.player_key, a); });
        setMyAvgs(myMap);
        setOppAvgs(oppMap);

        // Fetch full week schedule (weekStart → weekEnd) so we can split into
        // games already played vs games remaining for each team
        const fullFrom = weekStart ?? effectiveWeekEnd;
        const fullDays = Math.max(1, Math.floor(
          (new Date(effectiveWeekEnd + 'T12:00:00').getTime() - new Date(fullFrom + 'T12:00:00').getTime()) / 86400000
        ) + 1);
        const res = await fetch(`/api/nba-schedule?from=${fullFrom}&days=${fullDays}`);
        if (!cancelled && res.ok) {
          const sched: NbaScheduleData = await res.json();
          setScheduleData(sched);
        }
      } catch (err) {
        console.warn('Projection load failed:', err);
      } finally {
        if (!cancelled) setLoadingProj(false);
      }
    }

    loadProjections();
    return () => { cancelled = true; };
  }, [myTeam?.team_key, oppTeam?.team_key, weekEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scoring categories only (no FGM, FGA, FTM, FTA etc.) ──
  // Fallback: if Yahoo didn't return is_only_display_stat, exclude known display-only stat IDs
  const KNOWN_DISPLAY_ONLY = new Set(['0','1','2','3','4','6','7','9','20','21','22','23','24','25','26']);
  const scoringCats = allCats.filter(c =>
    !c.is_only_display_stat && !KNOWN_DISPLAY_ONLY.has(c.stat_id)
  );

  // Date constants used by schedule split and rate-based fallback
  const TODAY_ISO     = new Date().toISOString().slice(0, 10);
  const projWeekEnd   = weekEnd   ?? comingSundayISO();
  const projWeekStart = weekStart ?? TODAY_ISO;

  // ── Split schedule into played vs remaining per NBA team ──
  const remainingByTeam: Record<string, number> = {};
  const playedByTeam:   Record<string, number> = {};
  if (scheduleData) {
    for (const t of scheduleData.teams) {
      let played = 0, remaining = 0;
      for (const [date, g] of Object.entries(t.games)) {
        if (date < TODAY_ISO) played += g.count;
        else remaining += g.count;
      }
      remainingByTeam[t.tricode] = remaining;
      playedByTeam[t.tricode]   = played;
    }
  }
  const daysPlayed    = Math.max(1, Math.floor(
    (new Date(TODAY_ISO + 'T12:00:00').getTime() - new Date(projWeekStart + 'T12:00:00').getTime()) / 86400000
  ) + 1);
  const daysRemaining = Math.max(0, Math.floor(
    (new Date(projWeekEnd + 'T12:00:00').getTime() - new Date(TODAY_ISO + 'T12:00:00').getTime()) / 86400000
  ));

  // ── Roster-based projection (accurate when averages + schedule loaded) ──
  const computeProjected = (
    roster: RosterPlayer[],
    avgsMap: Map<string, Record<string, number>>,
    currentStats: Record<string, number> | undefined,
  ): Record<string, number> => {
    const projRem: Record<string, number> = {};
    for (const player of roster) {
      if (player.status === 'O' || player.status === 'IR') continue;
      const rem = remainingByTeam[normalizeAbbr(player.team_abbr)] ?? 0;
      if (rem === 0) continue;
      const avgs = avgsMap.get(player.player_key);
      if (!avgs) continue;
      for (const [sid, avg] of Object.entries(avgs)) {
        projRem[sid] = (projRem[sid] ?? 0) + avg * rem;
      }
    }
    const proj: Record<string, number> = {};
    for (const cat of allCats) {
      const cur = currentStats?.[cat.stat_id] ?? 0;
      const dep = PCT_DEPS[cat.stat_id];
      if (dep) {
        const currMade = currentStats?.[dep.made] ?? 0;
        const currAtt  = currentStats?.[dep.att]  ?? 0;
        const projMade = currMade + (projRem[dep.made] ?? 0);
        const projAtt  = currAtt  + (projRem[dep.att]  ?? 0);
        proj[cat.stat_id] = projAtt > 0 ? projMade / projAtt : cur;
      } else {
        proj[cat.stat_id] = cur + (projRem[cat.stat_id] ?? 0);
      }
    }
    return proj;
  };

  // ── Rate-based projection (fallback: pace current stats forward by games, not days) ──
  const computeRateProjection = (
    roster: RosterPlayer[],
    currentStats: Record<string, number> | undefined,
  ): Record<string, number> => {
    const proj: Record<string, number> = {};

    // Use actual game counts from schedule if available, else fall back to calendar days
    const active = roster.filter(p => p.status !== 'O' && p.status !== 'IR');
    let avgPlayed    = daysPlayed;
    let avgRemaining = daysRemaining;
    if (active.length > 0 && scheduleData) {
      const totalPlayed    = active.reduce((s, p) => s + (playedByTeam[normalizeAbbr(p.team_abbr)]   ?? 0), 0);
      const totalRemaining = active.reduce((s, p) => s + (remainingByTeam[normalizeAbbr(p.team_abbr)] ?? 0), 0);
      avgPlayed    = Math.max(1, totalPlayed    / active.length);
      avgRemaining = totalRemaining / active.length;
    }

    // Step 1: project all counting stats forward (including FGM, FGA, FTM, FTA, 3PTM, 3PTA)
    for (const cat of allCats) {
      if (PCT_DEPS[cat.stat_id]) continue; // handle % stats in step 2
      const cur = currentStats?.[cat.stat_id] ?? 0;
      proj[cat.stat_id] = cur + (cur / avgPlayed) * avgRemaining;
    }

    // Step 2: derive % stats from projected makes ÷ projected attempts
    // e.g. FG% = projFGM / projFGA  (not just scaling the current %)
    for (const cat of allCats) {
      const dep = PCT_DEPS[cat.stat_id];
      if (!dep) continue;
      const projMade = proj[dep.made] ?? (currentStats?.[dep.made] ?? 0);
      const projAtt  = proj[dep.att]  ?? (currentStats?.[dep.att]  ?? 0);
      proj[cat.stat_id] = projAtt > 0 ? projMade / projAtt : (currentStats?.[cat.stat_id] ?? 0);
    }

    return proj;
  };

  // Merge week stats (FGM/FGA/FTM/FTA) into matchup stats — scoreboard may omit display-only stats
  // Week stats fill gaps; scoreboard values take precedence where both exist
  const myFullStats  = myTeam  ? { ...myWeekStats,  ...myTeam.stats  } : undefined;
  const oppFullStats = oppTeam ? { ...oppWeekStats, ...oppTeam.stats } : undefined;

  const hasRosterProj = scheduleData !== null && (myAvgs.size > 0 || oppAvgs.size > 0);
  const myProjected  = myFullStats  ? (hasRosterProj ? computeProjected(myRoster,  myAvgs,  myFullStats)  : computeRateProjection(myRoster,  myFullStats))  : null;
  const oppProjected = oppFullStats ? (hasRosterProj ? computeProjected(oppRoster, oppAvgs, oppFullStats) : computeRateProjection(oppRoster, oppFullStats)) : null;
  const projLabel    = hasRosterProj ? 'roster-based' : loadingProj ? 'computing…' : 'rate estimate';

  // ── Category records ──
  const curRecord = (myTeam?.stats && oppTeam?.stats)
    ? recordFrom(scoringCats, myTeam.stats, oppTeam.stats)
    : { won: 0, tied: 0, lost: 0 };

  const projRecord = (myProjected && oppProjected)
    ? recordFrom(scoringCats, myProjected, oppProjected)
    : null;

  const injuredMy  = myRoster.filter(p => p.status === 'O' || p.status === 'IR');
  const injuredOpp = oppRoster.filter(p => p.status === 'O' || p.status === 'IR');

  // ── Not authenticated ──
  if (!isAuth) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center text-3xl">🏀</div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Sign in to view your league</h2>
          <p className="text-gray-400 text-sm max-w-xs">
            Connect your Yahoo account to see your current matchup and standings.
          </p>
        </div>
        <button
          onClick={() => initiateAuth()}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl transition-colors"
        >
          Login with Yahoo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">

      {/* ── League Selector ── */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-400">League</label>
        {loadingLeagues ? (
          <span className="text-sm text-gray-500 animate-pulse">Loading leagues…</span>
        ) : leagues.length === 0 ? (
          <span className="text-sm text-gray-500">No current-season leagues found.</span>
        ) : (
          <select
            value={selectedKey}
            onChange={e => setSelectedKey(e.target.value)}
            className="border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {leagues.map(l => (
              <option key={l.league_key} value={l.league_key} className="bg-gray-900">
                {l.name} ({l.season})
              </option>
            ))}
          </select>
        )}
        {(loadingData || loadingProj) && (
          <span className="text-sm text-gray-500 animate-pulse">
            {loadingData ? 'Fetching data…' : 'Loading projections…'}
          </span>
        )}
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {!loadingData && standings.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

          {/* ══════════════════════════════════════════════
              Current Matchup  (3 of 5 cols on xl)
          ══════════════════════════════════════════════ */}
          <div className="xl:col-span-3 bg-gray-900/60 border border-white/10 rounded-2xl overflow-hidden">

            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-white/10">
              <div className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold mb-3">
                Week {currentWeek ?? '—'}
                {weekStart && weekEnd && (
                  <span className="ml-2 normal-case tracking-normal font-normal text-gray-700">
                    {weekStart} → {weekEnd}
                  </span>
                )}
              </div>

              {userMatchup ? (
                <div>
                  {/* Team names row */}
                  <div className="grid grid-cols-[1fr_32px_1fr] items-center gap-2 mb-5">
                    <div className="text-right">
                      <div className="font-bold text-white text-sm leading-tight">{myTeam?.team_name ?? '—'}</div>
                      <div className="text-[10px] text-orange-400/70 mt-0.5 font-medium">You</div>
                    </div>
                    <div className="flex items-center justify-center">
                      <span className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-gray-700 text-[9px] font-bold">VS</span>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-white text-sm leading-tight">{oppTeam?.team_name ?? '—'}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5 font-medium">Opponent</div>
                    </div>
                  </div>

                  {/* Big score display — MetaMask balance style */}
                  <div className="flex items-end justify-center gap-8 pb-1">
                    <div className="text-center">
                      <div className="text-5xl font-bold text-emerald-400 leading-none tabular-nums">{curRecord.won}</div>
                      <div className="text-[9px] uppercase tracking-widest text-gray-600 mt-1.5">Cats Won</div>
                    </div>
                    <div className="text-center pb-1">
                      <div className="text-2xl font-bold text-gray-600 leading-none tabular-nums">{curRecord.tied}</div>
                      <div className="text-[9px] uppercase tracking-widest text-gray-700 mt-1.5">Tied</div>
                    </div>
                    <div className="text-center">
                      <div className="text-5xl font-bold text-rose-400 leading-none tabular-nums">{curRecord.lost}</div>
                      <div className="text-[9px] uppercase tracking-widest text-gray-600 mt-1.5">Cats Lost</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  {userTeam ? 'No matchup found for this week.' : 'Could not identify your team.'}
                </p>
              )}

            </div>

            {/* Category rows */}
            {userMatchup && scoringCats.length > 0 && (
              <>
                {/* Column labels */}
                <div className="grid grid-cols-[1fr_80px_1fr] px-5 py-2 text-[9px] uppercase tracking-widest text-gray-700 font-semibold border-b border-white/5">
                  <div className="text-right pr-4">Yours</div>
                  <div className="text-center">Category</div>
                  <div className="text-left pl-4">Theirs</div>
                </div>

                <div>
                  {scoringCats.map(cat => {
                    const myVal  = myTeam?.stats?.[cat.stat_id]  ?? null;
                    const oppVal = oppTeam?.stats?.[cat.stat_id] ?? null;
                    const myProj  = myProjected?.[cat.stat_id]  ?? null;
                    const oppProj = oppProjected?.[cat.stat_id] ?? null;
                    if (myVal === null && oppVal === null) return null;

                    const result     = catResult(cat, myVal, oppVal);
                    const projResult = (myProj != null && oppProj != null)
                      ? catResult(cat, myProj, oppProj)
                      : null;

                    const myColor  = result === 'win'  ? 'text-emerald-400' : result === 'tied' ? 'text-gray-400' : 'text-rose-400';
                    const oppColor = result === 'loss' ? 'text-emerald-400' : result === 'tied' ? 'text-gray-400' : 'text-rose-400';

                    return (
                      <div
                        key={cat.stat_id}
                        className={`grid grid-cols-[1fr_76px_1fr] items-center px-4 py-3.5 border-b border-white/5 transition-colors hover:bg-white/3 ${
                          result === 'win' ? 'bg-emerald-500/5' : result === 'loss' ? 'bg-rose-500/5' : ''
                        }`}
                      >
                        {/* My value */}
                        <div className="text-right pr-3">
                          <div className={`text-xl font-bold tabular-nums ${myColor}`}>
                            {fmtStat(myVal, cat.stat_id)}
                          </div>
                        </div>

                        {/* Category name */}
                        <div className="text-center">
                          <span className="text-[11px] font-semibold text-gray-500">{cat.display_name}</span>
                          <div className="text-[8px] mt-0.5">
                            {result === 'win'  && <span className="text-emerald-500">●</span>}
                            {result === 'loss' && <span className="text-rose-500">●</span>}
                            {result === 'tied' && <span className="text-gray-700">—</span>}
                          </div>
                        </div>

                        {/* Opp value */}
                        <div className="text-left pl-3">
                          <div className={`text-xl font-bold tabular-nums ${oppColor}`}>
                            {fmtStat(oppVal, cat.stat_id)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Projected Final section ── */}
                <div className="border-t border-white/10 mt-1">
                  {/* Section header */}
                  <div className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">
                        Projected Final
                      </span>
                      <span className="ml-2 text-[10px] text-gray-700">
                        {projLabel}
                        {(weekEnd || weekStart) && ` · through ${weekEnd ?? comingSundayISO()}`}
                      </span>
                    </div>
                    {loadingProj && (
                      <span className="text-[11px] text-gray-600 animate-pulse">Computing…</span>
                    )}
                  </div>

                  {/* Outcome pill */}
                  {projRecord && (
                    <div className={`mx-5 mb-3 text-[12px] font-semibold text-center py-2 rounded-lg ${
                      projRecord.won > projRecord.lost
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : projRecord.won < projRecord.lost
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-white/5 text-gray-400 border border-white/10'
                    }`}>
                      {projRecord.won > projRecord.lost
                        ? `Projected WIN  ·  ${projRecord.won}–${projRecord.tied}–${projRecord.lost}`
                        : projRecord.won < projRecord.lost
                        ? `Projected LOSS  ·  ${projRecord.won}–${projRecord.tied}–${projRecord.lost}`
                        : `Projected TIE  ·  ${projRecord.won}–${projRecord.tied}–${projRecord.lost}`}
                    </div>
                  )}

                  {/* Projected category breakdown */}
                  {myProjected && oppProjected && (
                    <>
                      {/* Column labels */}
                      <div className="grid grid-cols-[1fr_80px_1fr] px-5 pb-1 text-[9px] uppercase tracking-widest text-gray-700 font-semibold">
                        <div className="text-right pr-4">Yours</div>
                        <div className="text-center">Category</div>
                        <div className="text-left pl-4">Theirs</div>
                      </div>

                      {scoringCats.map(cat => {
                        const myProj  = myProjected[cat.stat_id]  ?? null;
                        const oppProj = oppProjected[cat.stat_id] ?? null;
                        const myVal   = myTeam?.stats?.[cat.stat_id]  ?? 0;
                        const oppVal  = oppTeam?.stats?.[cat.stat_id] ?? 0;
                        if (myProj === null && oppProj === null) return null;

                        const projResult = catResult(cat, myProj, oppProj);
                        const myColor  = projResult === 'win'  ? 'text-emerald-400' : projResult === 'tied' ? 'text-gray-400' : 'text-rose-400';
                        const oppColor = projResult === 'loss' ? 'text-emerald-400' : projResult === 'tied' ? 'text-gray-400' : 'text-rose-400';

                        // Delta from current (how much more we expect to gain)
                        const isPct = PCT_DEPS[cat.stat_id] != null;
                        const myDelta  = isPct ? null : (myProj  ?? 0) - myVal;
                        const oppDelta = isPct ? null : (oppProj ?? 0) - oppVal;

                        return (
                          <div
                            key={cat.stat_id}
                            className={`grid grid-cols-[1fr_76px_1fr] items-center px-4 py-3.5 border-b border-white/5 ${
                              projResult === 'win' ? 'bg-emerald-500/5' : projResult === 'loss' ? 'bg-rose-500/5' : ''
                            }`}
                          >
                            {/* My projected value */}
                            <div className="text-right pr-3">
                              <div className={`text-xl font-bold tabular-nums ${myColor}`}>
                                {fmtStat(myProj, cat.stat_id)}
                              </div>
                              {myDelta !== null && myDelta > 0 && (
                                <div className="text-[10px] text-gray-600 tabular-nums">+{fmtStat(myDelta, cat.stat_id)}</div>
                              )}
                            </div>

                            {/* Category */}
                            <div className="text-center">
                              <span className="text-[11px] font-semibold text-gray-500">{cat.display_name}</span>
                              <div className="text-[8px] mt-0.5">
                                {projResult === 'win'  && <span className="text-emerald-500">●</span>}
                                {projResult === 'loss' && <span className="text-rose-500">●</span>}
                                {projResult === 'tied' && <span className="text-gray-700">—</span>}
                              </div>
                            </div>

                            {/* Opp projected value */}
                            <div className="text-left pl-3">
                              <div className={`text-xl font-bold tabular-nums ${oppColor}`}>
                                {fmtStat(oppProj, cat.stat_id)}
                              </div>
                              {oppDelta !== null && oppDelta > 0 && (
                                <div className="text-[10px] text-gray-600 tabular-nums">+{fmtStat(oppDelta, cat.stat_id)}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Injury note */}
                  {(injuredMy.length > 0 || injuredOpp.length > 0) && (
                    <div className="px-5 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-600 border-t border-white/5">
                      <span>Projections exclude injured players</span>
                      {injuredMy.length > 0 && (
                        <span className="text-rose-500/60">
                          Your OUT: {injuredMy.map(p => p.name.split(' ').slice(-1)[0]).join(', ')}
                        </span>
                      )}
                      {injuredOpp.length > 0 && (
                        <span>Opp OUT: {injuredOpp.map(p => p.name.split(' ').slice(-1)[0]).join(', ')}</span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ══════════════════════════════════════════════
              Standings  (2 of 5 cols on xl)
          ══════════════════════════════════════════════ */}
          <div className="xl:col-span-2 bg-gray-900/60 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <div className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">Standings</div>
              <div className="text-white font-bold text-sm mt-0.5 truncate">{leagueName}</div>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/5 text-[9px] uppercase tracking-widest text-gray-700">
                  <th className="px-4 py-2 text-left font-semibold">#</th>
                  <th className="px-2 py-2 text-left font-semibold">Team</th>
                  <th className="px-2 py-2 text-center font-semibold">W</th>
                  <th className="px-2 py-2 text-center font-semibold">L</th>
                  <th className="px-2 py-2 text-center font-semibold">Win%</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(team => {
                  const isMe  = team.team_key === userTeam?.team_key;
                  const isOpp = team.team_key === oppTeam?.team_key;
                  const total = team.standings.wins + team.standings.losses + team.standings.ties;
                  const winPct = total > 0 ? team.standings.wins / total : 0;
                  return (
                    <tr
                      key={team.team_key}
                      className={`border-b border-white/5 ${
                        isMe  ? 'bg-orange-500/10' :
                        isOpp ? 'bg-blue-500/5'    : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-600 font-semibold w-8">{team.standings.rank}</td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-1.5">
                          {isMe  && <span className="text-[9px] font-bold px-1 py-0.5 bg-orange-500 text-white rounded shrink-0">YOU</span>}
                          {isOpp && <span className="text-[9px] font-bold px-1 py-0.5 bg-blue-600  text-white rounded shrink-0">OPP</span>}
                          <span className={`font-semibold truncate max-w-[100px] ${isMe ? 'text-orange-300' : 'text-white'}`}>
                            {team.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center text-emerald-400 font-semibold">{team.standings.wins}</td>
                      <td className="px-2 py-3 text-center text-rose-400 font-semibold">{team.standings.losses}</td>
                      <td className="px-2 py-3 text-center text-gray-400">{(winPct * 100).toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fallback: all matchups when user team not identified */}
      {!loadingData && matchups.length > 0 && !userTeam && (
        <div className="bg-gray-900/60 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">
              All Matchups — Week {currentWeek}
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {matchups.map((m, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <span className="font-semibold text-white flex-1 text-right text-sm">{m.teams[0]?.team_name}</span>
                <span className="text-gray-700 text-xs">vs</span>
                <span className="font-semibold text-white flex-1 text-sm">{m.teams[1]?.team_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
