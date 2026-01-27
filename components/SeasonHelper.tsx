'use client';

/**
 * Helper component to show current NBA season info
 */

export default function SeasonHelper() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  // NBA season typically starts in October (month 9), so if we're before October, current season is previous year
  const nbaSeason = currentMonth >= 9 ? currentYear : currentYear - 1;
  const nextSeason = nbaSeason + 1;

  return (
    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs">
      <p className="text-blue-800 dark:text-blue-300">
        <strong>💡 Season Info:</strong> Current NBA season is <strong>{nbaSeason}</strong>. 
        The {nextSeason} season may not be available yet in Yahoo's API.
      </p>
      <p className="text-blue-700 dark:text-blue-400 mt-1">
        If you get a 400 error, try using seasons like: <strong>{nbaSeason}, {nbaSeason - 1}, {nbaSeason - 2}</strong>
      </p>
    </div>
  );
}


