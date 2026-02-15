'use client';

import { AdminConfigProvider } from '@/lib/AdminConfigContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AdminConfigProvider>
      {children}
    </AdminConfigProvider>
  );
}
