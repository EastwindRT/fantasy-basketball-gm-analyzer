'use client';

/**
 * Main Page Component
 *
 * Orchestrates the entire application flow:
 * - Input form for league ID and seasons
 * - Data fetching and processing
 * - Dashboard and GM detail views
 * - Error handling and loading states
 */

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { getAuthState, isTokenExpired, exchangeCodeForToken } from '@/lib/yahoo-api';
import {
  fetchLeague,
  fetchStandings,
  fetchTransactions,
  fetchScoreboard,
  fetchDraftResults,
  fetchAllMatchups,
  fetchStatCategories,
  buildLeagueKey,
  MatchupData,
  DraftResult,
} from '@/lib/yahoo-api';
import { getCachedData, setCachedData, getCacheKey, clearCache } from '@/lib/data-cache';
import { processGMAnalytics } from '@/lib/data-processor';
import InputForm from '@/components/InputForm';
import Dashboard from '@/components/Dashboard';
import GMDetailView from '@/components/GMDetailView';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorDisplay from '@/components/ErrorDisplay';
import ExportButton from '@/components/ExportButton';

export default function Home() {
  const {
    currentLeagueKey,
    currentSeasons,
    seasonLeagueKeys,
    gmUsernameFilter,
    setLeagueData,
    setGMAnalytics,
    isLoading,
    setLoading,
    loadingMessage,
    setLoadingMessage,
    error,
    setError,
    selectedGM,
    reset,
  } = useAppStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const errorParam = urlParams.get('error');

    if (errorParam) {
      setError(`Authentication error: ${errorParam}`);
      window.history.replaceState({}, '', '/');
      return;
    }

    if (code) {
      const state = urlParams.get('state');
      const storedState = localStorage.getItem('yahoo_oauth_state');
      if (state && state !== storedState) {
        setError('Invalid state parameter. Please try again.');
        window.history.replaceState({}, '', '/');
        return;
      }
      if (storedState) {
        localStorage.removeItem('yahoo_oauth_state');
      }

      exchangeCodeForToken(code)
        .then(() => {
          window.history.replaceState({}, '', '/');
          setError(null);
          window.location.reload();
        })
        .catch((err) => {
          console.error('Authentication error:', err);
          setError(`Failed to authenticate: ${err.message || 'Unknown error'}`);
          window.history.replaceState({}, '', '/');
        });
    }

    setIsInitialized(true);
  }, [setError]);

  // Handle cache clear
  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearCache();
      alert('Cache cleared successfully!');
    } catch (err) {
      console.error('Failed to clear cache:', err);
      alert('Failed to clear cache');
    } finally {
      setIsClearingCache(false);
    }
  };

  // Fetch data when league is set
  useEffect(() => {
    if (!currentLeagueKey || currentSeasons.length === 0 || !isInitialized) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const authState = getAuthState();
        if (!authState.accessToken || isTokenExpired()) {
          setError('Please authenticate with Yahoo first.');
          setLoading(false);
          return;
        }

        setLoadingMessage('Fetching league data...');

        // Fetch league info for first season
        const firstSeason = currentSeasons[0];
        const leagueKey = buildLeagueKey(currentLeagueKey, firstSeason);

        let leagueData = await getCachedData(getCacheKey(leagueKey, firstSeason, 'league'));
        if (!leagueData) {
          leagueData = await fetchLeague(leagueKey);
          await setCachedData(getCacheKey(leagueKey, firstSeason, 'league'), leagueData, true);
        }
        setLeagueData(leagueData);

        // Data structures to collect across seasons
        const teamsBySeason: { [season: string]: any[] } = {};
        const transactionsBySeason: { [season: string]: any[] } = {};
        const matchupsBySeason: { [season: string]: MatchupData[] } = {};
        const draftResultsBySeason: { [season: string]: DraftResult[] } = {};
        const statCategoriesBySeason: { [season: string]: Array<{ stat_id: string; name: string; display_name: string }> } = {};

        for (let i = 0; i < currentSeasons.length; i++) {
          const season = currentSeasons[i];
          // Use season-specific league key if available, otherwise use the default
          const baseLeagueKey = seasonLeagueKeys[season] || currentLeagueKey;
          const seasonLeagueKey = buildLeagueKey(baseLeagueKey, season);

          console.log(`Season ${season}: Using league key ${seasonLeagueKey} (base: ${baseLeagueKey})`);

          setLoadingMessage(`Fetching data for ${season} (${i + 1}/${currentSeasons.length})...`);

          // Fetch standings
          let standings = await getCachedData(getCacheKey(seasonLeagueKey, season, 'standings'));
          const fromCache = !!standings;
          if (!standings) {
            standings = await fetchStandings(seasonLeagueKey);
            await setCachedData(getCacheKey(seasonLeagueKey, season, 'standings'), standings, true);
          }
          // Debug: Log standings data
          console.log(`=== STANDINGS FOR ${season} (${fromCache ? 'from cache' : 'fresh'}) ===`);
          console.log('Number of teams:', standings?.length);
          if (standings && standings[0]) {
            console.log('First team sample:', JSON.stringify(standings[0], null, 2));
          }
          teamsBySeason[season] = standings;

          // Fetch transactions
          setLoadingMessage(`Fetching transactions for ${season}...`);
          let transactions = await getCachedData(getCacheKey(seasonLeagueKey, season, 'transactions'));
          if (!transactions) {
            try {
              transactions = await fetchTransactions(seasonLeagueKey);
              await setCachedData(getCacheKey(seasonLeagueKey, season, 'transactions'), transactions, true);
            } catch (err) {
              console.warn(`Failed to fetch transactions for ${season}:`, err);
              transactions = [];
            }
          }
          transactionsBySeason[season] = transactions;

          // Fetch draft results
          setLoadingMessage(`Fetching draft results for ${season}...`);
          let draftResults = await getCachedData(getCacheKey(seasonLeagueKey, season, 'draftresults'));
          if (!draftResults) {
            try {
              draftResults = await fetchDraftResults(seasonLeagueKey);
              await setCachedData(getCacheKey(seasonLeagueKey, season, 'draftresults'), draftResults, true);
            } catch (err) {
              console.warn(`Failed to fetch draft results for ${season}:`, err);
              draftResults = [];
            }
          }
          draftResultsBySeason[season] = draftResults;

          // Fetch stat categories
          setLoadingMessage(`Fetching stat categories for ${season}...`);
          let statCategories = await getCachedData(getCacheKey(seasonLeagueKey, season, 'statcategories'));
          if (!statCategories) {
            try {
              statCategories = await fetchStatCategories(seasonLeagueKey);
              await setCachedData(getCacheKey(seasonLeagueKey, season, 'statcategories'), statCategories, true);
            } catch (err) {
              console.warn(`Failed to fetch stat categories for ${season}:`, err);
              statCategories = [];
            }
          }
          statCategoriesBySeason[season] = statCategories;

          // Fetch all matchups for the season
          setLoadingMessage(`Fetching matchups for ${season}...`);
          let matchups = await getCachedData(getCacheKey(seasonLeagueKey, season, 'matchups'));
          if (!matchups) {
            try {
              // Fetch matchups for weeks 1-25 (covers regular season + playoffs)
              matchups = await fetchAllMatchups(seasonLeagueKey, 1, 25);
              await setCachedData(getCacheKey(seasonLeagueKey, season, 'matchups'), matchups, true);
            } catch (err) {
              console.warn(`Failed to fetch matchups for ${season}:`, err);
              matchups = [];
            }
          }
          matchupsBySeason[season] = matchups;
        }

        setLoadingMessage('Processing analytics...');

        // Debug: Log all input data
        console.log('=== DATA PROCESSOR INPUT ===');
        console.log('Seasons:', Object.keys(teamsBySeason));
        Object.entries(teamsBySeason).forEach(([season, teams]) => {
          console.log(`Season ${season}: ${(teams as any[])?.length || 0} teams`);
          if ((teams as any[])?.[0]) {
            const t = (teams as any[])[0];
            console.log(`  First team: ${t.name}, W-L: ${t.standings?.wins}-${t.standings?.losses}`);
          }
        });

        // Process all data into GM analytics with optional filter
        const analytics = processGMAnalytics(
          teamsBySeason,
          transactionsBySeason,
          matchupsBySeason,
          draftResultsBySeason,
          statCategoriesBySeason,
          gmUsernameFilter || undefined
        );

        // Debug: Log output
        console.log('=== GM ANALYTICS OUTPUT ===');
        analytics.forEach((gm, key) => {
          console.log(`GM: ${gm.managerName}, W-L-T: ${gm.totalWins}-${gm.totalLosses}-${gm.totalTies}, Rank: ${gm.overallRanking}`);
        });

        setGMAnalytics(analytics);
        setLoadingMessage('');
      } catch (err: any) {
        console.error('Data fetching error:', err);
        let errorMessage = `Failed to fetch data: ${err.message}`;

        if (err.response?.status === 401) {
          errorMessage = 'Authentication expired or insufficient permissions. Please re-authenticate with an account that has access to this league.';
        } else if (err.response?.status === 403) {
          errorMessage = 'Access denied. This appears to be a private league. Make sure you authenticated with a Yahoo account that has access to this league.';
        } else if (err.response?.status === 404) {
          errorMessage = 'League not found. Please check the league ID. If this is a private league, ensure you authenticated with an account that has access.';
        } else if (err.response?.status === 429) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        }

        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    currentLeagueKey,
    currentSeasons,
    gmUsernameFilter,
    isInitialized,
    setLeagueData,
    setGMAnalytics,
    setLoading,
    setLoadingMessage,
    setError,
  ]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Fantasy Basketball GM Analyzer
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Analyze and compare General Manager performances across multiple seasons
          </p>
        </header>

        {error && (
          <ErrorDisplay
            error={error}
            onDismiss={() => useAppStore.getState().setError(null)}
          />
        )}

        {!currentLeagueKey ? (
          <InputForm />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Analyze Different League
                </button>
                <button
                  onClick={async () => {
                    const { clearAuthState, initiateAuth } = await import('@/lib/yahoo-api');
                    clearAuthState();
                    initiateAuth(true);
                  }}
                  className="px-4 py-2 bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-300 dark:hover:bg-orange-700 transition-colors text-sm"
                  title="Switch to a different Yahoo account"
                >
                  Switch Account
                </button>
                <button
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  className="px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors text-sm disabled:opacity-50"
                  title="Clear all cached data to fetch fresh data from Yahoo"
                >
                  {isClearingCache ? 'Clearing...' : 'Clear Cache'}
                </button>
              </div>
              <ExportButton />
            </div>

            {isLoading ? (
              <LoadingSpinner message={loadingMessage} />
            ) : selectedGM ? (
              <GMDetailView />
            ) : (
              <Dashboard />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
