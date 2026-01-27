'use client';

/**
 * Input Form Component
 * 
 * Form for entering League ID, seasons, and optional GM username.
 */

import { useState, FormEvent, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { initiateAuth, getAuthState, isTokenExpired, fetchUserLeagues } from '@/lib/yahoo-api';
import AuthDebug from './AuthDebug';
import AuthTestButton from './AuthTestButton';
import AuthStatus from './AuthStatus';
import AccountSwitcher from './AccountSwitcher';
import YahooLogoutHelper from './YahooLogoutHelper';
import SeasonHelper from './SeasonHelper';

export default function InputForm() {
  const [leagueId, setLeagueId] = useState('');
  const [seasons, setSeasons] = useState('');
  const [gmUsername, setGmUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userLeagues, setUserLeagues] = useState<Array<{ league_key: string; name: string; season: string }>>([]);
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
  const [useMultipleLeagues, setUseMultipleLeagues] = useState(false);
  const [seasonLeagueIds, setSeasonLeagueIds] = useState<{ [season: string]: string }>({});

  const { setCurrentLeague, setError, setLoading, setLoadingMessage } = useAppStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Check authentication (use current state)
    if (!authState.accessToken || isTokenExpired()) {
      // Initiate OAuth flow
      initiateAuth();
      return;
    }

    // Normalize league ID format
    let normalizedLeagueId = leagueId.trim();

    // If user entered just a number, assume it's NBA
    if (/^\d+$/.test(normalizedLeagueId)) {
      normalizedLeagueId = `nba.l.${normalizedLeagueId}`;
    }

    // Validate format: accepts both:
    // - "nba.l.12345" (sport.l.number)
    // - "428.l.10624" (gamekey.l.number) - format returned by Yahoo API
    if (!/^[a-z0-9]+\.l\.\d+$/i.test(normalizedLeagueId)) {
      setError('Invalid league ID format. Expected format: "nba.l.12345", "428.l.10624", or just "12345" (for NBA).');
      setIsSubmitting(false);
      return;
    }

    // Parse seasons
    let seasonList: string[] = [];
    if (seasons.trim()) {
      seasonList = seasons.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      // Default to last 4 seasons
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth(); // 0-11
      // NBA season typically starts in October (month 9), so if we're before October, current season is previous year
      const nbaSeason = currentMonth >= 9 ? currentYear : currentYear - 1;
      // Generate last 4 seasons
      seasonList = [
        nbaSeason.toString(),
        (nbaSeason - 1).toString(),
        (nbaSeason - 2).toString(),
        (nbaSeason - 3).toString(),
      ];
    }

    // Build season-specific league keys if using multiple leagues mode
    const seasonKeys: { [season: string]: string } = {};
    if (useMultipleLeagues) {
      seasonList.forEach((season) => {
        const customKey = seasonLeagueIds[season];
        if (customKey && customKey.trim()) {
          // Normalize custom key
          let normalizedKey = customKey.trim();
          if (/^\d+$/.test(normalizedKey)) {
            normalizedKey = `nba.l.${normalizedKey}`;
          }
          seasonKeys[season] = normalizedKey;
        }
      });
    }

    setCurrentLeague(normalizedLeagueId, seasonList, gmUsername.trim() || undefined, seasonKeys);
    setLoading(true);
    setLoadingMessage('Fetching league data...');
    setIsSubmitting(false);

    // The parent component will handle the actual data fetching
  };

  const handleAuth = () => {
    // Check if user wants to force login (for account switching)
    const shouldForceLogin = window.confirm(
      'Do you want to switch to a different Yahoo account?\n\n' +
      'Click OK to see the login screen (you can log out and use a different account).\n' +
      'Click Cancel to use your currently logged-in Yahoo account.'
    );
    initiateAuth(shouldForceLogin);
  };

  const handleFetchMyLeagues = async (sport: string = 'nba') => {
    setIsLoadingLeagues(true);
    try {
      console.log(`Fetching leagues for sport: ${sport}`);
      const leagues = await fetchUserLeagues(sport);
      console.log('Fetched leagues:', leagues);
      setUserLeagues(leagues);
      if (leagues.length === 0) {
        const sportLabel = sport === 'nba' ? 'NBA' : 'any';
        alert(`No ${sportLabel} leagues found for your account. Check the browser console (F12) for the API response. Make sure you are logged in with the correct Yahoo account.`);
      }
    } catch (err) {
      console.error('Failed to fetch leagues:', err);
      alert('Failed to fetch your leagues. Check the browser console (F12) for errors.');
    } finally {
      setIsLoadingLeagues(false);
    }
  };

  const handleSelectLeague = (league: { league_key: string; name: string; season: string }) => {
    setLeagueId(league.league_key);
    setSeasons(league.season);
  };

  const [authState, setAuthState] = useState({ accessToken: null, refreshToken: null, expiresAt: null });
  const [needsAuth, setNeedsAuth] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only check auth on client side to avoid hydration errors
    setMounted(true);
    const state = getAuthState();
    setAuthState(state);
    setNeedsAuth(!state.accessToken || isTokenExpired());
  }, []);

  // Don't render auth-dependent content until mounted to avoid hydration errors
  if (!mounted) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Fantasy Basketball GM Analyzer
        </h2>
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Fantasy Basketball GM Analyzer
      </h2>

      <AuthStatus />
      
      {!needsAuth && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
              Find your leagues automatically
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleFetchMyLeagues('nba')}
                disabled={isLoadingLeagues}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isLoadingLeagues ? 'Loading...' : 'NBA Leagues'}
              </button>
              <button
                onClick={() => handleFetchMyLeagues('')}
                disabled={isLoadingLeagues}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isLoadingLeagues ? 'Loading...' : 'All Leagues'}
              </button>
            </div>
          </div>

          {userLeagues.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-blue-700 dark:text-blue-300">Click a league to select it:</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {userLeagues.map((league) => (
                  <button
                    key={league.league_key}
                    onClick={() => handleSelectLeague(league)}
                    className="w-full text-left px-3 py-2 bg-white dark:bg-gray-700 rounded border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{league.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      ({league.season}) - {league.league_key}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {needsAuth && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
            You need to authenticate with Yahoo to access league data.
          </p>
          <div className="text-xs text-yellow-700 dark:text-yellow-300 mb-3 space-y-2">
            <p>
              <strong>🔑 Two Different Logins:</strong>
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><strong>App Credentials</strong> (already set up): Client ID/Secret identify this application to Yahoo</li>
              <li><strong>Your Yahoo Account</strong> (you'll log in now): Your personal Yahoo account that has access to your leagues</li>
            </ul>
            <p className="mt-2">
              <strong>Note:</strong> For private leagues, you must log in with a Yahoo account that is a member of that league.
            </p>
          </div>
          <button
            onClick={handleAuth}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Log In with Your Yahoo Account
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="leagueId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            League ID <span className="text-red-500">*</span>
          </label>
          <input
            id="leagueId"
            type="text"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            placeholder="e.g., nba.l.12345"
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            aria-label="League ID"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Format: sport.l.league_number (e.g., nba.l.12345)
          </p>
        </div>

        <div>
          <label htmlFor="seasons" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Seasons (Optional)
          </label>
          <input
            id="seasons"
            type="text"
            value={seasons}
            onChange={(e) => setSeasons(e.target.value)}
            placeholder="e.g., 2023,2024,2025"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            aria-label="Seasons to analyze"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Comma-separated years. If blank, defaults to last 4 seasons.
          </p>
          <SeasonHelper />
        </div>

        {/* Multiple League IDs Option */}
        {seasons.trim() && seasons.split(',').filter(Boolean).length > 0 && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useMultipleLeagues}
                onChange={(e) => setUseMultipleLeagues(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Different league ID for each season
              </span>
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Enable if your league has a different ID each season (common for renewed leagues)
            </p>

            {useMultipleLeagues && (
              <div className="mt-3 space-y-2">
                {seasons.split(',').map((s) => s.trim()).filter(Boolean).map((season) => (
                  <div key={season} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-16">
                      {season}:
                    </span>
                    <input
                      type="text"
                      value={seasonLeagueIds[season] || ''}
                      onChange={(e) => setSeasonLeagueIds({ ...seasonLeagueIds, [season]: e.target.value })}
                      placeholder={leagueId || 'League ID for this season'}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-white"
                    />
                  </div>
                ))}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Leave blank to use the default League ID above
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <label htmlFor="gmUsername" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            GM Username (Optional)
          </label>
          <input
            id="gmUsername"
            type="text"
            value={gmUsername}
            onChange={(e) => setGmUsername(e.target.value)}
            placeholder="Focus on specific GM"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            aria-label="GM username to focus on"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Leave blank to show stats for all GMs.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || needsAuth}
          className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Analyzing...' : 'Analyze League'}
        </button>
      </form>
      
      <AccountSwitcher />
      <YahooLogoutHelper />
      <AuthDebug />
      <AuthTestButton />
    </div>
  );
}



