/**
 * Global State Management using Zustand
 */

import { create } from 'zustand';
import { GMAnalytics } from './data-processor';
import { LeagueData } from './yahoo-api';

interface AppState {
  // Authentication
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;

  // League data - supports different league IDs per season
  currentLeagueKey: string | null; // Default league key (for backwards compatibility)
  seasonLeagueKeys: { [season: string]: string }; // League key per season
  currentSeasons: string[];
  gmUsernameFilter: string | null;
  leagueData: LeagueData | null;
  setLeagueData: (data: LeagueData | null) => void;
  setCurrentLeague: (leagueKey: string, seasons: string[], gmUsername?: string, seasonKeys?: { [season: string]: string }) => void;

  // GM Analytics
  gmAnalytics: Map<string, GMAnalytics> | null;
  setGMAnalytics: (analytics: Map<string, GMAnalytics> | null) => void;
  selectedGM: string | null;
  setSelectedGM: (managerId: string | null) => void;

  // Loading states
  isLoading: boolean;
  setLoading: (value: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;

  // Error handling
  error: string | null;
  setError: (error: string | null) => void;

  // Reset state
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  setAuthenticated: (value) => set({ isAuthenticated: value }),

  currentLeagueKey: null,
  seasonLeagueKeys: {},
  currentSeasons: [],
  gmUsernameFilter: null,
  leagueData: null,
  setLeagueData: (data) => set({ leagueData: data }),
  setCurrentLeague: (leagueKey, seasons, gmUsername, seasonKeys) =>
    set({
      currentLeagueKey: leagueKey,
      currentSeasons: seasons,
      gmUsernameFilter: gmUsername || null,
      seasonLeagueKeys: seasonKeys || {},
    }),

  gmAnalytics: null,
  setGMAnalytics: (analytics) => set({ gmAnalytics: analytics }),
  selectedGM: null,
  setSelectedGM: (managerId) => set({ selectedGM: managerId }),

  isLoading: false,
  setLoading: (value) => set({ isLoading: value }),
  loadingMessage: '',
  setLoadingMessage: (message) => set({ loadingMessage: message }),

  error: null,
  setError: (error) => set({ error }),

  reset: () =>
    set({
      currentLeagueKey: null,
      seasonLeagueKeys: {},
      currentSeasons: [],
      gmUsernameFilter: null,
      leagueData: null,
      gmAnalytics: null,
      selectedGM: null,
      isLoading: false,
      loadingMessage: '',
      error: null,
    }),
}));
