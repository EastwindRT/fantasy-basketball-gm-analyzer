/**
 * Export Utilities
 * 
 * Functions to export GM analytics data as CSV or PDF.
 */

import { GMAnalytics } from './data-processor';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Export GM analytics to CSV
 */
export function exportToCSV(gmAnalytics: Map<string, GMAnalytics>, filename: string = 'gm-analytics.csv'): void {
  const rows: string[][] = [];

  // Header row
  rows.push([
    'GM Name',
    'Avg Rank',
    'Best Finish',
    'Worst Finish',
    'Total Wins',
    'Total Losses',
    'Total Ties',
    'Playoff Appearances',
    'Championships',
    'Consistency Score',
  ]);

  // Data rows
  Array.from(gmAnalytics.values())
    .sort((a, b) => a.overallRanking - b.overallRanking)
    .forEach((gm) => {
      rows.push([
        gm.managerName,
        gm.overallRanking.toFixed(1),
        gm.bestFinish === Infinity ? '' : gm.bestFinish.toString(),
        gm.worstFinish.toString(),
        gm.totalWins.toString(),
        gm.totalLosses.toString(),
        gm.totalTies.toString(),
        gm.playoffAppearances.toString(),
        gm.championships.toString(),
        gm.consistencyScore.toFixed(2),
      ]);
    });

  // Convert to CSV string
  const csvContent = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export GM analytics to PDF
 */
export function exportToPDF(
  gmAnalytics: Map<string, GMAnalytics>,
  selectedGM: GMAnalytics | null = null,
  filename: string = 'gm-analytics.pdf'
): void {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text('Fantasy Basketball GM Analytics', 14, 22);

  if (selectedGM) {
    // Single GM report
    doc.setFontSize(14);
    doc.text(`GM: ${selectedGM.managerName}`, 14, 32);

    let yPos = 42;

    // Overall stats
    doc.setFontSize(12);
    doc.text('Overall Statistics', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.text(`Average Rank: ${selectedGM.overallRanking.toFixed(1)}`, 20, yPos);
    yPos += 6;
    doc.text(`Best Finish: ${selectedGM.bestFinish === Infinity ? 'N/A' : selectedGM.bestFinish}`, 20, yPos);
    yPos += 6;
    doc.text(`Worst Finish: ${selectedGM.worstFinish}`, 20, yPos);
    yPos += 6;
    doc.text(`Record: ${selectedGM.totalWins}-${selectedGM.totalLosses}-${selectedGM.totalTies}`, 20, yPos);
    yPos += 6;
    doc.text(`Championships: ${selectedGM.championships}`, 20, yPos);
    yPos += 10;

    // Season breakdown table
    const seasonData = Object.entries(selectedGM.seasons)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([season, data]) => [
        season,
        data.rank.toString(),
        `${data.wins}-${data.losses}-${data.ties}`,
        data.playoffAppearance ? 'Yes' : 'No',
        data.championship ? 'Yes' : 'No',
      ]);

    (doc as any).autoTable({
      startY: yPos,
      head: [['Season', 'Rank', 'Record', 'Playoffs', 'Champion']],
      body: seasonData,
      theme: 'striped',
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Player interactions
    if (selectedGM.playerInteractions.mostAdded.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.text('Most Added Players', 14, yPos);
      yPos += 8;

      const addedData = selectedGM.playerInteractions.mostAdded.map((p) => [
        p.playerName,
        p.count.toString(),
      ]);

      (doc as any).autoTable({
        startY: yPos,
        head: [['Player', 'Count']],
        body: addedData,
        theme: 'striped',
      });
    }
  } else {
    // All GMs overview
    const tableData = Array.from(gmAnalytics.values())
      .sort((a, b) => a.overallRanking - b.overallRanking)
      .map((gm) => [
        gm.managerName,
        gm.overallRanking.toFixed(1),
        gm.bestFinish === Infinity ? '' : gm.bestFinish.toString(),
        gm.worstFinish.toString(),
        `${gm.totalWins}-${gm.totalLosses}-${gm.totalTies}`,
        gm.championships.toString(),
      ]);

    (doc as any).autoTable({
      startY: 32,
      head: [['GM', 'Avg Rank', 'Best', 'Worst', 'Record', 'Championships']],
      body: tableData,
      theme: 'striped',
    });
  }

  // Save PDF
  doc.save(filename);
}






