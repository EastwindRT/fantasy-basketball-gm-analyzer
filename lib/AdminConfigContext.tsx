'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AdminSettings, DEFAULT_CONFIG } from './admin-config';

const AdminConfigContext = createContext<{
  config: AdminSettings;
  refreshConfig: () => void;
}>(
  { config: DEFAULT_CONFIG, refreshConfig: () => {} }
);

export function AdminConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AdminSettings>(DEFAULT_CONFIG);

  const refreshConfig = useCallback(() => {
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(data => {
        if (data && data.version) setConfig(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  // Apply theme CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const t = config.theme;

    root.style.setProperty('--color-primary', t.primaryColor);
    root.style.setProperty('--color-accent', t.accentColor);
    root.style.setProperty('--color-success', t.successColor);
    root.style.setProperty('--color-danger', t.dangerColor);
    root.style.setProperty('--color-warning', t.warningColor);
    root.style.setProperty('--card-border-radius', `${t.cardBorderRadius}px`);

    const shadows: Record<string, string> = {
      none: 'none',
      light: '0 1px 3px rgba(0,0,0,0.1)',
      medium: '0 4px 12px rgba(0,0,0,0.15)',
      heavy: '0 8px 30px rgba(0,0,0,0.2)',
    };
    root.style.setProperty('--card-shadow', shadows[t.shadowIntensity] || shadows.light);

    const scales: Record<string, string> = { compact: '14px', normal: '16px', large: '18px' };
    root.style.setProperty('--base-font-size', scales[t.fontSizeScale] || '16px');

    // Dark mode
    if (t.darkModeDefault === 'on') {
      root.classList.add('dark');
    } else if (t.darkModeDefault === 'off') {
      root.classList.remove('dark');
    } else {
      // System preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [config.theme]);

  return (
    <AdminConfigContext.Provider value={{ config, refreshConfig }}>
      {children}
    </AdminConfigContext.Provider>
  );
}

export function useAdminConfig(): AdminSettings {
  return useContext(AdminConfigContext).config;
}

export function useAdminConfigRefresh(): () => void {
  return useContext(AdminConfigContext).refreshConfig;
}
