'use client';

/**
 * GM Detail View Component
 *
 * Shows comprehensive statistics for a specific GM including:
 * - Player interactions (drafted, added, dropped, traded)
 * - Ranking trends
 * - Head-to-head records
 */

import { useAppStore } from '@/lib/store';
import { GMAnalytics } from '@/lib/data-processor';
import { useMemo } from 'react';
import RankingTrendChart from './charts/RankingTrendChart';
import HeadToHeadHeatmap from './charts/HeadToHeadHeatmap';

export default function GMDetailView() {
  const { gmAnalytics, selectedGM } = useAppStore();

  const gm = useMemo(() => {
    if (!gmAnalytics || !selectedGM) return null;
    return gmAnalytics.get(selectedGM) || null;
  }, [gmAnalytics, selectedGM]);

  if (!gm) {
    return (
      <div className="text-center p-8 text-gray-600 dark:text-gray-400">
        No GM selected. Click on a GM card to view details.
      </div>
    );
  }

  // Calculate total draft spend
  const totalDraftSpend = gm.playerInteractions.draftPicks.reduce((sum, p) => sum + (p.cost || 0), 0);
  const isAuction = totalDraftSpend > 0;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {gm.managerName}
          </h2>
          <button
            onClick={() => useAppStore.getState().setSelectedGM(null)}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Rank</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{gm.overallRanking.toFixed(1)}</div>
            <div className="text-[10px] text-gray-400 mt-1">Average finish position across all seasons (lower = better)</div>
          </div>
          <StatCard label="Record" value={`${gm.totalWins}-${gm.totalLosses}${gm.totalTies > 0 ? `-${gm.totalTies}` : ''}`} />
          <StatCard label="Win %" value={`${(gm.winPercentage * 100).toFixed(1)}%`} />
          <StatCard label="Championships" value={gm.championships.toString()} />
          <StatCard label="Consistency" value={gm.consistencyScore.toFixed(2)} />
        </div>
      </div>

      {/* Ranking Trend */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Ranking Trend Over Seasons
        </h3>
        <RankingTrendChart data={gm.rankingTrend} />
      </div>

      {/* Season-by-Season Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Season-by-Season Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Season</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Rank</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">W-L-T</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Points For</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(gm.seasons)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([season, data]) => {
                  const currentYear = new Date().getFullYear();
                  const isOngoing = parseInt(season) >= currentYear - 1;
                  return (
                    <tr key={season} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                        {season}-{(parseInt(season) + 1).toString().slice(-2)}
                        {isOngoing && <span className="ml-2 text-[10px] text-amber-500 font-semibold">IN PROGRESS</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{data.rank}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{data.wins}-{data.losses}-{data.ties}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{data.pointsFor.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {isOngoing ? 'Ongoing' : data.championship ? 'Champion' : data.playoffAppearance ? 'Playoffs' : '-'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Draft Picks with $ totals */}
      <DraftPicksSection
        title="Draft Picks"
        picks={gm.playerInteractions.draftPicks}
        isAuction={isAuction}
        totalSpend={totalDraftSpend}
      />

      {/* Player Interactions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PlayerInteractionSection
          title="Most Added Players"
          players={gm.playerInteractions.mostAdded}
        />
        <PlayerInteractionSection
          title="Most Dropped Players"
          players={gm.playerInteractions.mostDropped}
        />
      </div>

      {gm.playerInteractions.mostTraded.length > 0 && (
        <PlayerInteractionSection
          title="Most Traded Players"
          players={gm.playerInteractions.mostTraded}
        />
      )}

      {/* Head-to-Head Records */}
      {Object.keys(gm.headToHead).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Head-to-Head Records
          </h3>
          <HeadToHeadHeatmap gm={gm} />
        </div>
      )}

      {/* Roster Churn */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Roster Activity
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Adds" value={gm.rosterChurn.totalAdds.toString()} />
          <StatCard label="Total Drops" value={gm.rosterChurn.totalDrops.toString()} />
          <StatCard label="Total Trades" value={gm.rosterChurn.totalTrades.toString()} />
          <StatCard label="Avg Weekly Changes" value={gm.rosterChurn.avgWeeklyChanges.toFixed(1)} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

function PlayerInteractionSection({
  title,
  players,
}: {
  title: string;
  players: Array<{
    playerKey: string;
    playerName: string;
    count: number;
    [key: string]: any;
  }>;
}) {
  if (players.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{title}</h3>
      <ul className="space-y-2">
        {players.map((player) => (
          <li key={player.playerKey} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{player.playerName}</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {player.count} {player.count === 1 ? 'time' : 'times'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DraftPicksSection({
  title,
  picks,
  isAuction,
  totalSpend,
}: {
  title: string;
  picks: Array<{
    playerKey: string;
    playerName: string;
    round: number;
    pick: number;
    cost: number;
    season: string;
  }>;
  isAuction: boolean;
  totalSpend: number;
}) {
  if (picks.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">No draft data available</p>
      </div>
    );
  }

  // Group picks by season
  const picksBySeason: { [season: string]: typeof picks } = {};
  picks.forEach((pick) => {
    if (!picksBySeason[pick.season]) picksBySeason[pick.season] = [];
    picksBySeason[pick.season].push(pick);
  });

  const seasons = Object.keys(picksBySeason).sort((a, b) => b.localeCompare(a));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
        {isAuction && (
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Draft Spend</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">${totalSpend}</div>
          </div>
        )}
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {seasons.map((season) => {
          const seasonSpend = picksBySeason[season].reduce((sum, p) => sum + (p.cost || 0), 0);
          return (
            <div key={season}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {season}-{(parseInt(season) + 1).toString().slice(-2)} Season
                </h4>
                {isAuction && <span className="text-sm font-bold text-amber-600 dark:text-amber-400">${seasonSpend}</span>}
              </div>
              <ul className="space-y-1">
                {picksBySeason[season].map((pick, idx) => (
                  <li key={`${pick.playerKey}-${idx}`} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-sm text-gray-900 dark:text-white truncate flex-1">
                      {pick.playerName}
                    </span>
                    <div className="flex items-center gap-3 ml-2">
                      {isAuction && pick.cost > 0 && (
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">${pick.cost}</span>
                      )}
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        Rd {pick.round}, Pick {pick.pick}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
