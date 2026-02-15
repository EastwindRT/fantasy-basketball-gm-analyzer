/**
 * Data Processing Utilities
 *
 * Processes raw Yahoo API data into GM-focused statistics and insights.
 */

import { TeamData, TransactionData, DraftResult, MatchupData, LeagueSettings } from './yahoo-api';

export interface PlayoffSeasonStats {
  seed: number;
  playoffWins: number;
  playoffLosses: number;
  eliminatedRound: string; // 'Quarterfinals', 'Semifinals', 'Finals', 'Champion', or week number
  finalsAppearance: boolean;
  champion: boolean;
}

export interface GMAnalytics {
  teamKey: string;
  managerName: string;
  managerId: string;
  managerGuid: string;
  seasons: {
    [season: string]: {
      rank: number;
      wins: number;
      losses: number;
      ties: number;
      pointsFor: number;
      pointsAgainst: number;
      playoffAppearance: boolean;
      championship: boolean;
      teamKey: string;
      playoff?: PlayoffSeasonStats;
    };
  };
  overallRanking: number;
  bestFinish: number;
  worstFinish: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  winPercentage: number;
  playoffAppearances: number;
  championships: number;
  // Playoff aggregate stats
  playoffWins: number;
  playoffLosses: number;
  playoffWinPercentage: number;
  finalsAppearances: number;
  bestPlayoffSeed: number;
  avgPlayoffSeed: number;
  headToHead: {
    [opponentManagerId: string]: {
      opponentName: string;
      wins: number;
      losses: number;
      ties: number;
    };
  };
  playerInteractions: {
    draftPicks: Array<{
      playerKey: string;
      playerName: string;
      round: number;
      pick: number;
      cost: number;
      season: string;
    }>;
    mostAdded: Array<{
      playerKey: string;
      playerName: string;
      count: number;
      successRate: number;
    }>;
    mostDropped: Array<{
      playerKey: string;
      playerName: string;
      count: number;
    }>;
    mostTraded: Array<{
      playerKey: string;
      playerName: string;
      count: number;
      tradePartners: string[];
    }>;
  };
  categoryDominance: {
    [category: string]: {
      wins: number;
      total: number;
      winRate: number;
    };
  };
  rosterChurn: {
    avgWeeklyChanges: number;
    totalAdds: number;
    totalDrops: number;
    totalTrades: number;
  };
  consistencyScore: number;
  bestDecisions: Array<{
    type: 'draft' | 'add' | 'trade';
    playerName: string;
    description: string;
    value: number;
    season: string;
  }>;
  worstDecisions: Array<{
    type: 'draft' | 'add' | 'trade';
    playerName: string;
    description: string;
    value: number;
    season: string;
  }>;
  rankingTrend: Array<{
    season: string;
    rank: number;
  }>;
}

// Helper to get manager identifier (guid is most reliable for cross-season)
function getManagerId(team: TeamData): string {
  return team.manager.guid || team.manager.manager_id;
}

/**
 * Process multi-season data for all GMs
 */
export function processGMAnalytics(
  teamsBySeason: { [season: string]: TeamData[] },
  transactionsBySeason: { [season: string]: TransactionData[] },
  matchupsBySeason: { [season: string]: MatchupData[] },
  draftResultsBySeason: { [season: string]: DraftResult[] } = {},
  statCategories: { [season: string]: Array<{ stat_id: string; name: string; display_name: string }> } = {},
  gmUsernameFilter?: string,
  leagueSettingsBySeason: { [season: string]: LeagueSettings } = {}
): Map<string, GMAnalytics> {
  const gmMap = new Map<string, GMAnalytics>();

  // Map team key to manager guid
  const teamKeyToManagerId: Map<string, string> = new Map();
  // Map team key to manager name
  const teamKeyToManagerName: Map<string, string> = new Map();

  // First pass: collect all team/manager mappings
  Object.entries(teamsBySeason).forEach(([season, teams]) => {
    if (!teams) return;
    teams.forEach((team) => {
      const managerId = getManagerId(team);
      teamKeyToManagerId.set(team.team_key, managerId);
      teamKeyToManagerName.set(team.team_key, team.manager.nickname);
    });
  });

  // Initialize GM data structure using manager guid as key
  Object.entries(teamsBySeason).forEach(([season, teams]) => {
    if (!teams) return;
    teams.forEach((team) => {
      const managerId = getManagerId(team);

      // Apply GM username filter if provided
      if (gmUsernameFilter && !team.manager.nickname.toLowerCase().includes(gmUsernameFilter.toLowerCase())) {
        return;
      }

      if (!gmMap.has(managerId)) {
        gmMap.set(managerId, {
          teamKey: team.team_key,
          managerName: team.manager.nickname,
          managerId: team.manager.manager_id,
          managerGuid: team.manager.guid,
          seasons: {},
          overallRanking: 0,
          bestFinish: 0,
          worstFinish: 0,
          totalWins: 0,
          totalLosses: 0,
          totalTies: 0,
          winPercentage: 0,
          playoffAppearances: 0,
          championships: 0,
          playoffWins: 0,
          playoffLosses: 0,
          playoffWinPercentage: 0,
          finalsAppearances: 0,
          bestPlayoffSeed: 0,
          avgPlayoffSeed: 0,
          headToHead: {},
          playerInteractions: {
            draftPicks: [],
            mostAdded: [],
            mostDropped: [],
            mostTraded: [],
          },
          categoryDominance: {},
          rosterChurn: {
            avgWeeklyChanges: 0,
            totalAdds: 0,
            totalDrops: 0,
            totalTrades: 0,
          },
          consistencyScore: 0,
          bestDecisions: [],
          worstDecisions: [],
          rankingTrend: [],
        });
      }

      const gm = gmMap.get(managerId)!;
      const standings = team.standings;
      const numTeams = teams.length;
      const leagueSettings = leagueSettingsBySeason[season];
      const numPlayoffTeams = leagueSettings?.num_playoff_teams || Math.ceil(numTeams / 2);
      const isPlayoff = standings.rank <= numPlayoffTeams;
      const isChampion = standings.rank === 1;

      gm.seasons[season] = {
        rank: standings.rank,
        wins: standings.wins,
        losses: standings.losses,
        ties: standings.ties,
        pointsFor: standings.points_for,
        pointsAgainst: standings.points_against,
        playoffAppearance: isPlayoff,
        championship: isChampion,
        teamKey: team.team_key,
      };

      gm.totalWins += standings.wins;
      gm.totalLosses += standings.losses;
      gm.totalTies += standings.ties;
      if (isPlayoff) gm.playoffAppearances++;
      if (isChampion) gm.championships++;
    });
  });

  // Calculate overall rankings, best/worst finish, win percentage
  gmMap.forEach((gm) => {
    const ranks = Object.values(gm.seasons).map((s) => s.rank);
    gm.overallRanking = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0;
    gm.bestFinish = ranks.length > 0 ? Math.min(...ranks) : 0;
    gm.worstFinish = ranks.length > 0 ? Math.max(...ranks) : 0;

    const totalGames = gm.totalWins + gm.totalLosses + gm.totalTies;
    gm.winPercentage = totalGames > 0 ? gm.totalWins / totalGames : 0;

    gm.rankingTrend = Object.entries(gm.seasons)
      .map(([season, data]) => ({ season, rank: data.rank }))
      .sort((a, b) => a.season.localeCompare(b.season));
  });

  // Process draft results
  Object.entries(draftResultsBySeason).forEach(([season, draftResults]) => {
    if (!draftResults) return;
    draftResults.forEach((draft) => {
      const managerId = teamKeyToManagerId.get(draft.team_key);
      if (!managerId) return;

      const gm = gmMap.get(managerId);
      if (!gm) return;

      gm.playerInteractions.draftPicks.push({
        playerKey: draft.player_key,
        playerName: draft.player_name || draft.player_key,
        round: draft.round,
        pick: draft.pick,
        cost: draft.cost || 0,
        season,
      });
    });
  });

  // Sort draft picks by season (newest first), then round, then pick
  gmMap.forEach((gm) => {
    gm.playerInteractions.draftPicks.sort((a, b) => {
      if (a.season !== b.season) return b.season.localeCompare(a.season);
      if (a.round !== b.round) return a.round - b.round;
      return a.pick - b.pick;
    });
  });

  // Process transactions - handle add, drop, add/drop (combined), trade, waiver
  Object.entries(transactionsBySeason).forEach(([season, transactions]) => {
    if (!transactions) return;

    transactions.forEach((tx) => {
      if (!tx.players) return;

      // Yahoo uses 'add/drop' as a combined type where one player is added and another dropped
      const isAddDrop = tx.type === 'add/drop' || tx.type === 'add' || tx.type === 'waiver';
      const isDrop = tx.type === 'drop' || tx.type === 'add/drop';
      const isTrade = tx.type === 'trade';

      tx.players.forEach((player) => {
        const destTeamKey = player.transaction_data.destination_team_key;
        const srcTeamKey = player.transaction_data.source_team_key;
        const destManagerId = destTeamKey ? teamKeyToManagerId.get(destTeamKey) : undefined;
        const srcManagerId = srcTeamKey ? teamKeyToManagerId.get(srcTeamKey) : undefined;
        const playerKey = player.player_key;
        const playerName = player.name.full;

        // Determine the action for this specific player within the transaction
        const playerType = player.transaction_data.type;

        // Handle adds (player was added to a team)
        if (playerType === 'add' || (isAddDrop && destTeamKey && !srcTeamKey)) {
          if (destManagerId) {
            const gm = gmMap.get(destManagerId);
            if (gm) {
              gm.rosterChurn.totalAdds++;
              const existing = gm.playerInteractions.mostAdded.find((p) => p.playerKey === playerKey);
              if (existing) {
                existing.count++;
              } else {
                gm.playerInteractions.mostAdded.push({ playerKey, playerName, count: 1, successRate: 0 });
              }
            }
          }
        }

        // Handle drops (player was dropped from a team)
        if (playerType === 'drop' || (isDrop && srcTeamKey && !destTeamKey)) {
          if (srcManagerId) {
            const gm = gmMap.get(srcManagerId);
            if (gm) {
              gm.rosterChurn.totalDrops++;
              const existing = gm.playerInteractions.mostDropped.find((p) => p.playerKey === playerKey);
              if (existing) {
                existing.count++;
              } else {
                gm.playerInteractions.mostDropped.push({ playerKey, playerName, count: 1 });
              }
            }
          }
        }

        // Handle trades
        if (isTrade) {
          if (destManagerId) {
            const gm = gmMap.get(destManagerId);
            if (gm) {
              gm.rosterChurn.totalTrades++;
              const existing = gm.playerInteractions.mostTraded.find((p) => p.playerKey === playerKey);
              const partnerName = srcTeamKey ? teamKeyToManagerName.get(srcTeamKey) || 'Unknown' : 'Unknown';
              if (existing) {
                existing.count++;
                if (!existing.tradePartners.includes(partnerName)) existing.tradePartners.push(partnerName);
              } else {
                gm.playerInteractions.mostTraded.push({ playerKey, playerName, count: 1, tradePartners: [partnerName] });
              }
            }
          }
          if (srcManagerId) {
            const gm = gmMap.get(srcManagerId);
            if (gm) {
              const existing = gm.playerInteractions.mostTraded.find((p) => p.playerKey === playerKey);
              const partnerName = destTeamKey ? teamKeyToManagerName.get(destTeamKey) || 'Unknown' : 'Unknown';
              if (existing) {
                existing.count++;
                if (!existing.tradePartners.includes(partnerName)) existing.tradePartners.push(partnerName);
              } else {
                gm.playerInteractions.mostTraded.push({ playerKey, playerName, count: 1, tradePartners: [partnerName] });
              }
            }
          }
        }
      });
    });
  });

  // Sort and limit player interactions, calculate derived stats
  gmMap.forEach((gm) => {
    gm.playerInteractions.mostAdded.sort((a, b) => b.count - a.count);
    gm.playerInteractions.mostAdded = gm.playerInteractions.mostAdded.slice(0, 10);

    gm.playerInteractions.mostDropped.sort((a, b) => b.count - a.count);
    gm.playerInteractions.mostDropped = gm.playerInteractions.mostDropped.slice(0, 10);

    gm.playerInteractions.mostTraded.sort((a, b) => b.count - a.count);
    gm.playerInteractions.mostTraded = gm.playerInteractions.mostTraded.slice(0, 10);

    // Calculate roster churn average
    const totalSeasons = Object.keys(gm.seasons).length;
    const estimatedWeeksPerSeason = 20;
    const totalChanges = gm.rosterChurn.totalAdds + gm.rosterChurn.totalDrops + gm.rosterChurn.totalTrades;
    gm.rosterChurn.avgWeeklyChanges = totalSeasons > 0
      ? totalChanges / (totalSeasons * estimatedWeeksPerSeason)
      : 0;

    // Calculate success rate for added players
    gm.playerInteractions.mostAdded.forEach((player) => {
      const droppedCount = gm.playerInteractions.mostDropped.find(p => p.playerKey === player.playerKey)?.count || 0;
      player.successRate = player.count > droppedCount ? (player.count - droppedCount) / player.count : 0;
    });
  });

  // Calculate consistency score (standard deviation of ranks)
  gmMap.forEach((gm) => {
    const ranks = Object.values(gm.seasons).map((s) => s.rank);
    if (ranks.length > 1) {
      const mean = gm.overallRanking;
      const variance = ranks.reduce((sum, rank) => sum + Math.pow(rank - mean, 2), 0) / ranks.length;
      gm.consistencyScore = Math.sqrt(variance);
    } else {
      gm.consistencyScore = 0;
    }
  });

  // Process head-to-head records from matchups
  Object.entries(matchupsBySeason).forEach(([season, matchups]) => {
    if (!matchups) return;
    matchups.forEach((matchup) => {
      if (matchup.teams.length !== 2) return;

      const team1 = matchup.teams[0];
      const team2 = matchup.teams[1];

      const manager1Id = teamKeyToManagerId.get(team1.team_key);
      const manager2Id = teamKeyToManagerId.get(team2.team_key);

      if (!manager1Id || !manager2Id) return;

      const gm1 = gmMap.get(manager1Id);
      const gm2 = gmMap.get(manager2Id);

      if (!gm1 || !gm2) return;

      // Update head-to-head for GM1
      if (!gm1.headToHead[manager2Id]) {
        gm1.headToHead[manager2Id] = { opponentName: gm2.managerName, wins: 0, losses: 0, ties: 0 };
      }
      // Update head-to-head for GM2
      if (!gm2.headToHead[manager1Id]) {
        gm2.headToHead[manager1Id] = { opponentName: gm1.managerName, wins: 0, losses: 0, ties: 0 };
      }

      // Determine winner/loser
      if (team1.win === true) {
        gm1.headToHead[manager2Id].wins++;
        gm2.headToHead[manager1Id].losses++;
      } else if (team2.win === true) {
        gm1.headToHead[manager2Id].losses++;
        gm2.headToHead[manager1Id].wins++;
      } else if (team1.points === team2.points) {
        gm1.headToHead[manager2Id].ties++;
        gm2.headToHead[manager1Id].ties++;
      } else if (team1.points > team2.points) {
        gm1.headToHead[manager2Id].wins++;
        gm2.headToHead[manager1Id].losses++;
      } else {
        gm1.headToHead[manager2Id].losses++;
        gm2.headToHead[manager1Id].wins++;
      }

      // Process category wins if stats are available
      if (team1.stats && team2.stats) {
        Object.keys(team1.stats).forEach((statId) => {
          const val1 = team1.stats![statId];
          const val2 = team2.stats![statId];

          if (!gm1.categoryDominance[statId]) {
            gm1.categoryDominance[statId] = { wins: 0, total: 0, winRate: 0 };
          }
          if (!gm2.categoryDominance[statId]) {
            gm2.categoryDominance[statId] = { wins: 0, total: 0, winRate: 0 };
          }

          gm1.categoryDominance[statId].total++;
          gm2.categoryDominance[statId].total++;

          if (val1 > val2) {
            gm1.categoryDominance[statId].wins++;
          } else if (val2 > val1) {
            gm2.categoryDominance[statId].wins++;
          }
        });
      }
    });
  });

  // Calculate category win rates and rename to display names
  gmMap.forEach((gm) => {
    Object.keys(gm.categoryDominance).forEach((statId) => {
      const cat = gm.categoryDominance[statId];
      cat.winRate = cat.total > 0 ? cat.wins / cat.total : 0;
    });

    const renamedCategories: typeof gm.categoryDominance = {};
    Object.entries(gm.categoryDominance).forEach(([statId, data]) => {
      let displayName = statId;
      for (const seasonCats of Object.values(statCategories)) {
        const found = seasonCats.find(c => c.stat_id === statId);
        if (found) {
          displayName = found.display_name || found.name;
          break;
        }
      }
      renamedCategories[displayName] = data;
    });
    gm.categoryDominance = renamedCategories;
  });

  // Process playoff matchups using league settings
  Object.entries(matchupsBySeason).forEach(([season, matchups]) => {
    if (!matchups) return;
    const leagueSettings = leagueSettingsBySeason[season];
    if (!leagueSettings || !leagueSettings.playoff_start_week) return;

    const playoffStartWeek = leagueSettings.playoff_start_week;
    const endWeek = leagueSettings.end_week || 25;
    const numPlayoffTeams = leagueSettings.num_playoff_teams || 0;
    const totalPlayoffWeeks = endWeek - playoffStartWeek + 1;

    // Filter to playoff week matchups only
    const playoffMatchups = matchups.filter(m => m.week >= playoffStartWeek && m.week <= endWeek);
    if (playoffMatchups.length === 0) return;

    // Track playoff results per team for this season
    const teamPlayoffResults: Map<string, { wins: number; losses: number; weekResults: { week: number; won: boolean; oppKey: string }[] }> = new Map();

    playoffMatchups.forEach((matchup) => {
      if (matchup.teams.length !== 2) return;
      const [t1, t2] = matchup.teams;

      [t1, t2].forEach((team) => {
        if (!teamPlayoffResults.has(team.team_key)) {
          teamPlayoffResults.set(team.team_key, { wins: 0, losses: 0, weekResults: [] });
        }
      });

      const r1 = teamPlayoffResults.get(t1.team_key)!;
      const r2 = teamPlayoffResults.get(t2.team_key)!;

      let t1Won: boolean;
      if (t1.win === true) {
        t1Won = true;
      } else if (t2.win === true) {
        t1Won = false;
      } else {
        t1Won = t1.points > t2.points;
      }

      if (t1Won) {
        r1.wins++;
        r2.losses++;
      } else {
        r1.losses++;
        r2.wins++;
      }
      r1.weekResults.push({ week: matchup.week, won: t1Won, oppKey: t2.team_key });
      r2.weekResults.push({ week: matchup.week, won: !t1Won, oppKey: t1.team_key });
    });

    // Determine round labels based on playoff structure
    const getRoundLabel = (weekOffset: number): string => {
      if (totalPlayoffWeeks <= 0) return `Week ${playoffStartWeek + weekOffset}`;
      // Common playoff structures: 3 rounds (QF, SF, F) or 2 rounds (SF, F)
      if (totalPlayoffWeeks >= 3) {
        if (weekOffset === 0) return 'Quarterfinals';
        if (weekOffset === 1) return 'Semifinals';
        if (weekOffset === 2) return 'Finals';
        return `Playoff Wk ${weekOffset + 1}`;
      } else if (totalPlayoffWeeks === 2) {
        if (weekOffset === 0) return 'Semifinals';
        if (weekOffset === 1) return 'Finals';
        return `Playoff Wk ${weekOffset + 1}`;
      } else {
        return 'Finals';
      }
    };

    // For each GM that made playoffs, determine their playoff stats
    teamPlayoffResults.forEach((results, teamKey) => {
      const managerId = teamKeyToManagerId.get(teamKey);
      if (!managerId) return;
      const gm = gmMap.get(managerId);
      if (!gm || !gm.seasons[season]) return;

      // Only count GMs that actually made playoffs
      if (!gm.seasons[season].playoffAppearance) return;

      const seed = gm.seasons[season].rank; // Regular season rank = playoff seed

      // Determine deepest round: find the last week they won + 1 (or if they won the final week)
      let eliminatedRound = 'Quarterfinals';
      const lastPlayoffWeekPlayed = results.weekResults.length > 0
        ? Math.max(...results.weekResults.map(r => r.week))
        : playoffStartWeek;
      const lastWeekOffset = lastPlayoffWeekPlayed - playoffStartWeek;
      const lastWeekResult = results.weekResults.find(r => r.week === lastPlayoffWeekPlayed);

      if (lastWeekResult?.won && lastPlayoffWeekPlayed === endWeek) {
        eliminatedRound = 'Champion';
      } else if (lastPlayoffWeekPlayed === endWeek) {
        eliminatedRound = 'Finals';
      } else {
        eliminatedRound = getRoundLabel(lastWeekOffset);
      }

      const isFinalsAppearance = lastPlayoffWeekPlayed >= endWeek;
      const isChampFromPlayoffs = lastWeekResult?.won && lastPlayoffWeekPlayed === endWeek;

      const playoffStats: PlayoffSeasonStats = {
        seed,
        playoffWins: results.wins,
        playoffLosses: results.losses,
        eliminatedRound,
        finalsAppearance: isFinalsAppearance,
        champion: isChampFromPlayoffs || false,
      };

      gm.seasons[season].playoff = playoffStats;
      gm.playoffWins += results.wins;
      gm.playoffLosses += results.losses;
      if (isFinalsAppearance) gm.finalsAppearances++;
    });
  });

  // Calculate aggregate playoff stats
  gmMap.forEach((gm) => {
    const totalPlayoffGames = gm.playoffWins + gm.playoffLosses;
    gm.playoffWinPercentage = totalPlayoffGames > 0 ? gm.playoffWins / totalPlayoffGames : 0;

    const seeds = Object.values(gm.seasons)
      .filter(s => s.playoffAppearance && s.playoff?.seed)
      .map(s => s.playoff!.seed);
    gm.bestPlayoffSeed = seeds.length > 0 ? Math.min(...seeds) : 0;
    gm.avgPlayoffSeed = seeds.length > 0 ? seeds.reduce((a, b) => a + b, 0) / seeds.length : 0;
  });

  // Generate best/worst decisions
  gmMap.forEach((gm) => {
    gm.playerInteractions.mostAdded
      .filter(p => p.count >= 2 && p.successRate > 0.5)
      .slice(0, 3)
      .forEach((player) => {
        gm.bestDecisions.push({
          type: 'add',
          playerName: player.playerName,
          description: `Added ${player.playerName} ${player.count} times with ${(player.successRate * 100).toFixed(0)}% success rate`,
          value: player.count * player.successRate,
          season: 'Multiple',
        });
      });

    gm.playerInteractions.draftPicks
      .filter(p => p.round <= 3)
      .slice(0, 2)
      .forEach((pick) => {
        gm.bestDecisions.push({
          type: 'draft',
          playerName: pick.playerName,
          description: `Drafted ${pick.playerName} in round ${pick.round} (pick ${pick.pick})`,
          value: (10 - pick.round) * 2,
          season: pick.season,
        });
      });

    gm.playerInteractions.mostDropped
      .filter(p => p.count >= 3)
      .slice(0, 3)
      .forEach((player) => {
        gm.worstDecisions.push({
          type: 'drop' as any,
          playerName: player.playerName,
          description: `Dropped ${player.playerName} ${player.count} times - may indicate roster churn issues`,
          value: player.count,
          season: 'Multiple',
        });
      });

    gm.bestDecisions.sort((a, b) => b.value - a.value);
    gm.bestDecisions = gm.bestDecisions.slice(0, 5);
    gm.worstDecisions.sort((a, b) => b.value - a.value);
    gm.worstDecisions = gm.worstDecisions.slice(0, 5);
  });

  return gmMap;
}

/**
 * Get aggregated draft data across all GMs (most drafted players league-wide)
 */
export function getMostDraftedPlayers(
  gmAnalytics: Map<string, GMAnalytics>
): Array<{ playerName: string; playerKey: string; count: number; avgCost: number; maxCost: number; managers: string[]; seasons: string[] }> {
  const playerDraftCounts: Map<string, { playerName: string; playerKey: string; count: number; totalCost: number; maxCost: number; managers: Set<string>; seasons: Set<string> }> = new Map();

  gmAnalytics.forEach((gm) => {
    gm.playerInteractions.draftPicks.forEach((pick) => {
      const key = pick.playerKey;
      if (!playerDraftCounts.has(key)) {
        playerDraftCounts.set(key, {
          playerName: pick.playerName,
          playerKey: key,
          count: 0,
          totalCost: 0,
          maxCost: 0,
          managers: new Set(),
          seasons: new Set(),
        });
      }
      const entry = playerDraftCounts.get(key)!;
      entry.count++;
      entry.totalCost += pick.cost;
      entry.maxCost = Math.max(entry.maxCost, pick.cost);
      entry.managers.add(gm.managerName);
      entry.seasons.add(pick.season);
    });
  });

  return Array.from(playerDraftCounts.values())
    .map(e => ({
      playerName: e.playerName,
      playerKey: e.playerKey,
      count: e.count,
      avgCost: e.count > 0 ? Math.round(e.totalCost / e.count) : 0,
      maxCost: e.maxCost,
      managers: Array.from(e.managers),
      seasons: Array.from(e.seasons).sort(),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

/**
 * Get league-wide trade summary
 */
export function getLeagueTradeSummary(
  gmAnalytics: Map<string, GMAnalytics>
): { totalTrades: number; mostActiveTrader: { name: string; count: number }; tradesByGM: Array<{ name: string; count: number }> } {
  const tradesByGM: Array<{ name: string; count: number }> = [];
  let totalTrades = 0;

  gmAnalytics.forEach((gm) => {
    tradesByGM.push({ name: gm.managerName, count: gm.rosterChurn.totalTrades });
    totalTrades += gm.rosterChurn.totalTrades;
  });

  tradesByGM.sort((a, b) => b.count - a.count);
  // Trades are double-counted (both sides), so divide total by 2
  totalTrades = Math.round(totalTrades / 2);

  return {
    totalTrades,
    mostActiveTrader: tradesByGM[0] || { name: 'N/A', count: 0 },
    tradesByGM,
  };
}
