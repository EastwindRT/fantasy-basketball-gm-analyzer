'use client';

/**
 * Head-to-Head Heatmap Component
 *
 * Heatmap showing win rates between GMs.
 */

import { useAppStore } from '@/lib/store';
import { GMAnalytics } from '@/lib/data-processor';
import { useMemo } from 'react';

interface HeadToHeadHeatmapProps {
  gm: GMAnalytics;
}

export default function HeadToHeadHeatmap({ gm }: HeadToHeadHeatmapProps) {
  const { gmAnalytics } = useAppStore();

  // Get all opponents this GM has faced
  const opponents = useMemo(() => {
    const opponentList: Array<{
      managerId: string;
      name: string;
      wins: number;
      losses: number;
      ties: number;
      winRate: number;
    }> = [];

    Object.entries(gm.headToHead).forEach(([opponentId, record]) => {
      const total = record.wins + record.losses + record.ties;
      const winRate = total > 0 ? record.wins / total : 0;

      opponentList.push({
        managerId: opponentId,
        name: record.opponentName,
        wins: record.wins,
        losses: record.losses,
        ties: record.ties,
        winRate,
      });
    });

    // Sort by most matchups played
    return opponentList.sort((a, b) => {
      const totalA = a.wins + a.losses + a.ties;
      const totalB = b.wins + b.losses + b.ties;
      return totalB - totalA;
    });
  }, [gm.headToHead]);

  if (opponents.length === 0) {
    return (
      <div className="text-center p-8 text-gray-600 dark:text-gray-400">
        No head-to-head data available. This data is populated from weekly matchups.
      </div>
    );
  }

  const getColorClass = (winRate: number): string => {
    if (winRate >= 0.6) return 'bg-green-500';
    if (winRate >= 0.5) return 'bg-green-400';
    if (winRate >= 0.4) return 'bg-yellow-500';
    if (winRate >= 0.3) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                Opponent
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                Record
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                Win Rate
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 w-32">
                Visual
              </th>
            </tr>
          </thead>
          <tbody>
            {opponents.map((opponent) => (
              <tr
                key={opponent.managerId}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">
                  {opponent.name}
                </td>
                <td className="px-3 py-2 text-center text-sm text-gray-600 dark:text-gray-400">
                  {opponent.wins}-{opponent.losses}
                  {opponent.ties > 0 ? `-${opponent.ties}` : ''}
                </td>
                <td className="px-3 py-2 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  {(opponent.winRate * 100).toFixed(0)}%
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getColorClass(opponent.winRate)} transition-all`}
                        style={{ width: `${opponent.winRate * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {opponents.length}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Opponents Faced</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {opponents.filter(o => o.winRate >= 0.5).length}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Winning Records</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {opponents.filter(o => o.winRate < 0.5).length}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Losing Records</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {opponents.length > 0
              ? (
                  (opponents.reduce((sum, o) => sum + o.winRate, 0) / opponents.length) *
                  100
                ).toFixed(0)
              : 0}
            %
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Overall H2H Win Rate</div>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Head-to-head records are calculated from all weekly matchups across analyzed seasons.
        Green indicates winning record (50%+), yellow is close, red is losing record.
      </p>
    </div>
  );
}
