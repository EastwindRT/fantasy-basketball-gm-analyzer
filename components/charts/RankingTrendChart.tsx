'use client';

/**
 * Ranking Trend Chart Component
 * 
 * Line chart showing GM's ranking over multiple seasons.
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RankingTrendChartProps {
  data: Array<{
    season: string;
    rank: number;
  }>;
}

export default function RankingTrendChart({ data }: RankingTrendChartProps) {
  // Invert rank so lower is better (1st place = highest on chart)
  const chartData = data.map((item) => ({
    season: item.season,
    rank: item.rank,
    // For display, we can show inverted rank or keep as-is
    displayRank: item.rank,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="season"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          reversed
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          label={{ value: 'Rank', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
          formatter={(value: number) => [`Rank ${value}`, 'Rank']}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="displayRank"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          name="Rank"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}






