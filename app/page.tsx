'use client';

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

// null = landing page, 'live' = current season + schedule, 'historical' = GM analyzer
type ViewMode = null | 'live' | 'historical';
type LiveTab = 'season' | 'schedule';

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
  const [viewMode, setViewMode] = useState<ViewMode>(null);
  const [liveTab, setLiveTab] = useState<LiveTab>('season');

  // Auto-clear cache on version change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const CACHE_VERSION = 'v3-draft-names';
    const currentVersion = localStorage.getItem('app_cache_version');
    if (currentVersion !== CACHE_VERSION) {
      clearCache().then(() => {
        localStorage.setItem('app_cache_version', CACHE_VERSION);
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
      if (storedState) localStorage.removeItem('yahoo_oauth_state');

      exchangeCodeForToken(code)
        .then(() => {
          window.history.replaceState({}, '', '/');
          setError(null);
          // After OAuth, land on live view
          setViewMode('live');
          window.location.reload();
        })
        .catch((err) => {
          setError(`Failed to authenticate: ${err.message || 'Unknown error'}`);
          window.history.replaceState({}, '', '/');
        });
    }

    setIsInitialized(true);
  }, [setError]);

  const handleClearCache = useCallback(async () => {
    setIsClearingCache(true);
    try {
      await clearCache();
      alert('Cache cleared successfully!');
    } catch {
      alert('Failed to clear cache');
    } finally {
      setIsClearingCache(false);
    }
  }, []);

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

  // Fetch historical data when league is set
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

        const mostRecentSeason = currentSeasons[currentSeasons.length - 1];
        const leagueKey = seasonLeagueKeys[mostRecentSeason]
          ? seasonLeagueKeys[mostRecentSeason]
          : buildLeagueKey(currentLeagueKey, mostRecentSeason);

        const leagueData = await fetchOrCache(
          getCacheKey(leagueKey, mostRecentSeason, 'league'),
          () => fetchLeague(leagueKey)
        );
        setLeagueData(leagueData);

        const teamsBySeason: { [season: string]: any[] } = {};
        const transactionsBySeason: { [season: string]: any[] } = {};
        const matchupsBySeason: { [season: string]: MatchupData[] } = {};
        const draftResultsBySeason: { [season: string]: DraftResult[] } = {};
        const statCategoriesBySeason: { [season: string]: Array<{ stat_id: string; name: string; display_name: string }> } = {};
        const leagueSettingsBySeason: { [season: string]: LeagueSettings } = {};

        for (let i = 0; i < currentSeasons.length; i++) {
          const season = currentSeasons[i];
          const seasonLeagueKey = seasonLeagueKeys[season]
            ? seasonLeagueKeys[season]
            : buildLeagueKey(currentLeagueKey, season);

          setLoadingMessage(`Fetching ${season}-${(parseInt(season) + 1).toString().slice(-2)} season (${i + 1}/${currentSeasons.length})...`);

          const [standings, transactions, draftResults, statCategories, settings] = await Promise.all([
            fetchOrCache(getCacheKey(seasonLeagueKey, season, 'standings'), () => fetchStandings(seasonLeagueKey)).catch(() => []),
            fetchOrCache(getCacheKey(seasonLeagueKey, season, 'transactions'), () => fetchTransactions(seasonLeagueKey)).catch(() => []),
            fetchOrCache(getCacheKey(seasonLeagueKey, season, 'draftresults'), () => fetchDraftResults(seasonLeagueKey)).catch(() => []),
            fetchOrCache(getCacheKey(seasonLeagueKey, season, 'statcategories'), () => fetchStatCategories(seasonLeagueKey)).catch(() => []),
            fetchOrCache(getCacheKey(seasonLeagueKey, season, 'leaguesettings'), () => fetchLeagueSettings(seasonLeagueKey)).catch(() => null),
          ]);

          teamsBySeason[season] = standings;
          transactionsBySeason[season] = transactions;
          draftResultsBySeason[season] = draftResults;
          statCategoriesBySeason[season] = statCategories;
          if (settings) leagueSettingsBySeason[season] = settings;

          setLoadingMessage(`Fetching matchups for ${season}-${(parseInt(season) + 1).toString().slice(-2)}...`);
          try {
            const matchups = await fetchOrCache(
              getCacheKey(seasonLeagueKey, season, 'matchups'),
              () => fetchAllMatchups(seasonLeagueKey, 1, 25)
            );
            matchupsBySeason[season] = matchups;
          } catch {
            matchupsBySeason[season] = [];
          }
        }

        setLoadingMessage('Processing analytics...');
        const analytics = processGMAnalytics(
          teamsBySeason, transactionsBySeason, matchupsBySeason,
          draftResultsBySeason, statCategoriesBySeason,
          gmUsernameFilter || undefined, leagueSettingsBySeason
        );
        setGMAnalytics(analytics);
        setLoadingMessage('');
      } catch (err: any) {
        let errorMessage = `Failed to fetch data: ${err.message}`;
        if (err.response?.status === 401) errorMessage = 'Authentication expired. Please re-authenticate.';
        else if (err.response?.status === 403) errorMessage = 'Access denied. Make sure you authenticated with an account that has access.';
        else if (err.response?.status === 404) errorMessage = 'League not found. Please check the league ID.';
        else if (err.response?.status === 429) errorMessage = 'Rate limit exceeded. Please wait and try again.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    currentLeagueKey, currentSeasons, seasonLeagueKeys, gmUsernameFilter,
    isInitialized, setLeagueData, setGMAnalytics, setLoading,
    setLoadingMessage, setError, fetchOrCache,
  ]);

  // ─── Landing Page ───────────────────────────────────────────────────────────
  if (viewMode === null) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
        {/* Logo / Title */}
        <div className="text-center mb-16">
          <div className="text-5xl mb-4">🏆</div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-3">
            Fantasy Basketball
          </h1>
          <p className="text-gray-400 text-lg">
            Your league, your stats, your edge.
          </p>
        </div>

        {/* Two cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
          {/* Live League */}
          <button
            onClick={() => setViewMode('live')}
            className="group relative flex flex-col items-start p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-left cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-5 group-hover:bg-orange-500/30 transition-colors">
              <span className="text-2xl">🏀</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Live League</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Current matchup, standings, and NBA schedule heatmap for this week.
            </p>
            <div className="mt-6 flex items-center gap-1.5 text-orange-400 text-sm font-medium group-hover:gap-2.5 transition-all">
              Open <span>→</span>
            </div>
          </button>

          {/* Historical GM Standings */}
          <button
            onClick={() => setViewMode('historical')}
            className="group relative flex flex-col items-start p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-left cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-5 group-hover:bg-blue-500/30 transition-colors">
              <span className="text-2xl">📊</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Historical GM Standings</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Multi-season performance analytics, head-to-head records, and GOAT rankings.
            </p>
            <div className="mt-6 flex items-center gap-1.5 text-blue-400 text-sm font-medium group-hover:gap-2.5 transition-all">
              Open <span>→</span>
            </div>
          </button>
        </div>
      </main>
    );
  }

  // ─── Shared nav bar (shown in live / historical) ─────────────────────────────
  const NavBar = () => (
    <div className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Back to home */}
        <button
          onClick={() => { setViewMode(null); reset(); }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
        >
          <span className="text-lg">←</span>
          <span className="hidden sm:block">Home</span>
        </button>

        {/* Mode-specific tabs */}
        {viewMode === 'live' && (
          <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
            {([
              { id: 'season' as LiveTab, label: 'My Season', icon: '🏀' },
              { id: 'schedule' as LiveTab, label: 'NBA Schedule', icon: '📅' },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setLiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  liveTab === tab.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {viewMode === 'historical' && (
          <span className="text-sm font-medium text-gray-300">Historical GM Standings</span>
        )}

        {/* Right utilities */}
        {viewMode === 'historical' && currentLeagueKey && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => reset()}
              className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              Change League
            </button>
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40"
            >
              {isClearingCache ? 'Clearing…' : 'Clear Cache'}
            </button>
          </div>
        )}

        {viewMode === 'live' && (
          <div className="w-24" /> /* spacer to keep tabs centred */
        )}
      </div>
    </div>
  );

  // ─── Live League view ────────────────────────────────────────────────────────
  if (viewMode === 'live') {
    return (
      <div className="min-h-screen bg-gray-950">
        <NavBar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          {liveTab === 'season' && <CurrentSeason />}
          {liveTab === 'schedule' && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-1">NBA Schedule Grid</h2>
                <p className="text-gray-400 text-sm">
                  Identify which teams have the best schedule this week — plan your streaming adds and waiver pickups.
                </p>
              </div>
              <ScheduleGrid />
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Historical GM Standings view ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 py-8">
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
            {/* Utility bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Analyze Different League
                </button>
                <button
                  onClick={async () => {
                    const { clearAuthState, initiateAuth } = await import('@/lib/yahoo-api');
                    clearAuthState();
                    initiateAuth(true);
                  }}
                  className="px-4 py-2 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors text-sm"
                >
                  Switch Account
                </button>
                <button
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  className="px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors text-sm disabled:opacity-50"
                >
                  {isClearingCache ? 'Clearing…' : 'Clear Cache'}
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
    </div>
  );
}
