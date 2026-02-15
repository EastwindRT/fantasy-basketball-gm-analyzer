'use client';

/**
 * GM Detail View Component
 * 
 * Shows comprehensive statistics for a specific GM including:
 * - Player interactions (drafted, added, dropped, traded)
 * - Category dominance
 * - Ranking trends
 * - Best/worst decisions
 * - Head-to-head records
 */

import { useAppStore } from '@/lib/store';
import { GMAnalytics } from '@/lib/data-processor';
import { useMemo } from 'react';
import RankingTrendChart from './charts/RankingTrendChart';
import CategoryDominanceChart from './charts/CategoryDominanceChart';
import HeadToHeadHeatmap from './charts/HeadToHeadHeatmap';

export default function GMDetailView() {
  const { gmAnalytics, selectedGM } = useAppStore();

  const gm = useMemo(() => {
    if (!gmAnalytics || !selectedGM) return null;
    // selectedGM is now a manager GUID or manager ID
    return gmAnalytics.get(selectedGM) || null;
  }, [gmAnalytics, selectedGM]);

  if (!gm) {
    return (
      <div className="text-center p-8 text-gray-600 dark:text-gray-400">
        No GM selected. Click on a GM card to view details.
      </div>
    );
  }

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
          <StatCard label="Average Rank" value={gm.overallRanking.toFixed(1)} />
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
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Playoffs</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Champion</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(gm.seasons)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([season, data]) => (
                  <tr
                    key={season}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                      {season}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {data.rank}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {data.wins}-{data.losses}-{data.ties}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {data.pointsFor.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {data.playoffAppearance ? '✓' : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {data.championship ? '🏆' : '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PlayerInteractionSection
          title="Most Traded Players"
          players={gm.playerInteractions.mostTraded}
        />
        <DraftPicksSection
          title="Draft Picks"
          picks={gm.playerInteractions.draftPicks}
        />
      </div>

      {/* Category Dominance */}
      {Object.keys(gm.categoryDominance).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Category Dominance
          </h3>
          <CategoryDominanceChart data={gm.categoryDominance} />
        </div>
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
          <StatCard
            label="Total Adds"
            value={gm.rosterChurn.totalAdds.toString()}
          />
          <StatCard
            label="Total Drops"
            value={gm.rosterChurn.totalDrops.toString()}
          />
          <StatCard
            label="Total Trades"
            value={gm.rosterChurn.totalTrades.toString()}
          />
          <StatCard
            label="Avg Weekly Changes"
            value={gm.rosterChurn.avgWeeklyChanges.toFixed(1)}
          />
        </div>
      </div>

      {/* Best/Worst Decisions */}
      {gm.bestDecisions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Best Decisions
          </h3>
          <ul className="space-y-2">
            {gm.bestDecisions.map((decision, index) => (
              <li
                key={index}
                className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm"
              >
                <span className="font-semibold text-green-800 dark:text-green-200">
                  {decision.type.toUpperCase()}
                </span>
                : {decision.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {gm.worstDecisions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Worst Decisions
          </h3>
          <ul className="space-y-2">
            {gm.worstDecisions.map((decision, index) => (
              <li
                key={index}
                className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm"
              >
                <span className="font-semibold text-red-800 dark:text-red-200">
                  {decision.type.toUpperCase()}
                </span>
                : {decision.description}
              </li>
            ))}
          </ul>
        </div>
      )}
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
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
        {title}
      </h3>
      <ul className="space-y-2">
        {players.map((player) => (
          <li
            key={player.playerKey}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
          >
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {player.playerName}
            </span>
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
}: {
  title: string;
  picks: Array<{
    playerKey: string;
    playerName: string;
    round: number;
    pick: number;
    season: string;
  }>;
}) {
  if (picks.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">No draft data available</p>
      </div>
    );
  }

  // Group picks by season
  const picksBySeason: { [season: string]: typeof picks } = {};
  picks.forEach((pick) => {
    if (!picksBySeason[pick.season]) {
      picksBySeason[pick.season] = [];
    }
    picksBySeason[pick.season].push(pick);
  });

  const seasons = Object.keys(picksBySeason).sort((a, b) => b.localeCompare(a));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
        {title}
      </h3>
      <div className="space-y-4 max-h-80 overflow-y-auto">
        {seasons.map((season) => (
          <div key={season}>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {season}-{(parseInt(season) + 1).toString().slice(-2)} Season
            </h4>
            <ul className="space-y-1">
              {picksBySeason[season].map((pick, idx) => (
                <li
                  key={`${pick.playerKey}-${idx}`}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <span className="text-sm text-gray-900 dark:text-white truncate flex-1">
                    {pick.playerName}
                  </span>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 ml-2 whitespace-nowrap">
                    Rd {pick.round}, Pick {pick.pick}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

