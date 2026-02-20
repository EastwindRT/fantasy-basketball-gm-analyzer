'use client';

/**
 * Main Page Component
 *
 * Orchestrates the entire application flow:
 * - Input form for league ID and seasons
 * - Data fetching and processing (with parallel fetches for efficiency)
 * - Dashboard and GM detail views
 * - Error handling and loading states
 */

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { getAuthState, isTokenExpired, exchangeCodeForToken } from '@/lib/yahoo-api';
import {
  fetchLeague,
  fetchStandings,
  fetchTransactions,
  fetchDraftResults,
  fetchAllMatchups,
  fetchStatCategories,
  fetchLeagueSettings,
  buildLeagueKey,
  MatchupData,
  DraftResult,
  LeagueSettings,
} from '@/lib/yahoo-api';
import { getCachedData, setCachedData, getCacheKey, clearCache } from '@/lib/data-cache';
import { processGMAnalytics } from '@/lib/data-processor';
import InputForm from '@/components/InputForm';
import Dashboard from '@/components/Dashboard';
import GMDetailView from '@/components/GMDetailView';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorDisplay from '@/components/ErrorDisplay';
import ExportButton from '@/components/ExportButton';
import CurrentSeason from '@/components/CurrentSeason';
import ScheduleGrid from '@/components/ScheduleGrid';

type ViewMode = 'historical' | 'current' | 'schedule';

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
  const [viewMode, setViewMode] = useState<ViewMode>('historical');

  // Auto-clear cache when app version changes (forces fresh data with new features like playoff stats)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const CACHE_VERSION = 'v3-draft-names';
    const currentVersion = localStorage.getItem('app_cache_version');
    if (currentVersion !== CACHE_VERSION) {
      clearCache().then(() => {
        localStorage.setItem('app_cache_version', CACHE_VERSION);
        console.log('Cache auto-cleared for new version:', CACHE_VERSION);
      }).catch(() => {});
    }
  }, []);

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
  const handleClearCache = useCallback(async () => {
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
  }, []);

  // Helper: fetch or get cached data
  const fetchOrCache = useCallback(async (
    cacheKey: string,
    fetcher: () => Promise<any>,
    isHistorical: boolean = true
  ): Promise<any> => {
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;
    const data = await fetcher();
    await setCachedData(cacheKey, data, isHistorical);
    return data;
  }, []);

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

        // Fetch league info using the most recent season's key
        // Use the season-specific key directly if available (already complete from discovery)
        const mostRecentSeason = currentSeasons[currentSeasons.length - 1];
        const leagueKey = seasonLeagueKeys[mostRecentSeason]
          ? seasonLeagueKeys[mostRecentSeason]
          : buildLeagueKey(currentLeagueKey, mostRecentSeason);

        const leagueData = await fetchOrCache(
          getCacheKey(leagueKey, mostRecentSeason, 'league'),
          () => fetchLeague(leagueKey)
        );
        setLeagueData(leagueData);

        // Data structures to collect across seasons
        const teamsBySeason: { [season: string]: any[] } = {};
        const transactionsBySeason: { [season: string]: any[] } = {};
        const matchupsBySeason: { [season: string]: MatchupData[] } = {};
        const draftResultsBySeason: { [season: string]: DraftResult[] } = {};
        const statCategoriesBySeason: { [season: string]: Array<{ stat_id: string; name: string; display_name: string }> } = {};
        const leagueSettingsBySeason: { [season: string]: LeagueSettings } = {};

        for (let i = 0; i < currentSeasons.length; i++) {
          const season = currentSeasons[i];
          // If seasonLeagueKeys has an entry for this season, it's already a complete key
          // from league discovery (e.g., "454.l.12345") — use it directly.
          // Only call buildLeagueKey when falling back to the base league key.
          const seasonLeagueKey = seasonLeagueKeys[season]
            ? seasonLeagueKeys[season]
            : buildLeagueKey(currentLeagueKey, season);

          setLoadingMessage(`Fetching data for ${season}-${(parseInt(season) + 1).toString().slice(-2)} season (${i + 1}/${currentSeasons.length})...`);

          // Fetch standings, transactions, draft results, stat categories, and league settings in PARALLEL
          const [standings, transactions, draftResults, statCategories, settings] = await Promise.all([
            fetchOrCache(
              getCacheKey(seasonLeagueKey, season, 'standings'),
              () => fetchStandings(seasonLeagueKey)
            ).catch(err => { console.warn(`Failed to fetch standings for ${season}:`, err); return []; }),

            fetchOrCache(
              getCacheKey(seasonLeagueKey, season, 'transactions'),
              () => fetchTransactions(seasonLeagueKey)
            ).catch(err => { console.warn(`Failed to fetch transactions for ${season}:`, err); return []; }),

            fetchOrCache(
              getCacheKey(seasonLeagueKey, season, 'draftresults'),
              () => fetchDraftResults(seasonLeagueKey)
            ).catch(err => { console.warn(`Failed to fetch draft results for ${season}:`, err); return []; }),

            fetchOrCache(
              getCacheKey(seasonLeagueKey, season, 'statcategories'),
              () => fetchStatCategories(seasonLeagueKey)
            ).catch(err => { console.warn(`Failed to fetch stat categories for ${season}:`, err); return []; }),

            fetchOrCache(
              getCacheKey(seasonLeagueKey, season, 'leaguesettings'),
              () => fetchLeagueSettings(seasonLeagueKey)
            ).catch(err => { console.warn(`Failed to fetch league settings for ${season}:`, err); return null; }),
          ]);

          teamsBySeason[season] = standings;
          transactionsBySeason[season] = transactions;
          draftResultsBySeason[season] = draftResults;
          statCategoriesBySeason[season] = statCategories;
          if (settings) leagueSettingsBySeason[season] = settings;

          // Fetch matchups (these are sequential per week but we cache the whole batch)
          setLoadingMessage(`Fetching matchups for ${season}-${(parseInt(season) + 1).toString().slice(-2)}...`);
          let matchups: MatchupData[] = [];
          try {
            matchups = await fetchOrCache(
              getCacheKey(seasonLeagueKey, season, 'matchups'),
              () => fetchAllMatchups(seasonLeagueKey, 1, 25)
            );
          } catch (err) {
            console.warn(`Failed to fetch matchups for ${season}:`, err);
          }
          matchupsBySeason[season] = matchups;
        }

        setLoadingMessage('Processing analytics...');

        // Process all data into GM analytics
        const analytics = processGMAnalytics(
          teamsBySeason,
          transactionsBySeason,
          matchupsBySeason,
          draftResultsBySeason,
          statCategoriesBySeason,
          gmUsernameFilter || undefined,
          leagueSettingsBySeason
        );

        setGMAnalytics(analytics);
        setLoadingMessage('');
      } catch (err: any) {
        console.error('Data fetching error:', err);
        let errorMessage = `Failed to fetch data: ${err.message}`;

        if (err.response?.status === 401) {
          errorMessage = 'Authentication expired or insufficient permissions. Please re-authenticate.';
        } else if (err.response?.status === 403) {
          errorMessage = 'Access denied. This appears to be a private league. Make sure you authenticated with an account that has access.';
        } else if (err.response?.status === 404) {
          errorMessage = 'League not found. Please check the league ID.';
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
    seasonLeagueKeys,
    gmUsernameFilter,
    isInitialized,
    setLeagueData,
    setGMAnalytics,
    setLoading,
    setLoadingMessage,
    setError,
    fetchOrCache,
  ]);

  const NAV_TABS: { id: ViewMode; label: string; icon: string }[] = [
    { id: 'historical', label: 'Historical Analysis', icon: '📊' },
    { id: 'current', label: 'Current Season', icon: '🏀' },
    { id: 'schedule', label: 'NBA Schedule', icon: '📅' },
  ];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ── Top Navigation ── */}
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between gap-4 h-14">
            {/* Brand */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xl">🏆</span>
              <span className="font-bold text-gray-900 dark:text-white text-sm hidden sm:block">Fantasy GM</span>
            </div>

            {/* Nav tabs */}
            <nav className="flex items-center gap-1">
              {NAV_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    viewMode === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="hidden md:block">{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Right-side actions (only in historical mode) */}
            {viewMode === 'historical' && currentLeagueKey && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={reset}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-medium"
                >
                  Change League
                </button>
                <button
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  className="px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-xs font-medium disabled:opacity-50"
                >
                  {isClearingCache ? 'Clearing...' : 'Clear Cache'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Page Content ── */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Historical Analysis */}
        {viewMode === 'historical' && (
          <>
            <header className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                GM Historical Analyzer
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
          </>
        )}

        {/* Current Season */}
        {viewMode === 'current' && (
          <>
            <header className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Current Season
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Live standings and current matchup for your active Yahoo league
              </p>
            </header>
            <CurrentSeason />
          </>
        )}

        {/* NBA Schedule Heatmap */}
        {viewMode === 'schedule' && (
          <>
            <header className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                NBA Schedule Grid
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Which teams play the most this week? Select a date range to plan your waiver pickups and streaming adds.
              </p>
            </header>
            <ScheduleGrid />
          </>
        )}
      </div>
    </main>
  );
}
