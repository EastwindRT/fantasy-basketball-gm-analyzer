/**
 * Data Processing Utilities
 *
 * Processes raw Yahoo API data into GM-focused statistics and insights.
 */

import { TeamData, TransactionData, DraftResult, MatchupData } from './yahoo-api';

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
    };
  };
  overallRanking: number;
  bestFinish: number;
  worstFinish: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  playoffAppearances: number;
  championships: number;
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

// Helper to normalize team keys for cross-season matching
function normalizeTeamKey(teamKey: string): string {
  // Extract just the team ID portion: "418.l.12345.t.1" -> "t.1"
  const parts = teamKey.split('.');
  if (parts.length >= 5) {
    return `${parts[3]}.${parts[4]}`;
  }
  return teamKey;
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
  gmUsernameFilter?: string
): Map<string, GMAnalytics> {
  const gmMap = new Map<string, GMAnalytics>();

  // Map to track manager guid -> team keys across seasons
  const managerTeamKeys: Map<string, Set<string>> = new Map();
  // Map team key to manager guid
  const teamKeyToManagerId: Map<string, string> = new Map();
  // Map team key to manager name
  const teamKeyToManagerName: Map<string, string> = new Map();

  // First pass: collect all team/manager mappings
  Object.entries(teamsBySeason).forEach(([season, teams]) => {
    teams.forEach((team) => {
      const managerId = getManagerId(team);
      teamKeyToManagerId.set(team.team_key, managerId);
      teamKeyToManagerName.set(team.team_key, team.manager.nickname);

      if (!managerTeamKeys.has(managerId)) {
        managerTeamKeys.set(managerId, new Set());
      }
      managerTeamKeys.get(managerId)!.add(team.team_key);
    });
  });

  // Initialize GM data structure using manager guid as key
  Object.entries(teamsBySeason).forEach(([season, teams]) => {
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
          bestFinish: Infinity,
          worstFinish: 0,
          totalWins: 0,
          totalLosses: 0,
          totalTies: 0,
          playoffAppearances: 0,
          championships: 0,
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
      const isPlayoff = standings.rank <= Math.ceil(numTeams / 2);
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
      if (standings.rank < gm.bestFinish) gm.bestFinish = standings.rank;
      if (standings.rank > gm.worstFinish) gm.worstFinish = standings.rank;
    });
  });

  // Calculate overall rankings
  gmMap.forEach((gm) => {
    const ranks = Object.values(gm.seasons).map((s) => s.rank);
    gm.overallRanking = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0;
    gm.rankingTrend = Object.entries(gm.seasons)
      .map(([season, data]) => ({ season, rank: data.rank }))
      .sort((a, b) => a.season.localeCompare(b.season));
  });

  // Process draft results - store individual picks with round/pick info
  Object.entries(draftResultsBySeason).forEach(([season, draftResults]) => {
    console.log(`Processing ${draftResults.length} draft results for season ${season}`);

    draftResults.forEach((draft) => {
      const managerId = teamKeyToManagerId.get(draft.team_key);
      if (!managerId) {
        console.log(`No manager found for team_key: ${draft.team_key}`);
        return;
      }

      const gm = gmMap.get(managerId);
      if (!gm) return;

      // Add this draft pick to the GM's draft picks list
      gm.playerInteractions.draftPicks.push({
        playerKey: draft.player_key,
        playerName: draft.player_name || draft.player_key, // Use player_name if available
        round: draft.round,
        pick: draft.pick,
        season,
      });
    });
  });

  // Sort draft picks by round then pick for each GM
  gmMap.forEach((gm) => {
    gm.playerInteractions.draftPicks.sort((a, b) => {
      if (a.season !== b.season) return b.season.localeCompare(a.season); // Most recent season first
      if (a.round !== b.round) return a.round - b.round;
      return a.pick - b.pick;
    });
  });

  // Process transactions
  const addedPlayerPerformance: Map<string, Map<string, { added: boolean; stillOnRoster: boolean; season: string }>> = new Map();
  const tradePartnerMap: Map<string, Map<string, Set<string>>> = new Map(); // managerId -> playerKey -> Set<partnerNames>

  Object.entries(transactionsBySeason).forEach(([season, transactions]) => {
    console.log(`Processing ${transactions.length} transactions for season ${season}`);
    let addCount = 0, dropCount = 0, tradeCount = 0;

    transactions.forEach((tx) => {
      if (!tx.players) {
        console.log(`Transaction ${tx.transaction_key} has no players, type: ${tx.type}`);
        return;
      }

      tx.players.forEach((player) => {
        const destTeamKey = player.transaction_data.destination_team_key;
        const srcTeamKey = player.transaction_data.source_team_key;

        const destManagerId = destTeamKey ? teamKeyToManagerId.get(destTeamKey) : undefined;
        const srcManagerId = srcTeamKey ? teamKeyToManagerId.get(srcTeamKey) : undefined;

        const playerKey = player.player_key;
        const playerName = player.name.full;

        // Handle adds
        if (tx.type === 'add') {
          addCount++;
          if (destManagerId) {
            const gm = gmMap.get(destManagerId);
            if (gm) {
              gm.rosterChurn.totalAdds++;
              const existing = gm.playerInteractions.mostAdded.find((p) => p.playerKey === playerKey);
              if (existing) {
                existing.count++;
              } else {
                gm.playerInteractions.mostAdded.push({
                  playerKey,
                  playerName,
                  count: 1,
                  successRate: 0, // Will calculate later
                });
              }
            }
          }
        }

        // Handle drops
        if (tx.type === 'drop') {
          dropCount++;
          if (srcManagerId) {
            const gm = gmMap.get(srcManagerId);
            if (gm) {
              gm.rosterChurn.totalDrops++;
              const existing = gm.playerInteractions.mostDropped.find((p) => p.playerKey === playerKey);
              if (existing) {
                existing.count++;
              } else {
                gm.playerInteractions.mostDropped.push({
                  playerKey,
                  playerName,
                  count: 1,
                });
              }
            }
          }
        }

        // Handle trades
        if (tx.type === 'trade') {
          tradeCount++;
          // Track for destination team
          if (destManagerId) {
            const gm = gmMap.get(destManagerId);
            if (gm) {
              gm.rosterChurn.totalTrades++;

              const existing = gm.playerInteractions.mostTraded.find((p) => p.playerKey === playerKey);
              const partnerName = srcTeamKey ? teamKeyToManagerName.get(srcTeamKey) || 'Unknown' : 'Unknown';

              if (existing) {
                existing.count++;
                if (!existing.tradePartners.includes(partnerName)) {
                  existing.tradePartners.push(partnerName);
                }
              } else {
                gm.playerInteractions.mostTraded.push({
                  playerKey,
                  playerName,
                  count: 1,
                  tradePartners: [partnerName],
                });
              }
            }
          }

          // Track for source team too (they traded away)
          if (srcManagerId) {
            const gm = gmMap.get(srcManagerId);
            if (gm) {
              // Don't double count trades
              const existing = gm.playerInteractions.mostTraded.find((p) => p.playerKey === playerKey);
              const partnerName = destTeamKey ? teamKeyToManagerName.get(destTeamKey) || 'Unknown' : 'Unknown';

              if (existing) {
                existing.count++;
                if (!existing.tradePartners.includes(partnerName)) {
                  existing.tradePartners.push(partnerName);
                }
              } else {
                gm.playerInteractions.mostTraded.push({
                  playerKey,
                  playerName,
                  count: 1,
                  tradePartners: [partnerName],
                });
              }
            }
          }
        }
      });
    });
    console.log(`Season ${season} transaction counts - Adds: ${addCount}, Drops: ${dropCount}, Trades: ${tradeCount}`);
  });

  // Sort and limit player interactions
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
    gm.rosterChurn.avgWeeklyChanges = totalSeasons > 0 && estimatedWeeksPerSeason > 0
      ? totalChanges / (totalSeasons * estimatedWeeksPerSeason)
      : 0;

    // Calculate success rate for added players (simplified: players added multiple times = successful pickups)
    gm.playerInteractions.mostAdded.forEach((player) => {
      // If we added a player multiple times, they might be valuable
      // If we added and then dropped, less successful
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
        gm1.headToHead[manager2Id] = {
          opponentName: gm2.managerName,
          wins: 0,
          losses: 0,
          ties: 0,
        };
      }

      // Update head-to-head for GM2
      if (!gm2.headToHead[manager1Id]) {
        gm2.headToHead[manager1Id] = {
          opponentName: gm1.managerName,
          wins: 0,
          losses: 0,
          ties: 0,
        };
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

          // Initialize category tracking for both GMs
          if (!gm1.categoryDominance[statId]) {
            gm1.categoryDominance[statId] = { wins: 0, total: 0, winRate: 0 };
          }
          if (!gm2.categoryDominance[statId]) {
            gm2.categoryDominance[statId] = { wins: 0, total: 0, winRate: 0 };
          }

          gm1.categoryDominance[statId].total++;
          gm2.categoryDominance[statId].total++;

          // Higher is better for most stats (simplified)
          if (val1 > val2) {
            gm1.categoryDominance[statId].wins++;
          } else if (val2 > val1) {
            gm2.categoryDominance[statId].wins++;
          }
        });
      }
    });
  });

  // Calculate category win rates and add stat names
  gmMap.forEach((gm) => {
    Object.keys(gm.categoryDominance).forEach((statId) => {
      const cat = gm.categoryDominance[statId];
      cat.winRate = cat.total > 0 ? cat.wins / cat.total : 0;
    });

    // Rename stat IDs to display names if available
    const renamedCategories: typeof gm.categoryDominance = {};
    Object.entries(gm.categoryDominance).forEach(([statId, data]) => {
      // Try to find display name from any season's stat categories
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

  // Generate best/worst decisions based on data
  gmMap.forEach((gm) => {
    // Best decisions: players added multiple times with high success rate
    gm.playerInteractions.mostAdded
      .filter(p => p.count >= 2 && p.successRate > 0.5)
      .slice(0, 3)
      .forEach((player, idx) => {
        gm.bestDecisions.push({
          type: 'add',
          playerName: player.playerName,
          description: `Added ${player.playerName} ${player.count} times with ${(player.successRate * 100).toFixed(0)}% success rate`,
          value: player.count * player.successRate,
          season: 'Multiple',
        });
      });

    // Best decisions: early round draft picks (round 1-3)
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

    // Worst decisions: players dropped multiple times (possibly premature drops)
    gm.playerInteractions.mostDropped
      .filter(p => p.count >= 3)
      .slice(0, 3)
      .forEach((player) => {
        gm.worstDecisions.push({
          type: 'drop',
          playerName: player.playerName,
          description: `Dropped ${player.playerName} ${player.count} times - may indicate roster churn issues`,
          value: player.count,
          season: 'Multiple',
        });
      });

    // Sort decisions by value
    gm.bestDecisions.sort((a, b) => b.value - a.value);
    gm.bestDecisions = gm.bestDecisions.slice(0, 5);

    gm.worstDecisions.sort((a, b) => b.value - a.value);
    gm.worstDecisions = gm.worstDecisions.slice(0, 5);
  });

  return gmMap;
}

/**
 * Calculate category dominance from matchup data
 */
export function calculateCategoryDominance(
  matchups: MatchupData[],
  teamKey: string,
  teamKeyToManagerId: Map<string, string>
): { [category: string]: { wins: number; total: number; winRate: number } } {
  const dominance: { [category: string]: { wins: number; total: number; winRate: number } } = {};

  matchups.forEach((matchup) => {
    const myTeam = matchup.teams.find(t => t.team_key === teamKey);
    const opponent = matchup.teams.find(t => t.team_key !== teamKey);

    if (!myTeam || !opponent || !myTeam.stats || !opponent.stats) return;

    Object.keys(myTeam.stats).forEach((statId) => {
      const myVal = myTeam.stats![statId];
      const oppVal = opponent.stats![statId];

      if (!dominance[statId]) {
        dominance[statId] = { wins: 0, total: 0, winRate: 0 };
      }

      dominance[statId].total++;

      // Simplified: higher is better
      if (myVal > oppVal) {
        dominance[statId].wins++;
      }
    });
  });

  // Calculate win rates
  Object.values(dominance).forEach((cat) => {
    cat.winRate = cat.total > 0 ? cat.wins / cat.total : 0;
  });

  return dominance;
}

/**
 * Filter GM analytics by username
 */
export function filterGMByUsername(
  gmAnalytics: Map<string, GMAnalytics>,
  username: string
): Map<string, GMAnalytics> {
  if (!username) return gmAnalytics;

  const filtered = new Map<string, GMAnalytics>();
  gmAnalytics.forEach((gm, key) => {
    if (gm.managerName.toLowerCase().includes(username.toLowerCase())) {
      filtered.set(key, gm);
    }
  });

  return filtered;
}
