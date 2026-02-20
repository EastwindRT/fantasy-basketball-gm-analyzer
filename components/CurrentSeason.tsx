'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchUserLeagues,
  fetchStandings,
  fetchCurrentMatchup,
  fetchCurrentUserGuid,
  fetchStatCategories,
  fetchLeague,
  getAuthState,
  isTokenExpired,
  initiateAuth,
} from '@/lib/yahoo-api';
import type { TeamData, MatchupData } from '@/lib/yahoo-api';

// Stat IDs that are "lower is better" (like turnovers)
const LOWER_IS_BETTER = new Set(['19', '21', '22', '23', '24', '25']);

interface LeagueOption {
  league_key: string;
  name: string;
  season: string;
}

interface StatCategory {
  stat_id: string;
  display_name: string;
}

export default function CurrentSeason() {
  const [isAuth, setIsAuth] = useState(false);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [leagueName, setLeagueName] = useState('');
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [standings, setStandings] = useState<TeamData[]>([]);
  const [matchups, setMatchups] = useState<MatchupData[]>([]);
  const [statCategories, setStatCategories] = useState<StatCategory[]>([]);
  const [userGuid, setUserGuid] = useState<string | null>(null);

  // Check auth on mount
  useEffect(() => {
    const auth = getAuthState();
    setIsAuth(!!auth.accessToken && !isTokenExpired());
  }, []);

  // Fetch leagues once authenticated
  useEffect(() => {
    if (!isAuth) return;
    setLoadingLeagues(true);
    setError(null);

    Promise.all([fetchUserLeagues('nba'), fetchCurrentUserGuid()])
      .then(([ls, guid]) => {
        // Filter to current season (2025)
        const current = ls.filter(l => l.season === '2025' || l.season === '2026');
        setLeagues(current.length > 0 ? current : ls.slice(0, 5));
        if (current.length > 0) setSelectedKey(current[0].league_key);
        else if (ls.length > 0) setSelectedKey(ls[0].league_key);
        setUserGuid(guid);
      })
      .catch(err => setError(`Failed to load leagues: ${err.message}`))
      .finally(() => setLoadingLeagues(false));
  }, [isAuth]);

  // Fetch league data when a league is selected
  const loadLeagueData = useCallback(async (leagueKey: string) => {
    if (!leagueKey) return;
    setLoadingData(true);
    setError(null);
    try {
      const [leagueInfo, teamStandings, weekMatchups, cats] = await Promise.all([
        fetchLeague(leagueKey),
        fetchStandings(leagueKey),
        fetchCurrentMatchup(leagueKey),
        fetchStatCategories(leagueKey),
      ]);
      setLeagueName(leagueInfo.name);
      setCurrentWeek(leagueInfo.current_week ?? null);
      setStandings(teamStandings.sort((a, b) => a.standings.rank - b.standings.rank));
      setMatchups(weekMatchups);
      setStatCategories(cats);
    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedKey) loadLeagueData(selectedKey);
  }, [selectedKey, loadLeagueData]);

  // Identify user's team from standings by GUID match
  const userTeam = userGuid
    ? standings.find(t => t.manager.guid === userGuid)
    : null;

  // Find user's current matchup
  const userMatchup = userTeam
    ? matchups.find(m => m.teams.some(t => t.team_key === userTeam.team_key))
    : null;

  const myTeamInMatchup = userMatchup?.teams.find(t => t.team_key === userTeam?.team_key);
  const oppTeamInMatchup = userMatchup?.teams.find(t => t.team_key !== userTeam?.team_key);

  // Compute category wins/losses
  function compareStats() {
    if (!myTeamInMatchup?.stats || !oppTeamInMatchup?.stats) return { won: 0, tied: 0, lost: 0 };
    let won = 0, tied = 0, lost = 0;
    for (const cat of statCategories) {
      const myVal = myTeamInMatchup.stats[cat.stat_id] ?? 0;
      const oppVal = oppTeamInMatchup.stats[cat.stat_id] ?? 0;
      const lowerBetter = LOWER_IS_BETTER.has(cat.stat_id);
      if (myVal === oppVal) tied++;
      else if (lowerBetter ? myVal < oppVal : myVal > oppVal) won++;
      else lost++;
    }
    return { won, tied, lost };
  }

  const catRecord = compareStats();

  if (!isAuth) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center">
          <span className="text-3xl">🏀</span>
        </div>
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
    <div className="space-y-6">
      {/* League selector */}
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
        {leagueName && (
          <span className="text-sm text-gray-400">
            {leagueName}
            {currentWeek != null && ` — Week ${currentWeek}`}
          </span>
        )}
        {loadingData && (
          <span className="text-sm text-gray-500 animate-pulse">Fetching data…</span>
        )}
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {!loadingData && standings.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ── Current Matchup ── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10">
              <h3 className="text-[17px] font-semibold text-white">
                Current Matchup {currentWeek != null ? `— Week ${currentWeek}` : ''}
              </h3>
              {userMatchup && catRecord && (
                <p className="text-[13px] text-gray-400 mt-0.5">
                  Your record:{' '}
                  <span className="text-green-600 dark:text-green-400 font-semibold">{catRecord.won}W</span>
                  {' / '}
                  <span className="text-gray-500 font-semibold">{catRecord.tied}T</span>
                  {' / '}
                  <span className="text-red-500 dark:text-red-400 font-semibold">{catRecord.lost}L</span>
                </p>
              )}
            </div>

            {!userMatchup ? (
              <div className="px-6 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                {userTeam
                  ? 'No matchup found for current week.'
                  : 'Could not identify your team. Showing all matchups below.'}
              </div>
            ) : (
              <div className="px-4 py-4">
                {/* Header row */}
                <div className="grid grid-cols-3 mb-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="text-right pr-3 truncate">{myTeamInMatchup?.team_name ?? 'Your Team'}</div>
                  <div className="text-center">Category</div>
                  <div className="text-left pl-3 truncate">{oppTeamInMatchup?.team_name ?? 'Opponent'}</div>
                </div>

                {statCategories.length > 0 ? (
                  <div className="space-y-1">
                    {statCategories.map(cat => {
                      const myVal = myTeamInMatchup?.stats?.[cat.stat_id] ?? null;
                      const oppVal = oppTeamInMatchup?.stats?.[cat.stat_id] ?? null;
                      if (myVal === null && oppVal === null) return null;

                      const lowerBetter = LOWER_IS_BETTER.has(cat.stat_id);
                      const myWins = myVal !== null && oppVal !== null && (lowerBetter ? myVal < oppVal : myVal > oppVal);
                      const oppWins = myVal !== null && oppVal !== null && (lowerBetter ? oppVal < myVal : oppVal > myVal);
                      const tied = myVal !== null && oppVal !== null && myVal === oppVal;

                      return (
                        <div
                          key={cat.stat_id}
                          className="grid grid-cols-3 items-center py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <div className={`text-right pr-3 text-sm font-semibold ${myWins ? 'text-green-600 dark:text-green-400' : tied ? 'text-gray-600 dark:text-gray-400' : 'text-red-500 dark:text-red-400'}`}>
                            {myVal !== null ? myVal : '—'}
                          </div>
                          <div className="text-center text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                            {cat.display_name}
                          </div>
                          <div className={`text-left pl-3 text-sm font-semibold ${oppWins ? 'text-green-600 dark:text-green-400' : tied ? 'text-gray-600 dark:text-gray-400' : 'text-red-500 dark:text-red-400'}`}>
                            {oppVal !== null ? oppVal : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Fallback: show total points */
                  <div className="grid grid-cols-3 items-center py-4 text-center">
                    <div className={`text-3xl font-bold ${(myTeamInMatchup?.points ?? 0) > (oppTeamInMatchup?.points ?? 0) ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {myTeamInMatchup?.points ?? '—'}
                    </div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">pts</div>
                    <div className={`text-3xl font-bold ${(oppTeamInMatchup?.points ?? 0) > (myTeamInMatchup?.points ?? 0) ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {oppTeamInMatchup?.points ?? '—'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── League Standings ── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10">
              <h3 className="text-[17px] font-semibold text-white">League Standings</h3>
              <p className="text-[13px] text-gray-400 mt-0.5">{standings.length} teams</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/10 text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-2 text-left font-medium text-gray-400">Rank</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-400">Team</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-400">W</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-400">L</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-400">T</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-400">Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((team, idx) => {
                    const isMe = team.team_key === userTeam?.team_key;
                    const total = team.standings.wins + team.standings.losses + team.standings.ties;
                    const winPct = total > 0 ? (team.standings.wins / total) : 0;
                    return (
                      <tr
                        key={team.team_key}
                        className={`border-b border-white/5 ${
                          isMe
                            ? 'bg-orange-500/10'
                            : idx % 2 === 0 ? '' : 'bg-white/3'
                        }`}
                      >
                        <td className="px-4 py-2.5 text-gray-400 font-medium">
                          {team.standings.rank}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {isMe && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-600 text-white rounded">YOU</span>
                            )}
                            <div>
                              <div className={`font-semibold ${isMe ? 'text-orange-300' : 'text-white'}`}>
                                {team.name}
                              </div>
                              <div className="text-[11px] text-gray-400 dark:text-gray-500">{team.manager.nickname}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-green-600 dark:text-green-400">
                          {team.standings.wins}
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-red-500 dark:text-red-400">
                          {team.standings.losses}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-500 dark:text-gray-400">
                          {team.standings.ties}
                        </td>
                        <td className="px-4 py-2.5 text-center font-medium text-gray-300">
                          {(winPct * 100).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* All matchups (when user team not identified, or as extra context) */}
      {!loadingData && matchups.length > 0 && !userTeam && (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/10">
            <h3 className="text-[17px] font-semibold text-white">
              All Matchups — Week {currentWeek}
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/10">
            {matchups.map((m, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between gap-4">
                <span className="font-semibold text-gray-900 dark:text-white flex-1 text-right">
                  {m.teams[0]?.team_name}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-sm px-3">vs</span>
                <span className="font-semibold text-gray-900 dark:text-white flex-1">
                  {m.teams[1]?.team_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
