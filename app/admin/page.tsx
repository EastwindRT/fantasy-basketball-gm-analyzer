'use client';

import { useState, useEffect } from 'react';
import { AdminSettings, DEFAULT_CONFIG } from '@/lib/admin-config';
import { useAdminConfigRefresh } from '@/lib/AdminConfigContext';
import PasswordGate from '@/components/admin/PasswordGate';
import TabVisibilitySection from '@/components/admin/TabVisibilitySection';
import ThemingSection from '@/components/admin/ThemingSection';
import DataDisplaySection from '@/components/admin/DataDisplaySection';

type Section = 'tabs' | 'theme' | 'data';

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [config, setConfig] = useState<AdminSettings>(DEFAULT_CONFIG);
  const [activeSection, setActiveSection] = useState<Section>('tabs');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const refreshGlobalConfig = useAdminConfigRefresh();

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_token');
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(data => { if (data?.version) setConfig(data); })
      .catch(() => {});
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setSaveStatus('idle');

    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setSaveStatus('success');
        refreshGlobalConfig();
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        if (res.status === 401) {
          sessionStorage.removeItem('admin_token');
          setToken(null);
          return;
        }
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
  };

  if (!token) {
    return <PasswordGate onAuthenticated={setToken} />;
  }

  const sections: { key: Section; label: string; icon: string }[] = [
    { key: 'tabs', label: 'Tabs & Columns', icon: '☰' },
    { key: 'theme', label: 'Visual Theme', icon: '◑' },
    { key: 'data', label: 'Data Display', icon: '▤' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/10 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-[13px] text-[var(--color-primary)] hover:opacity-70 transition-opacity">
              ← Dashboard
            </a>
            <h1 className="text-[17px] font-bold text-gray-900 dark:text-white">Admin Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === 'success' && (
              <span className="text-[13px] text-[var(--color-success)] font-medium">Saved</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-[13px] text-[var(--color-danger)] font-medium">Error</span>
            )}
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2c2c2e] transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg text-[13px] font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Section selector */}
        <div className="flex gap-0.5 bg-gray-100 dark:bg-[#2c2c2e] rounded-xl p-1">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                activeSection === s.key
                  ? 'bg-white dark:bg-[#3a3a3c] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-white/10 p-6">
          {activeSection === 'tabs' && (
            <TabVisibilitySection
              tabs={config.tabs}
              onChange={tabs => setConfig({ ...config, tabs })}
            />
          )}
          {activeSection === 'theme' && (
            <ThemingSection
              theme={config.theme}
              onChange={theme => setConfig({ ...config, theme })}
            />
          )}
          {activeSection === 'data' && (
            <DataDisplaySection
              dataDisplay={config.dataDisplay}
              onChange={dataDisplay => setConfig({ ...config, dataDisplay })}
            />
          )}
        </div>

        {/* Config preview */}
        <details className="group">
          <summary className="text-[13px] text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            View raw config JSON
          </summary>
          <pre className="mt-2 p-4 bg-gray-100 dark:bg-[#2c2c2e] rounded-xl text-[11px] text-gray-600 dark:text-gray-400 overflow-x-auto max-h-80 overflow-y-auto">
            {JSON.stringify(config, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
