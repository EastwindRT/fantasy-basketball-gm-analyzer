'use client';

/**
 * Category Dominance Chart Component
 * 
 * Bar chart showing win rates for different categories.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CategoryDominanceChartProps {
  data: {
    [category: string]: {
      wins: number;
      total: number;
      winRate: number;
    };
  };
}

export default function CategoryDominanceChart({ data }: CategoryDominanceChartProps) {
  const chartData = Object.entries(data).map(([category, stats]) => ({
    category,
    winRate: (stats.winRate * 100).toFixed(1),
    wins: stats.wins,
    total: stats.total,
  }));

  if (chartData.length === 0) {
    return (
      <div className="text-center p-8 text-gray-600 dark:text-gray-400">
        No category data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          type="number"
          domain={[0, 100]}
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          label={{ value: 'Win Rate (%)', position: 'insideBottom', offset: -5 }}
        />
        <YAxis
          type="category"
          dataKey="category"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          width={100}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
          formatter={(value: string, name: string) => [
            `${value}%`,
            name === 'winRate' ? 'Win Rate' : name,
          ]}
        />
        <Legend />
        <Bar
          dataKey="winRate"
          fill="#3b82f6"
          name="Win Rate (%)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}






