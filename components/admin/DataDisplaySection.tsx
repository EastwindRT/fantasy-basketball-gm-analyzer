'use client';

import { DataDisplayConfig } from '@/lib/admin-config';

interface DataDisplaySectionProps {
  dataDisplay: DataDisplayConfig;
  onChange: (dataDisplay: DataDisplayConfig) => void;
}

function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[14px] text-gray-700 dark:text-gray-300">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(parseInt(e.target.value) || min)}
        className="w-20 px-3 py-1.5 text-[13px] bg-gray-100 dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-gray-300 text-center"
      />
    </div>
  );
}

function SelectInput<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[14px] text-gray-700 dark:text-gray-300">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="px-3 py-1.5 text-[13px] bg-gray-100 dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-gray-300"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function DataDisplaySection({ dataDisplay, onChange }: DataDisplaySectionProps) {
  const update = (partial: Partial<DataDisplayConfig>) => onChange({ ...dataDisplay, ...partial });

  return (
    <div>
      <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-1">Data Display</h3>
      <p className="text-[13px] text-gray-400 mb-4">Control data formatting and defaults</p>

      <div className="space-y-1">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1 pt-2">Defaults</p>

        <NumberInput label="Default Seasons" value={dataDisplay.defaultSeasons} min={1} max={20} onChange={v => update({ defaultSeasons: v })} />
        <NumberInput label="Decimal Places (%)" value={dataDisplay.decimalPlaces} min={0} max={3} onChange={v => update({ decimalPlaces: v })} />
        <NumberInput label="Items Per Page" value={dataDisplay.itemsPerPage} min={0} max={100} onChange={v => update({ itemsPerPage: v })} />

        <SelectInput
          label="GM Sort Field"
          value={dataDisplay.defaultGMSortField}
          options={[
            { value: 'overallRanking', label: 'Overall Ranking' },
            { value: 'winPercentage', label: 'Win Percentage' },
            { value: 'totalWins', label: 'Total Wins' },
            { value: 'championships', label: 'Championships' },
          ]}
          onChange={v => update({ defaultGMSortField: v })}
        />

        <SelectInput
          label="Sort Direction"
          value={dataDisplay.defaultGMSortDirection}
          options={[
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
          ]}
          onChange={v => update({ defaultGMSortDirection: v })}
        />

        <div className="border-t border-gray-100 dark:border-white/5 my-3" />
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1 pt-2">Chart Preferences</p>

        <SelectInput
          label="Ranking Trends"
          value={dataDisplay.chartPreferences.rankingTrends}
          options={[
            { value: 'line', label: 'Line Chart' },
            { value: 'area', label: 'Area Chart' },
          ]}
          onChange={v => update({ chartPreferences: { ...dataDisplay.chartPreferences, rankingTrends: v } })}
        />

        <SelectInput
          label="Draft Board"
          value={dataDisplay.chartPreferences.draftBoard}
          options={[
            { value: 'bar', label: 'Bar Chart' },
            { value: 'table-only', label: 'Table Only' },
          ]}
          onChange={v => update({ chartPreferences: { ...dataDisplay.chartPreferences, draftBoard: v } })}
        />

        <SelectInput
          label="Playoff Record"
          value={dataDisplay.chartPreferences.playoffRecord}
          options={[
            { value: 'bar', label: 'Bar Chart' },
            { value: 'pie', label: 'Pie Chart' },
          ]}
          onChange={v => update({ chartPreferences: { ...dataDisplay.chartPreferences, playoffRecord: v } })}
        />
      </div>
    </div>
  );
}
