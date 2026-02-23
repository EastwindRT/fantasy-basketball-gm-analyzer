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
import PlayoffPredictor from '@/components/PlayoffPredictor';

// null = landing page, 'live' = current season + schedule, 'historical' = GM analyzer
type ViewMode = null | 'live' | 'historical';
type LiveTab = 'season' | 'schedule' | 'playoff';

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
  const [liveIsAuthed, setLiveIsAuthed] = useState(false);

  // Track auth state for navbar login/switch button
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('yahoo_access_token');
    const exp = localStorage.getItem('yahoo_expires_at');
    setLiveIsAuthed(!!(token && exp && Date.now() < Number(exp) - 60000));
  }, [viewMode]);

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
      <main className="min-h-screen bg-gray-950 flex flex-col">
        {/* Brand */}
        <div className="flex flex-col items-center pt-16 pb-10 px-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-3xl mb-5">
            🏆
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">TheDraftDay</h1>
          <p className="text-gray-500 text-sm mt-2">Fantasy basketball intelligence</p>
        </div>

        {/* Nav list */}
        <div className="px-4 space-y-3 w-full max-w-sm mx-auto">
          <button
            onClick={() => setViewMode('live')}
            className="w-full flex items-center gap-4 p-5 rounded-2xl bg-orange-500/10 border border-orange-500/20 active:scale-[0.98] transition-all duration-150 text-left"
          >
            <span className="w-11 h-11 rounded-xl bg-orange-500/20 flex items-center justify-center text-2xl shrink-0">🏀</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white">Live League</div>
              <div className="text-gray-400 text-sm mt-0.5">Matchup · standings · schedule</div>
            </div>
            <span className="text-orange-400 text-xl font-light shrink-0">›</span>
          </button>

          <button
            onClick={() => setViewMode('historical')}
            className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 active:scale-[0.98] transition-all duration-150 text-left"
          >
            <span className="w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl shrink-0">📊</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white">GM Analytics</div>
              <div className="text-gray-400 text-sm mt-0.5">Multi-season · H2H · GOAT rankings</div>
            </div>
            <span className="text-gray-600 text-xl font-light shrink-0">›</span>
          </button>
        </div>

        <div className="h-12" />
      </main>
    );
  }

  // ─── Historical nav bar ──────────────────────────────────────────────────────
  const NavBar = () => (
    <div className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <button
          onClick={() => { setViewMode(null); reset(); }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
        >
          <span className="text-lg">←</span>
          <span className="hidden sm:block">Home</span>
        </button>

        <span className="text-sm font-medium text-gray-300">GM Analytics</span>

        {currentLeagueKey ? (
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
        ) : (
          <div className="w-24" />
        )}
      </div>
    </div>
  );

  // ─── Live League view — MetaMask-style bottom nav ─────────────────────────────
  if (viewMode === 'live') {
    const handleLiveAuth = async () => {
      const { initiateAuth, getAuthState, isTokenExpired, clearAuthState } = await import('@/lib/yahoo-api');
      const state = getAuthState();
      if (state.accessToken && !isTokenExpired()) clearAuthState();
      initiateAuth();
    };

    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        {/* Slim fixed top header */}
        <header className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur-xl border-b border-white/[0.07]">
          <div className="h-14 flex items-center justify-between px-4 max-w-2xl mx-auto w-full">
            <button
              onClick={() => { setViewMode(null); reset(); }}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              ←
            </button>
            <span className="font-semibold text-white text-sm">
              {liveTab === 'season' ? 'My Season' : liveTab === 'schedule' ? 'NBA Schedule' : 'Season Outlook'}
            </span>
            <button
              onClick={handleLiveAuth}
              className="h-9 px-3.5 rounded-xl bg-orange-500/15 text-orange-400 text-xs font-semibold hover:bg-orange-500/25 transition-colors shrink-0"
            >
              {liveIsAuthed ? 'Switch' : 'Login'}
            </button>
          </div>
        </header>

        {/* Scrollable content — padded for bottom nav */}
        <div className="flex-1 pb-16">
          <div className="px-4 py-4 max-w-2xl mx-auto">
            {liveTab === 'season' && <CurrentSeason />}
            {liveTab === 'schedule' && (
              <div>
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-white">NBA Schedule</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Best schedule this week — plan your streaming adds.</p>
                </div>
                <ScheduleGrid />
              </div>
            )}
            {liveTab === 'playoff' && <PlayoffPredictor />}
          </div>
        </div>

        {/* Fixed bottom tab bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 bg-gray-950/95 backdrop-blur-xl border-t border-white/[0.07]">
          <div className="grid grid-cols-3 max-w-sm mx-auto">
            {([
              { id: 'season' as LiveTab, icon: '🏀', label: 'My Season' },
              { id: 'schedule' as LiveTab, icon: '📅', label: 'Schedule' },
              { id: 'playoff' as LiveTab, icon: '📊', label: 'Outlook' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setLiveTab(tab.id)}
                className={`flex flex-col items-center justify-center h-16 gap-1 transition-colors active:scale-95 ${
                  liveTab === tab.id ? 'text-orange-400' : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                <span className="text-xl leading-none">{tab.icon}</span>
                <span className="text-[10px] font-semibold tracking-wide uppercase">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    );
  }

  // ─── Historical GM Standings view ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950">
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
