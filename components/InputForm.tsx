'use client';

/**
 * Input Form Component
 *
 * After authentication, auto-discovers user's leagues and groups them by name
 * across seasons. User clicks a league group to analyze all seasons at once.
 * Also supports manual entry as a fallback.
 */

import { useState, FormEvent, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { initiateAuth, getAuthState, isTokenExpired, fetchUserLeagues } from '@/lib/yahoo-api';
import AccountSwitcher from './AccountSwitcher';

interface LeagueInfo {
  league_key: string;
  name: string;
  season: string;
}

interface LeagueGroup {
  name: string;
  leagues: LeagueInfo[];
  seasons: string[];
}

export default function InputForm() {
  const { setCurrentLeague, setError, setLoading, setLoadingMessage } = useAppStore();

  // Auth state
  const [authState, setAuthState] = useState<{ accessToken: string | null; refreshToken: string | null; expiresAt: number | null }>({ accessToken: null, refreshToken: null, expiresAt: null });
  const [needsAuth, setNeedsAuth] = useState(true);
  const [mounted, setMounted] = useState(false);

  // League discovery
  const [userLeagues, setUserLeagues] = useState<LeagueInfo[]>([]);
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
  const [leaguesLoaded, setLeaguesLoaded] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Selected league group for season picking
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedSeasons, setSelectedSeasons] = useState<Set<string>>(new Set());

  // Manual entry fallback
  const [showManual, setShowManual] = useState(false);
  const [leagueId, setLeagueId] = useState('');
  const [seasons, setSeasons] = useState('');
  const [gmUsername, setGmUsername] = useState('');

  // Check auth on mount
  useEffect(() => {
    setMounted(true);
    const state = getAuthState();
    setAuthState(state);
    setNeedsAuth(!state.accessToken || isTokenExpired());
  }, []);

  // Auto-fetch leagues once authenticated
  useEffect(() => {
    if (!mounted || needsAuth || leaguesLoaded || isLoadingLeagues) return;
    handleFetchLeagues();
  }, [mounted, needsAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFetchLeagues = useCallback(async () => {
    setIsLoadingLeagues(true);
    setDiscoveryError(null);
    try {
      const leagues = await fetchUserLeagues('nba');
      setUserLeagues(leagues);
      setLeaguesLoaded(true);
      if (leagues.length === 0) {
        setDiscoveryError('No NBA leagues found. Try "All Sports" or enter a league ID manually.');
      }
    } catch (err: any) {
      console.error('Failed to fetch leagues:', err);
      setDiscoveryError('Failed to discover leagues. You can enter a league ID manually below.');
      setShowManual(true);
    } finally {
      setIsLoadingLeagues(false);
    }
  }, []);

  const handleFetchAllLeagues = useCallback(async () => {
    setIsLoadingLeagues(true);
    setDiscoveryError(null);
    try {
      const leagues = await fetchUserLeagues('');
      setUserLeagues(leagues);
      setLeaguesLoaded(true);
      if (leagues.length === 0) {
        setDiscoveryError('No leagues found for your account.');
      }
    } catch (err: any) {
      console.error('Failed to fetch leagues:', err);
      setDiscoveryError('Failed to discover leagues.');
    } finally {
      setIsLoadingLeagues(false);
    }
  }, []);

  // Group leagues by name (same league across multiple seasons)
  const leagueGroups = useMemo((): LeagueGroup[] => {
    const groups: Map<string, LeagueGroup> = new Map();

    userLeagues.forEach((league) => {
      // Normalize name for grouping (trim whitespace, case-insensitive match)
      const normalizedName = league.name.trim();

      // Try to find existing group by exact name or close match
      let groupKey = normalizedName;
      for (const [key] of groups) {
        if (key.toLowerCase() === normalizedName.toLowerCase()) {
          groupKey = key;
          break;
        }
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          name: normalizedName,
          leagues: [],
          seasons: [],
        });
      }

      const group = groups.get(groupKey)!;
      group.leagues.push(league);
      if (!group.seasons.includes(league.season)) {
        group.seasons.push(league.season);
      }
    });

    // Sort seasons within each group (newest first for display)
    groups.forEach((group) => {
      group.seasons.sort((a, b) => b.localeCompare(a));
      group.leagues.sort((a, b) => b.season.localeCompare(a.season));
    });

    // Sort groups: most seasons first, then alphabetically
    return Array.from(groups.values()).sort((a, b) => {
      if (b.seasons.length !== a.seasons.length) return b.seasons.length - a.seasons.length;
      return a.name.localeCompare(b.name);
    });
  }, [userLeagues]);

  // Handle clicking a league group — expand to show season picker
  const handleToggleGroup = (group: LeagueGroup) => {
    if (expandedGroup === group.name) {
      setExpandedGroup(null);
      setSelectedSeasons(new Set());
    } else {
      setExpandedGroup(group.name);
      // Default: all seasons selected
      setSelectedSeasons(new Set(group.seasons));
    }
  };

  const toggleSeason = (season: string) => {
    setSelectedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(season)) {
        next.delete(season);
      } else {
        next.add(season);
      }
      return next;
    });
  };

  const selectAllSeasons = (group: LeagueGroup) => {
    setSelectedSeasons(new Set(group.seasons));
  };

  const clearAllSeasons = () => {
    setSelectedSeasons(new Set());
  };

  // Handle analyzing the selected seasons
  const handleAnalyzeGroup = (group: LeagueGroup) => {
    if (selectedSeasons.size === 0) return;

    const chosenSeasons = Array.from(selectedSeasons).sort();
    // Find the most recent chosen season's league as primary
    const sortedLeagues = group.leagues
      .filter((l) => selectedSeasons.has(l.season))
      .sort((a, b) => b.season.localeCompare(a.season));
    const primaryLeague = sortedLeagues[0];

    // Build season-specific league keys
    const seasonKeys: { [season: string]: string } = {};
    group.leagues.forEach((league) => {
      if (selectedSeasons.has(league.season)) {
        seasonKeys[league.season] = league.league_key;
      }
    });

    setCurrentLeague(primaryLeague.league_key, chosenSeasons, undefined, seasonKeys);
    setLoading(true);
    setLoadingMessage('Fetching league data...');
  };

  // Handle manual form submission
  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!authState.accessToken || isTokenExpired()) {
      initiateAuth();
      return;
    }

    let normalizedLeagueId = leagueId.trim();
    if (/^\d+$/.test(normalizedLeagueId)) {
      normalizedLeagueId = `nba.l.${normalizedLeagueId}`;
    }

    if (!/^[a-z0-9]+\.l\.\d+$/i.test(normalizedLeagueId)) {
      setError('Invalid league ID format. Use "nba.l.12345", "428.l.10624", or just "12345".');
      return;
    }

    let seasonList: string[] = [];
    if (seasons.trim()) {
      seasonList = seasons.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      const nbaSeason = currentMonth >= 9 ? currentYear : currentYear - 1;
      seasonList = Array.from({ length: 5 }, (_, i) => (nbaSeason - i).toString());
    }

    setCurrentLeague(normalizedLeagueId, seasonList, gmUsername.trim() || undefined);
    setLoading(true);
    setLoadingMessage('Fetching league data...');
  };

  const handleAuth = () => {
    const shouldForceLogin = window.confirm(
      'Do you want to switch to a different Yahoo account?\n\n' +
      'Click OK to see the login screen.\n' +
      'Click Cancel to use your currently logged-in Yahoo account.'
    );
    initiateAuth(shouldForceLogin);
  };

  if (!mounted) {
    return (
      <div className="w-full max-w-3xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Fantasy Basketball GM Analyzer
        </h2>
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white text-center">
        <h2 className="text-3xl font-bold mb-2">Fantasy Basketball GM Analyzer</h2>
        <p className="text-blue-100">Compare GM performances across multiple seasons</p>
      </div>

      {/* Auth Section */}
      {needsAuth ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Connect Your Yahoo Account
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Sign in with your Yahoo account to automatically discover your fantasy basketball leagues.
            </p>
            <button
              onClick={handleAuth}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              Log In with Yahoo
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              For private leagues, use an account that is a member of the league.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* League Discovery */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Your Leagues
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleFetchLeagues}
                  disabled={isLoadingLeagues}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 transition-colors"
                >
                  {isLoadingLeagues ? 'Loading...' : 'Refresh NBA'}
                </button>
                <button
                  onClick={handleFetchAllLeagues}
                  disabled={isLoadingLeagues}
                  className="px-3 py-1.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 transition-colors"
                >
                  All Sports
                </button>
              </div>
            </div>

            {isLoadingLeagues && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">Discovering your leagues...</span>
              </div>
            )}

            {discoveryError && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
                {discoveryError}
              </div>
            )}

            {!isLoadingLeagues && leagueGroups.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Click a league to select which seasons to analyze.
                </p>
                <div className="grid gap-3">
                  {leagueGroups.map((group) => {
                    const isExpanded = expandedGroup === group.name;
                    return (
                      <div
                        key={group.name}
                        className={`rounded-lg border-2 transition-all ${
                          isExpanded
                            ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                            : 'border-transparent bg-gray-50 dark:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        {/* League header — click to expand/collapse */}
                        <button
                          onClick={() => handleToggleGroup(group)}
                          className="w-full text-left p-4 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className={`font-semibold ${isExpanded ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                                  {group.name}
                                </h4>
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                                  {group.seasons.length} {group.seasons.length === 1 ? 'season' : 'seasons'}
                                </span>
                              </div>
                              {!isExpanded && (
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {group.seasons.map((season) => (
                                    <span
                                      key={season}
                                      className="px-2 py-0.5 text-[10px] font-medium bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded"
                                    >
                                      {season}-{(parseInt(season) + 1).toString().slice(-2)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className={`ml-3 transition-transform ${isExpanded ? 'rotate-90' : ''} text-gray-400 dark:text-gray-500`}>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </button>

                        {/* Expanded: season checkboxes + analyze button */}
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                Select seasons to analyze:
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => selectAllSeasons(group)}
                                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  Select All
                                </button>
                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                <button
                                  onClick={clearAllSeasons}
                                  className="text-[11px] text-gray-500 dark:text-gray-400 hover:underline"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {group.seasons.map((season) => {
                                const isSelected = selectedSeasons.has(season);
                                return (
                                  <button
                                    key={season}
                                    onClick={() => toggleSeason(season)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-lg border-2 transition-all ${
                                      isSelected
                                        ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                                    }`}
                                  >
                                    {season}-{(parseInt(season) + 1).toString().slice(-2)}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => handleAnalyzeGroup(group)}
                              disabled={selectedSeasons.size === 0}
                              className="w-full mt-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                              Analyze {selectedSeasons.size} {selectedSeasons.size === 1 ? 'Season' : 'Seasons'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!isLoadingLeagues && leaguesLoaded && leagueGroups.length === 0 && !discoveryError && (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No leagues found. Try "All Sports" or enter a league ID manually.</p>
              </div>
            )}
          </div>

          {/* Manual Entry Toggle */}
          <div className="text-center">
            <button
              onClick={() => setShowManual(!showManual)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {showManual ? 'Hide manual entry' : 'Or enter a league ID manually'}
            </button>
          </div>

          {/* Manual Entry Form */}
          {showManual && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Manual Entry</h3>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label htmlFor="leagueId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    League ID
                  </label>
                  <input
                    id="leagueId"
                    type="text"
                    value={leagueId}
                    onChange={(e) => setLeagueId(e.target.value)}
                    placeholder="e.g., nba.l.12345 or just 12345"
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="seasons" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Seasons (optional)
                  </label>
                  <input
                    id="seasons"
                    type="text"
                    value={seasons}
                    onChange={(e) => setSeasons(e.target.value)}
                    placeholder="e.g., 2020,2021,2022,2023,2024 (blank = last 5)"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="gmUsername" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    GM Username (optional)
                  </label>
                  <input
                    id="gmUsername"
                    type="text"
                    value={gmUsername}
                    onChange={(e) => setGmUsername(e.target.value)}
                    placeholder="Filter to specific GM"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Analyze League
                </button>
              </form>
            </div>
          )}

          {/* Account Switcher */}
          <AccountSwitcher />
        </>
      )}
    </div>
  );
}
