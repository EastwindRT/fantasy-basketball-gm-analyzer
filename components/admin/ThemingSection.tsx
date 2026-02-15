'use client';

import { ThemeConfig } from '@/lib/admin-config';

interface ThemingSectionProps {
  theme: ThemeConfig;
  onChange: (theme: ThemeConfig) => void;
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[14px] text-gray-700 dark:text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-20 px-2 py-1 text-[12px] font-mono bg-gray-100 dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-gray-300 text-center"
        />
      </div>
    </div>
  );
}

function RadioGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="py-2">
      <span className="text-[14px] text-gray-700 dark:text-gray-300 block mb-2">{label}</span>
      <div className="flex gap-2 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              value === opt.value
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-gray-100 dark:bg-[#2c2c2e] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#3a3a3c]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ThemingSection({ theme, onChange }: ThemingSectionProps) {
  const update = (partial: Partial<ThemeConfig>) => onChange({ ...theme, ...partial });

  return (
    <div>
      <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-1">Visual Theme</h3>
      <p className="text-[13px] text-gray-400 mb-4">Customize colors, sizing, and appearance</p>

      <div className="space-y-1">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1 pt-2">Colors</p>
        <ColorPicker label="Primary" value={theme.primaryColor} onChange={v => update({ primaryColor: v })} />
        <ColorPicker label="Accent" value={theme.accentColor} onChange={v => update({ accentColor: v })} />
        <ColorPicker label="Success" value={theme.successColor} onChange={v => update({ successColor: v })} />
        <ColorPicker label="Danger" value={theme.dangerColor} onChange={v => update({ dangerColor: v })} />
        <ColorPicker label="Warning" value={theme.warningColor} onChange={v => update({ warningColor: v })} />

        <div className="border-t border-gray-100 dark:border-white/5 my-3" />

        <div className="py-2">
          <span className="text-[14px] text-gray-700 dark:text-gray-300 block mb-2">Card Border Radius</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={24}
              value={theme.cardBorderRadius}
              onChange={e => update({ cardBorderRadius: parseInt(e.target.value) })}
              className="flex-1 accent-[var(--color-primary)]"
            />
            <span className="text-[13px] font-mono text-gray-500 w-10 text-right">{theme.cardBorderRadius}px</span>
          </div>
        </div>

        <RadioGroup
          label="Shadow Intensity"
          value={theme.shadowIntensity}
          options={[
            { value: 'none', label: 'None' },
            { value: 'light', label: 'Light' },
            { value: 'medium', label: 'Medium' },
            { value: 'heavy', label: 'Heavy' },
          ]}
          onChange={v => update({ shadowIntensity: v })}
        />

        <RadioGroup
          label="Font Size"
          value={theme.fontSizeScale}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'normal', label: 'Normal' },
            { value: 'large', label: 'Large' },
          ]}
          onChange={v => update({ fontSizeScale: v })}
        />

        <RadioGroup
          label="Dark Mode"
          value={theme.darkModeDefault}
          options={[
            { value: 'system', label: 'System' },
            { value: 'on', label: 'Dark' },
            { value: 'off', label: 'Light' },
          ]}
          onChange={v => update({ darkModeDefault: v })}
        />

        <RadioGroup
          label="Background"
          value={theme.backgroundStyle}
          options={[
            { value: 'plain', label: 'Plain' },
            { value: 'gradient', label: 'Gradient' },
            { value: 'subtle-pattern', label: 'Pattern' },
          ]}
          onChange={v => update({ backgroundStyle: v })}
        />
      </div>
    </div>
  );
}
