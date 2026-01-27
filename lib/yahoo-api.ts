/**
 * Yahoo Fantasy Sports API Integration
 *
 * This module handles OAuth 2.0 authentication and API calls to Yahoo Fantasy Sports API.
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://developer.yahoo.com/fantasysports/guide/
 * 2. Create a new application to get your Client ID (Consumer Key) and Client Secret
 * 3. Set redirect URI to: http://localhost:3001/api/auth/callback (for local dev)
 * 4. Add your credentials to .env.local file:
 *    YAHOO_CLIENT_ID=your_client_id
 *    YAHOO_CLIENT_SECRET=your_client_secret
 *
 * NOTE: For production, these should be stored securely on a backend server.
 * This implementation uses localStorage for demo purposes only.
 */

import axios from 'axios';

// Yahoo Fantasy Sports API base URLs
const YAHOO_AUTH_URL = 'https://api.login.yahoo.com/oauth2/request_auth';
const YAHOO_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// NBA Game Keys by season (Yahoo assigns a unique game_key per sport per season)
// Format: season year (start year of season) -> game_key
// These are the ACTUAL values from Yahoo's API
const NBA_GAME_KEYS: { [year: string]: string } = {
  '2025': '466',  // 2025-26 season
  '2024': '454',  // 2024-25 season
  '2023': '428',  // 2023-24 season
  '2022': '418',  // 2022-23 season
  '2021': '410',  // 2021-22 season
  '2020': '402',  // 2020-21 season
  '2019': '395',  // 2019-20 season
  '2018': '385',  // 2018-19 season
  '2017': '375',  // 2017-18 season
  '2016': '364',  // 2016-17 season
  '2015': '353',  // 2015-16 season
  '2014': '342',  // 2014-15 season
  '2013': '322',  // 2013-14 season
  '2012': '304',  // 2012-13 season
  '2011': '265',  // 2011-12 season
  '2010': '249',  // 2010-11 season
  '2009': '234',  // 2009-10 season
  '2008': '211',  // 2008-09 season
  '2007': '187',  // 2007-08 season
  '2006': '165',  // 2006-07 season
  '2005': '131',  // 2005-06 season
  '2004': '112',  // 2004-05 season
};

/**
 * Get the Yahoo game key for a given sport and season
 */
export function getGameKey(sport: string, season: string): string | null {
  if (sport.toLowerCase() === 'nba') {
    return NBA_GAME_KEYS[season] || null;
  }
  // Add other sports as needed (nfl, mlb, nhl)
  return null;
}

/**
 * Build a proper league key from sport, league ID, and season
 * Input: "nba.l.10624" or "428.l.10624" or just "10624", season: "2023"
 * Output: "418.l.10624"
 *
 * IMPORTANT: Yahoo game keys are season-specific. 428 = NBA 2024-25, 418 = NBA 2023-24, etc.
 * When querying different seasons, we need to use the correct game key for that season.
 */
export function buildLeagueKey(leagueInput: string, season: string): string {
  // If already a numeric game key format (e.g., "418.l.10624"), extract league ID
  // and rebuild with the correct game key for the requested season
  if (/^\d+\.l\.\d+$/.test(leagueInput)) {
    const match = leagueInput.match(/^(\d+)\.l\.(\d+)$/);
    if (match) {
      const existingGameKey = match[1];
      const leagueId = match[2];

      // Determine which sport this game key belongs to
      // Check if it's an NBA game key by looking it up in our mapping
      const sport = getGameSport(existingGameKey);

      if (sport) {
        const correctGameKey = getGameKey(sport, season);
        if (correctGameKey) {
          console.log(`Converting ${leagueInput} to ${correctGameKey}.l.${leagueId} for season ${season}`);
          return `${correctGameKey}.l.${leagueId}`;
        }
        // Try estimating
        const estimatedKey = estimateGameKey(sport, season);
        if (estimatedKey) {
          console.log(`Estimated: Converting ${leagueInput} to ${estimatedKey}.l.${leagueId} for season ${season}`);
          return `${estimatedKey}.l.${leagueId}`;
        }
      }

      // If we can't determine the sport or find the right key, return as-is
      // (will only work for the original season)
      console.warn(`Cannot convert game key ${existingGameKey} for season ${season}, using as-is`);
      return leagueInput;
    }
  }

  // Parse sport.l.id format (e.g., "nba.l.10624")
  const match = leagueInput.match(/^([a-z]+)\.l\.(\d+)$/i);
  if (match) {
    const sport = match[1];
    const leagueId = match[2];
    const gameKey = getGameKey(sport, season);

    if (gameKey) {
      return `${gameKey}.l.${leagueId}`;
    }
    // Fallback: try to estimate game key for unknown seasons
    console.warn(`Unknown game key for ${sport} season ${season}, attempting to estimate...`);
    const estimatedKey = estimateGameKey(sport, season);
    if (estimatedKey) {
      return `${estimatedKey}.l.${leagueId}`;
    }
    // Last resort: return original format
    return leagueInput;
  }

  // If just a number, assume NBA and build the key
  if (/^\d+$/.test(leagueInput)) {
    const gameKey = getGameKey('nba', season);
    if (gameKey) {
      return `${gameKey}.l.${leagueInput}`;
    }
    // Estimate for unknown season
    const estimatedKey = estimateGameKey('nba', season);
    if (estimatedKey) {
      return `${estimatedKey}.l.${leagueInput}`;
    }
  }

  return leagueInput;
}

/**
 * Determine which sport a numeric game key belongs to
 * Returns the sport code (e.g., 'nba') or null if unknown
 */
function getGameSport(gameKey: string): string | null {
  const key = parseInt(gameKey, 10);

  // NBA game keys (approximate ranges based on known keys)
  // These are rough ranges - NBA keys tend to be in certain ranges
  const nbaKeys = Object.values(NBA_GAME_KEYS).map(k => parseInt(k, 10));
  if (nbaKeys.includes(key)) {
    return 'nba';
  }

  // If the key is in a reasonable range for NBA (300-500 typically)
  // and we don't recognize it, assume NBA
  if (key >= 100 && key < 500) {
    return 'nba';
  }

  return null;
}

/**
 * Estimate game key for seasons not in our hardcoded list
 * Game keys increase by varying amounts per year (roughly 10-26)
 */
function estimateGameKey(sport: string, season: string): string | null {
  if (sport.toLowerCase() !== 'nba') return null;

  const year = parseInt(season, 10);
  if (isNaN(year)) return null;

  // Use 2025 as reference: game key 466
  const referenceYear = 2025;
  const referenceKey = 466;
  const yearDiff = year - referenceYear;

  // Estimate ~12 per year (average of recent years)
  const estimatedKey = referenceKey + (yearDiff * 12);

  // Sanity check: game keys should be positive and reasonable
  if (estimatedKey > 100 && estimatedKey < 700) {
    console.log(`Estimated game key for ${sport} ${season}: ${estimatedKey}`);
    return estimatedKey.toString();
  }

  return null;
}

export interface YahooAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

export interface LeagueData {
  league_key: string;
  league_id: string;
  name: string;
  url: string;
  logo_url: string;
  draft_status: string;
  num_teams: number;
  season: string;
  scoring_type: string;
  league_type: string;
  current_week?: number;
  start_week?: number;
  end_week?: number;
}

export interface TeamData {
  team_key: string;
  team_id: string;
  name: string;
  manager: {
    manager_id: string;
    nickname: string;
    guid: string;
  };
  standings: {
    rank: number;
    wins: number;
    losses: number;
    ties: number;
    points_for: number;
    points_against: number;
  };
}

export interface TransactionData {
  transaction_key: string;
  transaction_id: string;
  type: 'add' | 'drop' | 'trade' | 'commish' | 'waiver' | 'draft';
  status: string;
  timestamp: number;
  players?: Array<{
    player_key: string;
    player_id: string;
    name: {
      full: string;
    };
    transaction_data: {
      type: string;
      source_team_key?: string;
      destination_team_key?: string;
    };
  }>;
}

export interface DraftResult {
  pick: number;
  round: number;
  team_key: string;
  player_key: string;
  player_name: string;
}

export interface MatchupData {
  week: number;
  teams: Array<{
    team_key: string;
    team_name: string;
    points: number;
    stats?: { [category: string]: number };
    win?: boolean;
  }>;
}

/**
 * Get stored auth state from localStorage
 */
export function getAuthState(): YahooAuthState {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null, expiresAt: null };
  }

  const accessToken = localStorage.getItem('yahoo_access_token');
  const refreshToken = localStorage.getItem('yahoo_refresh_token');
  const expiresAt = localStorage.getItem('yahoo_expires_at');

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAt ? parseInt(expiresAt, 10) : null,
  };
}

/**
 * Save auth state to localStorage
 * NOTE: In production, use secure httpOnly cookies on backend
 */
export function saveAuthState(state: YahooAuthState): void {
  if (typeof window === 'undefined') return;

  if (state.accessToken) {
    localStorage.setItem('yahoo_access_token', state.accessToken);
  }
  if (state.refreshToken) {
    localStorage.setItem('yahoo_refresh_token', state.refreshToken);
  }
  if (state.expiresAt) {
    localStorage.setItem('yahoo_expires_at', state.expiresAt.toString());
  }
}

/**
 * Clear auth state
 */
export function clearAuthState(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('yahoo_access_token');
  localStorage.removeItem('yahoo_refresh_token');
  localStorage.removeItem('yahoo_expires_at');
}

/**
 * Check if access token is expired
 */
export function isTokenExpired(): boolean {
  const state = getAuthState();
  if (!state.expiresAt || !state.accessToken) return true;
  // Add 60 second buffer to refresh before actual expiry
  return Date.now() >= (state.expiresAt - 60000);
}

/**
 * Initiate OAuth flow
 * @param forceLogin - If true, forces Yahoo to show login screen even if user is already logged in
 */
export function initiateAuth(forceLogin: boolean = false): void {
  if (typeof window === 'undefined') return;

  const clientId = process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID || '';

  if (!clientId) {
    console.error('Yahoo Client ID not configured. Please set NEXT_PUBLIC_YAHOO_CLIENT_ID in .env.local');
    alert('Yahoo Client ID not configured. Please check your .env.local file and restart the server.');
    return;
  }

  const redirectUri = `${window.location.origin}/api/auth/callback`;
  const state = Math.random().toString(36).substring(7);

  localStorage.setItem('yahoo_oauth_state', state);

  // Build OAuth URL with parameters
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: state,
  });

  // Add prompt=login to force login screen (allows account switching)
  if (forceLogin) {
    params.append('prompt', 'login');
  }

  const authUrl = `${YAHOO_AUTH_URL}?${params.toString()}`;

  console.log('Initiating OAuth flow. Redirect URI:', redirectUri, 'Force login:', forceLogin);
  window.location.href = authUrl;
}

/**
 * Exchange authorization code for access token
 * Uses the API route to keep credentials secure
 */
export async function exchangeCodeForToken(code: string): Promise<YahooAuthState> {
  const redirectUri = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/callback`;

  // Use the API route for token exchange to keep client_secret secure
  try {
    const response = await fetch('/api/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, redirectUri }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMessage = errorData.error || errorData.details?.error || `Token exchange failed: ${response.status}`;
      console.error('Token exchange failed:', {
        status: response.status,
        error: errorData,
      });
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error('No access token received from server');
    }

    const expiresAt = data.expires_at || (Date.now() + (data.expires_in * 1000));

    const authState: YahooAuthState = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };

    saveAuthState(authState);
    return authState;
  } catch (error: any) {
    console.error('Token exchange error:', error);
    throw new Error(error.message || 'Failed to exchange authorization code for token');
  }
}

/**
 * Refresh access token using server-side route
 */
export async function refreshAccessToken(): Promise<YahooAuthState> {
  const state = getAuthState();
  if (!state.refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Token refresh failed:', errorData);
      clearAuthState();
      throw new Error(errorData.error || 'Failed to refresh token');
    }

    const data = await response.json();

    const authState: YahooAuthState = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || state.refreshToken,
      expiresAt: data.expires_at,
    };

    saveAuthState(authState);
    return authState;
  } catch (error: any) {
    console.error('Token refresh error:', error);
    clearAuthState();
    throw error;
  }
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(): Promise<string> {
  if (isTokenExpired()) {
    await refreshAccessToken();
  }

  const state = getAuthState();
  if (!state.accessToken) {
    throw new Error('No access token available. Please authenticate.');
  }

  return state.accessToken;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make authenticated API request with retry logic
 * Uses server-side API route to avoid CORS issues
 */
async function apiRequest(endpoint: string, retryCount: number = 0): Promise<any> {
  const token = await getValidAccessToken();

  if (!token) {
    throw new Error('No access token available. Please authenticate first.');
  }

  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Use Next.js API route to proxy the request (avoids CORS)
  const url = `/api/yahoo/fetch?endpoint=${encodeURIComponent(normalizedEndpoint)}&token=${encodeURIComponent(token)}`;

  console.log('Making API request:', {
    endpoint: normalizedEndpoint,
    hasToken: !!token,
    attempt: retryCount + 1,
  });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    // Handle rate limiting with retry
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = response.headers.get('Retry-After');
      const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : RETRY_DELAY_MS * (retryCount + 1);
      console.log(`Rate limited. Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
      return apiRequest(endpoint, retryCount + 1);
    }

    // Handle transient errors with retry
    if ((response.status >= 500 || response.status === 0) && retryCount < MAX_RETRIES) {
      const delayMs = RETRY_DELAY_MS * (retryCount + 1);
      console.log(`Server error (${response.status}). Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
      return apiRequest(endpoint, retryCount + 1);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

      let errorMessage = errorData.error ||
                        errorData.yahooError?.error?.description ||
                        errorData.yahooError?.error?.message ||
                        errorData.details?.error ||
                        errorData.description ||
                        `API request failed: ${response.status}`;

      console.error('API request error:', {
        endpoint: normalizedEndpoint,
        status: response.status,
        error: errorData,
      });

      if (response.status === 400) {
        if (errorMessage.toLowerCase().includes('invalid league key')) {
          errorMessage += '\n\nThe league key is invalid. Check that:\n- The league ID is correct\n- The season exists\n- You have access to this league';
        }
      }

      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    // Retry on network errors
    if (error.name === 'TypeError' && retryCount < MAX_RETRIES) {
      const delayMs = RETRY_DELAY_MS * (retryCount + 1);
      console.log(`Network error. Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
      return apiRequest(endpoint, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Fetch user's leagues for a specific sport/game
 * This dynamically discovers leagues the authenticated user belongs to
 */
export async function fetchUserLeagues(sport: string = 'nba'): Promise<Array<{ league_key: string; name: string; season: string }>> {
  try {
    // Use game_codes parameter instead of game_keys for sport names
    // If no sport specified, fetch all leagues
    const endpoint = sport
      ? `/users;use_login=1/games;game_codes=${sport}/leagues`
      : `/users;use_login=1/games/leagues`;

    console.log('Fetching user leagues with endpoint:', endpoint);
    const data = await apiRequest(endpoint);

    console.log('User leagues response (full):', JSON.stringify(data, null, 2));

    // Try multiple response structure formats - Yahoo API responses vary
    const leagues: Array<{ league_key: string; name: string; season: string }> = [];

    // Structure 1: users[0].user[1].games
    if (data?.fantasy_content?.users?.[0]?.user?.[1]?.games) {
      const games = data.fantasy_content.users[0].user[1].games;
      console.log('Found games structure:', Object.keys(games));

      Object.entries(games).forEach(([key, game]: [string, any]) => {
        if (key === 'count') return;
        console.log(`Processing game ${key}:`, JSON.stringify(game, null, 2).substring(0, 500));

        if (!game?.game) return;

        // game.game can be array or object
        const gameData = Array.isArray(game.game) ? game.game : [game.game];
        const gameInfo = gameData[0];
        const gameLeagues = gameData[1]?.leagues;

        if (!gameLeagues) {
          console.log(`No leagues found for game ${key}`);
          return;
        }

        Object.entries(gameLeagues).forEach(([lkey, league]: [string, any]) => {
          if (lkey === 'count') return;
          if (!league?.league) return;

          const leagueInfo = Array.isArray(league.league) ? league.league[0] : league.league;
          console.log(`Found league: ${leagueInfo.name} (${leagueInfo.league_key})`);

          leagues.push({
            league_key: leagueInfo.league_key,
            name: leagueInfo.name,
            season: leagueInfo.season || gameInfo?.season,
          });
        });
      });
    }

    // Structure 2: users.user.games (alternate format)
    else if (data?.fantasy_content?.users?.user) {
      console.log('Trying alternate users.user structure');
      const user = data.fantasy_content.users.user;
      const userData = Array.isArray(user) ? user : [user];

      userData.forEach((u: any) => {
        const games = u.games || u[1]?.games;
        if (!games) return;

        Object.entries(games).forEach(([key, game]: [string, any]) => {
          if (key === 'count') return;
          if (!game?.game) return;

          const gameData = Array.isArray(game.game) ? game.game : [game.game];
          const gameInfo = gameData[0];
          const gameLeagues = gameData[1]?.leagues;

          if (!gameLeagues) return;

          Object.entries(gameLeagues).forEach(([lkey, league]: [string, any]) => {
            if (lkey === 'count') return;
            if (!league?.league) return;

            const leagueInfo = Array.isArray(league.league) ? league.league[0] : league.league;
            leagues.push({
              league_key: leagueInfo.league_key,
              name: leagueInfo.name,
              season: leagueInfo.season || gameInfo?.season,
            });
          });
        });
      });
    }

    console.log(`Total leagues found: ${leagues.length}`);

    // If no leagues found with game_codes, try fetching all games
    if (leagues.length === 0) {
      console.log('No leagues found with game_codes, trying all games...');
      return fetchAllUserLeagues(sport);
    }

    return leagues;
  } catch (error) {
    console.error('Failed to fetch user leagues:', error);
    // Fallback to fetching all leagues
    console.log('Error occurred, trying fallback to all leagues...');
    return fetchAllUserLeagues(sport);
  }
}

/**
 * Fallback: Fetch ALL user leagues and filter by sport
 */
async function fetchAllUserLeagues(sport: string): Promise<Array<{ league_key: string; name: string; season: string }>> {
  try {
    const data = await apiRequest(`/users;use_login=1/games/leagues`);
    console.log('All user leagues response:', JSON.stringify(data, null, 2));

    const leagues: Array<{ league_key: string; name: string; season: string }> = [];

    if (!data?.fantasy_content?.users?.[0]?.user?.[1]?.games) {
      console.warn('No games found in all leagues response');
      return [];
    }

    const games = data.fantasy_content.users[0].user[1].games;

    Object.entries(games).forEach(([key, game]: [string, any]) => {
      if (key === 'count') return;
      if (!game?.game) return;

      const gameData = Array.isArray(game.game) ? game.game : [game.game];
      const gameInfo = gameData[0];

      // Filter by sport (game_code) only if sport is specified
      const gameCode = gameInfo?.code || gameInfo?.game_code;
      if (sport && sport.trim() && gameCode && gameCode.toLowerCase() !== sport.toLowerCase()) {
        console.log(`Skipping game with code ${gameCode} (looking for ${sport})`);
        return;
      }
      console.log(`Processing game: ${gameInfo?.name || gameCode || 'unknown'} (${gameInfo?.season || 'unknown season'})`);

      const gameLeagues = gameData[1]?.leagues;
      if (!gameLeagues) return;

      Object.entries(gameLeagues).forEach(([lkey, league]: [string, any]) => {
        if (lkey === 'count') return;
        if (!league?.league) return;

        const leagueInfo = Array.isArray(league.league) ? league.league[0] : league.league;
        console.log(`Found league (all games): ${leagueInfo.name} (${leagueInfo.league_key})`);

        leagues.push({
          league_key: leagueInfo.league_key,
          name: leagueInfo.name,
          season: leagueInfo.season || gameInfo?.season,
        });
      });
    });

    console.log(`Total leagues found (all games): ${leagues.length}`);
    return leagues;
  } catch (error) {
    console.error('Failed to fetch all user leagues:', error);
    return [];
  }
}

/**
 * Fetch league information
 */
export async function fetchLeague(leagueKey: string): Promise<LeagueData> {
  const data = await apiRequest(`/leagues;league_keys=${leagueKey}`);

  // Defensive parsing with detailed logging
  if (!data?.fantasy_content) {
    console.error('fetchLeague: No fantasy_content in response', JSON.stringify(data, null, 2));
    throw new Error('Invalid API response: missing fantasy_content');
  }

  if (!data.fantasy_content.leagues) {
    console.error('fetchLeague: No leagues in response', JSON.stringify(data.fantasy_content, null, 2));
    throw new Error('Invalid API response: missing leagues data. The league key may be invalid.');
  }

  const leaguesData = data.fantasy_content.leagues[0];
  if (!leaguesData?.league) {
    console.error('fetchLeague: No league data in response', JSON.stringify(data.fantasy_content.leagues, null, 2));
    throw new Error('Invalid API response: league data not found');
  }

  const league = Array.isArray(leaguesData.league) ? leaguesData.league[0] : leaguesData.league;

  return {
    league_key: league.league_key,
    league_id: league.league_id,
    name: league.name,
    url: league.url,
    logo_url: league.logo_url || '',
    draft_status: league.draft_status,
    num_teams: parseInt(league.num_teams, 10),
    season: league.season,
    scoring_type: league.scoring_type,
    league_type: league.league_type,
    current_week: league.current_week ? parseInt(league.current_week, 10) : undefined,
    start_week: league.start_week ? parseInt(league.start_week, 10) : undefined,
    end_week: league.end_week ? parseInt(league.end_week, 10) : undefined,
  };
}

/**
 * Fetch league standings
 */
export async function fetchStandings(leagueKey: string): Promise<TeamData[]> {
  const data = await apiRequest(`/leagues;league_keys=${leagueKey}/standings`);

  console.log('=== STANDINGS DEBUG ===');
  console.log('Full response keys:', Object.keys(data || {}));
  console.log('fantasy_content keys:', Object.keys(data?.fantasy_content || {}));

  // Defensive parsing - log structure if unexpected
  if (!data?.fantasy_content?.leagues?.[0]?.league) {
    console.error('Unexpected standings response structure:', JSON.stringify(data, null, 2).substring(0, 2000));
    throw new Error('Invalid standings response structure');
  }

  const leagueData = data.fantasy_content.leagues[0].league;
  console.log('leagueData type:', Array.isArray(leagueData) ? 'array' : typeof leagueData);
  console.log('leagueData length:', Array.isArray(leagueData) ? leagueData.length : 'N/A');

  const standingsData = Array.isArray(leagueData) ? leagueData[1]?.standings : leagueData.standings;
  console.log('standingsData:', JSON.stringify(standingsData, null, 2).substring(0, 1000));

  if (!standingsData?.[0]?.teams) {
    console.error('No teams in standings:', JSON.stringify(standingsData, null, 2).substring(0, 500));
    return [];
  }

  const teams = standingsData[0].teams;
  console.log('First team sample:', JSON.stringify(Object.values(teams)[0], null, 2).substring(0, 1500));
  const result: TeamData[] = [];

  Object.entries(teams).forEach(([key, team]: [string, any]) => {
    if (key === 'count' || !team?.team) return;

    try {
      const teamArray = team.team;
      // Debug: log the full team array structure
      console.log('Team array length:', teamArray?.length);
      console.log('Team[1] contents:', JSON.stringify(teamArray[1], null, 2)?.substring(0, 500));

      // Team data can be in different positions depending on response structure
      // Usually it's an array where [0] contains team info arrays and [1] contains standings
      const teamInfo = teamArray[0];

      // Search for team_standings in all array positions (Yahoo API structure can vary)
      let teamStandings = null;
      if (Array.isArray(teamArray)) {
        for (let i = 0; i < teamArray.length; i++) {
          if (teamArray[i]?.team_standings) {
            teamStandings = teamArray[i].team_standings;
            break;
          }
        }
      }
      console.log('team_standings:', JSON.stringify(teamStandings, null, 2)?.substring(0, 300));

      // Find team_key, team_id, name - they can be in different array positions
      let teamKey = '', teamId = '', teamName = '';
      let managers: any[] = [];

      // Team info is usually an array of objects/arrays
      if (Array.isArray(teamInfo)) {
        teamInfo.forEach((item: any) => {
          if (item?.team_key) teamKey = item.team_key;
          if (item?.team_id) teamId = item.team_id;
          if (item?.name) teamName = item.name;
          if (item?.managers) managers = item.managers;
          // Sometimes it's nested in an array
          if (Array.isArray(item)) {
            item.forEach((subItem: any) => {
              if (subItem?.team_key) teamKey = subItem.team_key;
              if (subItem?.team_id) teamId = subItem.team_id;
              if (subItem?.name) teamName = subItem.name;
              if (subItem?.managers) managers = subItem.managers;
            });
          }
        });
      }

      // Extract manager info
      let managerId = '', managerNickname = '', managerGuid = '';
      if (managers.length > 0) {
        const manager = managers[0]?.manager || managers[0];
        managerId = manager?.manager_id || '';
        managerNickname = manager?.nickname || manager?.name || 'Unknown';
        managerGuid = manager?.guid || '';
      }

      // Extract standings - use != null to handle 0 values correctly (0 is falsy in JS)
      const rank = teamStandings?.rank != null ? parseInt(teamStandings.rank, 10) : 0;
      const wins = teamStandings?.outcome_totals?.wins != null ? parseFloat(teamStandings.outcome_totals.wins) : 0;
      const losses = teamStandings?.outcome_totals?.losses != null ? parseFloat(teamStandings.outcome_totals.losses) : 0;
      const ties = teamStandings?.outcome_totals?.ties != null ? parseFloat(teamStandings.outcome_totals.ties) : 0;
      const pointsFor = teamStandings?.points_for != null ? parseFloat(teamStandings.points_for) : 0;
      const pointsAgainst = teamStandings?.points_against != null ? parseFloat(teamStandings.points_against) : 0;

      if (teamKey) {
        result.push({
          team_key: teamKey,
          team_id: teamId,
          name: teamName || `Team ${teamId}`,
          manager: {
            manager_id: managerId,
            nickname: managerNickname,
            guid: managerGuid,
          },
          standings: {
            rank,
            wins,
            losses,
            ties,
            points_for: pointsFor,
            points_against: pointsAgainst,
          },
        });
      }
    } catch (parseError) {
      console.warn('Failed to parse team:', key, parseError);
      console.log('Team data:', JSON.stringify(team, null, 2).substring(0, 500));
    }
  });

  console.log(`Parsed ${result.length} teams from standings`);
  return result;
}

/**
 * Fetch team rosters
 */
export async function fetchRoster(leagueKey: string, teamKey: string): Promise<any> {
  const data = await apiRequest(`/leagues;league_keys=${leagueKey}/teams;team_keys=${teamKey}/roster`);
  return data;
}

/**
 * Fetch transactions (drafts, trades, adds, drops)
 * Now includes all transaction types by default
 */
export async function fetchTransactions(leagueKey: string, transactionTypes?: string[]): Promise<TransactionData[]> {
  // Include all transaction types if not specified
  const types = transactionTypes || ['add', 'drop', 'trade'];
  let endpoint = `/leagues;league_keys=${leagueKey}/transactions;types=${types.join(',')}`;

  try {
    const data = await apiRequest(endpoint);

    // Defensive parsing
    const leagueData = data?.fantasy_content?.leagues?.[0]?.league;
    if (!leagueData) return [];

    const transactions = Array.isArray(leagueData) ? leagueData[1]?.transactions : leagueData.transactions;
    if (!transactions) return [];

    const result: TransactionData[] = [];

    Object.entries(transactions).forEach(([key, tx]: [string, any]) => {
      if (key === 'count' || !tx?.transaction) return;

      try {
        const txArray = tx.transaction;
        const txData = Array.isArray(txArray) ? txArray[0] : txArray;

        // Extract players if available
        const players: any[] = [];
        const playersData = txData?.players || (Array.isArray(txArray) && txArray[1]?.players);

        if (playersData) {
          Object.entries(playersData).forEach(([pKey, p]: [string, any]) => {
            if (pKey === 'count' || !p?.player) return;
            try {
              const playerArray = p.player;
              const playerInfo = Array.isArray(playerArray[0]) ? playerArray[0] : [playerArray[0]];

              let playerKey = '', playerId = '', playerName = '';
              playerInfo.forEach((item: any) => {
                if (item?.player_key) playerKey = item.player_key;
                if (item?.player_id) playerId = item.player_id;
                if (item?.name?.full) playerName = item.name.full;
              });

              const transactionData = playerArray[1]?.transaction_data || {};

              players.push({
                player_key: playerKey,
                player_id: playerId,
                name: { full: playerName },
                transaction_data: transactionData,
              });
            } catch (e) {
              console.warn('Failed to parse player in transaction:', e);
            }
          });
        }

        result.push({
          transaction_key: txData.transaction_key || '',
          transaction_id: txData.transaction_id || '',
          type: txData.type as TransactionData['type'],
          status: txData.status || '',
          timestamp: parseInt(txData.timestamp || '0', 10),
          players,
        });
      } catch (e) {
        console.warn('Failed to parse transaction:', key, e);
      }
    });

    return result;
  } catch (error) {
    console.warn('Failed to fetch transactions:', error);
    return [];
  }
}

/**
 * Fetch draft results
 */
export async function fetchDraftResults(leagueKey: string): Promise<DraftResult[]> {
  try {
    const data = await apiRequest(`/leagues;league_keys=${leagueKey}/draftresults`);

    // Defensive parsing
    const leagueData = data?.fantasy_content?.leagues?.[0]?.league;
    if (!leagueData) return [];

    const draftResults = Array.isArray(leagueData) ? leagueData[1]?.draft_results : leagueData.draft_results;
    if (!draftResults) return [];

    const result: DraftResult[] = [];

    Object.entries(draftResults).forEach(([key, dr]: [string, any]) => {
      if (key === 'count' || !dr?.draft_result) return;

      try {
        const draftResult = dr.draft_result;
        result.push({
          pick: parseInt(draftResult.pick || '0', 10),
          round: parseInt(draftResult.round || '0', 10),
          team_key: draftResult.team_key || '',
          player_key: draftResult.player_key || '',
          player_name: '', // Will be populated later if needed
        });
      } catch (e) {
        console.warn('Failed to parse draft result:', key, e);
      }
    });

    return result;
  } catch (error) {
    console.warn('Failed to fetch draft results:', error);
    return [];
  }
}

/**
 * Fetch matchups/scores for a specific week
 */
export async function fetchScoreboard(leagueKey: string, week?: number): Promise<MatchupData[]> {
  let endpoint = `/leagues;league_keys=${leagueKey}/scoreboard`;
  if (week) {
    endpoint += `;week=${week}`;
  }

  try {
    const data = await apiRequest(endpoint);
    const scoreboard = data.fantasy_content.leagues[0].league[1].scoreboard;

    if (!scoreboard || !scoreboard[0] || !scoreboard[0].matchups) {
      return [];
    }

    const matchups: MatchupData[] = [];
    const matchupsData = scoreboard[0].matchups;

    Object.values(matchupsData).forEach((m: any) => {
      if (!m.matchup) return;

      const matchup = m.matchup;
      const weekNum = parseInt(matchup[0]?.week || week || '0', 10);
      const teams: MatchupData['teams'] = [];

      // Parse teams in matchup
      if (matchup[0]?.teams) {
        Object.values(matchup[0].teams).forEach((t: any) => {
          if (!t.team) return;

          const teamInfo = t.team[0];
          const teamStats = t.team[1];

          // Parse team stats/categories if available
          const stats: { [category: string]: number } = {};
          if (teamStats?.team_stats?.stats) {
            teamStats.team_stats.stats.forEach((s: any) => {
              if (s.stat) {
                stats[s.stat.stat_id] = parseFloat(s.stat.value || '0');
              }
            });
          }

          // Determine win/loss from team_points or win_probability
          let points = 0;
          let win: boolean | undefined;

          if (teamStats?.team_points?.total) {
            points = parseFloat(teamStats.team_points.total);
          }
          if (teamStats?.team_projected_points?.total) {
            points = points || parseFloat(teamStats.team_projected_points.total);
          }

          teams.push({
            team_key: teamInfo[0]?.team_key,
            team_name: teamInfo[0]?.name || teamInfo[2]?.name,
            points,
            stats: Object.keys(stats).length > 0 ? stats : undefined,
            win,
          });
        });
      }

      if (teams.length === 2) {
        // Determine winner based on points
        if (teams[0].points > teams[1].points) {
          teams[0].win = true;
          teams[1].win = false;
        } else if (teams[1].points > teams[0].points) {
          teams[0].win = false;
          teams[1].win = true;
        }

        matchups.push({ week: weekNum, teams });
      }
    });

    return matchups;
  } catch (error) {
    console.warn('Failed to fetch scoreboard:', error);
    return [];
  }
}

/**
 * Fetch all matchups for a season
 */
export async function fetchAllMatchups(leagueKey: string, startWeek: number = 1, endWeek: number = 20): Promise<MatchupData[]> {
  const allMatchups: MatchupData[] = [];

  for (let week = startWeek; week <= endWeek; week++) {
    try {
      const weekMatchups = await fetchScoreboard(leagueKey, week);
      allMatchups.push(...weekMatchups);
    } catch (error) {
      console.warn(`Failed to fetch matchups for week ${week}:`, error);
      // Continue with other weeks even if one fails
    }
  }

  return allMatchups;
}

/**
 * Fetch league settings
 */
export async function fetchSettings(leagueKey: string): Promise<any> {
  const data = await apiRequest(`/leagues;league_keys=${leagueKey}/settings`);
  return data;
}

/**
 * Fetch league stat categories
 */
export async function fetchStatCategories(leagueKey: string): Promise<Array<{ stat_id: string; name: string; display_name: string }>> {
  try {
    const data = await apiRequest(`/leagues;league_keys=${leagueKey}/settings`);

    // Defensive parsing
    const leagueData = data?.fantasy_content?.leagues?.[0]?.league;
    if (!leagueData) return [];

    const settingsData = Array.isArray(leagueData) ? leagueData[1]?.settings : leagueData.settings;
    if (!settingsData) return [];

    const settings = Array.isArray(settingsData) ? settingsData[0] : settingsData;
    if (!settings?.stat_categories) return [];

    const statCategories = Array.isArray(settings.stat_categories) ? settings.stat_categories[0] : settings.stat_categories;
    if (!statCategories?.stats) return [];

    const result: Array<{ stat_id: string; name: string; display_name: string }> = [];

    const stats = Array.isArray(statCategories.stats) ? statCategories.stats : Object.values(statCategories.stats);

    stats.forEach((s: any) => {
      if (!s?.stat) return;
      result.push({
        stat_id: s.stat.stat_id || '',
        name: s.stat.name || '',
        display_name: s.stat.display_name || '',
      });
    });

    return result;
  } catch (error) {
    console.warn('Failed to fetch stat categories:', error);
    return [];
  }
}
