'use client';

/**
 * Main Dashboard Component
 * 
 * Displays overview of all GMs with rankings, stats, and interactive cards.
 */

import { useAppStore } from '@/lib/store';
import { GMAnalytics } from '@/lib/data-processor';
import { useMemo } from 'react';

export default function Dashboard() {
  const { gmAnalytics, setSelectedGM } = useAppStore();

  const sortedGMs = useMemo(() => {
    if (!gmAnalytics) return [];
    
    return Array.from(gmAnalytics.values())
      .sort((a, b) => a.overallRanking - b.overallRanking);
  }, [gmAnalytics]);

  if (!gmAnalytics || sortedGMs.length === 0) {
    return (
      <div className="text-center p-8 text-gray-600 dark:text-gray-400">
        No GM data available. Please analyze a league first.
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          GM Rankings Overview
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Sorted by average finish position across all seasons
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Rank</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">GM Name</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Avg Rank</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Best</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Worst</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">W-L-T</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Playoffs</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Championships</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Consistency</th>
              </tr>
            </thead>
            <tbody>
              {sortedGMs.map((gm, index) => (
                <tr
                  key={gm.managerGuid || gm.managerId}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => setSelectedGM(gm.managerGuid || gm.managerId)}
                >
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                    {gm.managerName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {gm.overallRanking.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {gm.bestFinish === Infinity ? '-' : gm.bestFinish}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {gm.worstFinish}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {gm.totalWins}-{gm.totalLosses}-{gm.totalTies}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {gm.playoffAppearances}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {gm.championships}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {gm.consistencyScore.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedGMs.map((gm) => (
          <GMCard key={gm.managerGuid || gm.managerId} gm={gm} />
        ))}
      </div>
    </div>
  );
}

function GMCard({ gm }: { gm: GMAnalytics }) {
  const { setSelectedGM } = useAppStore();
  const managerId = gm.managerGuid || gm.managerId;

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
      onClick={() => setSelectedGM(managerId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          setSelectedGM(managerId);
        }
      }}
      aria-label={`View details for ${gm.managerName}`}
    >
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
        {gm.managerName}
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Avg Rank:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {gm.overallRanking.toFixed(1)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Record:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {gm.totalWins}-{gm.totalLosses}-{gm.totalTies}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Championships:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {gm.championships}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Seasons:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {Object.keys(gm.seasons).length}
          </span>
        </div>
      </div>
      <button
        className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedGM(managerId);
        }}
      >
        View Details
      </button>
    </div>
  );
}






