'use client';

import { useState } from 'react';
import { TabConfig, ColumnConfig } from '@/lib/admin-config';

interface TabVisibilitySectionProps {
  tabs: TabConfig[];
  onChange: (tabs: TabConfig[]) => void;
}

export default function TabVisibilitySection({ tabs, onChange }: TabVisibilitySectionProps) {
  const [expandedTab, setExpandedTab] = useState<string | null>(null);

  const toggleTab = (key: string) => {
    onChange(tabs.map(t => t.key === key ? { ...t, visible: !t.visible } : t));
  };

  const moveTab = (key: string, direction: -1 | 1) => {
    const sorted = [...tabs].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(t => t.key === key);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const updated = sorted.map(t => ({ ...t }));
    const tempOrder = updated[idx].order;
    updated[idx].order = updated[swapIdx].order;
    updated[swapIdx].order = tempOrder;

    onChange(tabs.map(t => {
      const u = updated.find(x => x.key === t.key);
      return u ? { ...t, order: u.order } : t;
    }));
  };

  const toggleColumn = (tabKey: string, tableId: string, colKey: string) => {
    onChange(tabs.map(t => {
      if (t.key !== tabKey) return t;
      return {
        ...t,
        tables: t.tables.map(table => {
          if (table.id !== tableId) return table;
          return {
            ...table,
            columns: table.columns.map(c =>
              c.key === colKey ? { ...c, visible: !c.visible } : c
            ),
          };
        }),
      };
    }));
  };

  const moveColumn = (tabKey: string, tableId: string, colKey: string, direction: -1 | 1) => {
    onChange(tabs.map(t => {
      if (t.key !== tabKey) return t;
      return {
        ...t,
        tables: t.tables.map(table => {
          if (table.id !== tableId) return table;
          const sorted = [...table.columns].sort((a, b) => a.order - b.order);
          const idx = sorted.findIndex(c => c.key === colKey);
          const swapIdx = idx + direction;
          if (swapIdx < 0 || swapIdx >= sorted.length) return table;

          const updated = sorted.map(c => ({ ...c }));
          const tempOrder = updated[idx].order;
          updated[idx].order = updated[swapIdx].order;
          updated[swapIdx].order = tempOrder;

          return {
            ...table,
            columns: table.columns.map(c => {
              const u = updated.find(x => x.key === c.key);
              return u ? { ...c, order: u.order } : c;
            }),
          };
        }),
      };
    }));
  };

  const sortedTabs = [...tabs].sort((a, b) => a.order - b.order);

  return (
    <div>
      <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-1">Tabs & Columns</h3>
      <p className="text-[13px] text-gray-400 mb-4">Toggle visibility and reorder dashboard tabs</p>

      <div className="space-y-2">
        {sortedTabs.map((tab, i) => (
          <div key={tab.key} className="bg-gray-50 dark:bg-[#2c2c2e] rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveTab(tab.key, -1)}
                  disabled={i === 0}
                  className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveTab(tab.key, 1)}
                  disabled={i === sortedTabs.length - 1}
                  className="text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
                >
                  ▼
                </button>
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggleTab(tab.key)}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  tab.visible ? 'bg-[var(--color-primary)]' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  tab.visible ? 'left-[18px]' : 'left-0.5'
                }`} />
              </button>

              {/* Label */}
              <span className={`flex-1 text-[14px] font-medium ${
                tab.visible ? 'text-gray-900 dark:text-white' : 'text-gray-400'
              }`}>
                {tab.label}
              </span>

              {/* Expand for columns */}
              {tab.tables.some(t => t.columns.length > 0) && (
                <button
                  onClick={() => setExpandedTab(expandedTab === tab.key ? null : tab.key)}
                  className="text-[12px] text-[var(--color-primary)] font-medium hover:opacity-70 transition-opacity"
                >
                  {expandedTab === tab.key ? 'Hide Columns' : 'Columns'}
                </button>
              )}
            </div>

            {/* Column config */}
            {expandedTab === tab.key && tab.tables.map(table => (
              table.columns.length > 0 && (
                <div key={table.id} className="px-4 pb-3 pt-1 border-t border-gray-200/50 dark:border-white/5">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">{table.label}</p>
                  <div className="space-y-1">
                    {[...table.columns].sort((a, b) => a.order - b.order).map((col, ci) => (
                      <div key={col.key} className="flex items-center gap-2 py-1">
                        <div className="flex flex-col gap-0">
                          <button
                            onClick={() => moveColumn(tab.key, table.id, col.key, -1)}
                            disabled={ci === 0}
                            className="text-[8px] text-gray-400 hover:text-gray-600 disabled:opacity-20"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveColumn(tab.key, table.id, col.key, 1)}
                            disabled={ci === table.columns.length - 1}
                            className="text-[8px] text-gray-400 hover:text-gray-600 disabled:opacity-20"
                          >
                            ▼
                          </button>
                        </div>
                        <button
                          onClick={() => toggleColumn(tab.key, table.id, col.key)}
                          className={`relative w-8 h-[18px] rounded-full transition-colors ${
                            col.visible ? 'bg-[var(--color-success)]' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span className={`absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full shadow transition-transform ${
                            col.visible ? 'left-[14px]' : 'left-[2px]'
                          }`} />
                        </button>
                        <span className={`text-[13px] ${
                          col.visible ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'
                        }`}>
                          {col.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
