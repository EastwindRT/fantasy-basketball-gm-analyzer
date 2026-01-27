'use client';

/**
 * Export Button Component
 * 
 * Provides options to export data as CSV or PDF.
 */

import { useAppStore } from '@/lib/store';
import { exportToCSV, exportToPDF } from '@/lib/export-utils';
import { useMemo } from 'react';

export default function ExportButton() {
  const { gmAnalytics, selectedGM } = useAppStore();

  const selectedGMData = useMemo(() => {
    if (!gmAnalytics || !selectedGM) return null;
    return gmAnalytics.get(selectedGM) || null;
  }, [gmAnalytics, selectedGM]);

  const handleExportCSV = () => {
    if (!gmAnalytics) return;
    exportToCSV(gmAnalytics);
  };

  const handleExportPDF = () => {
    if (!gmAnalytics) return;
    exportToPDF(gmAnalytics, selectedGMData || null);
  };

  if (!gmAnalytics) {
    return null;
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleExportCSV}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        aria-label="Export to CSV"
      >
        Export CSV
      </button>
      <button
        onClick={handleExportPDF}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        aria-label="Export to PDF"
      >
        Export PDF
      </button>
    </div>
  );
}






