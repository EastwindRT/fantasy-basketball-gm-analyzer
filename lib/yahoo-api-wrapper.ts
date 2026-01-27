/**
 * Yahoo Fantasy Sports API Integration using yahoo-fantasy npm package
 * 
 * This module uses the yahoo-fantasy package (v4+) which handles OAuth better
 * and simplifies API interactions.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://developer.yahoo.com/fantasysports/guide/
 * 2. Create a new application to get your Client ID (Consumer Key) and Client Secret
 * 3. Set redirect URI to: https://localhost:3001/api/auth/callback (for HTTPS local dev)
 * 4. Add your credentials to .env.local file:
 *    NEXT_PUBLIC_YAHOO_CLIENT_ID=your_client_id
 *    NEXT_PUBLIC_YAHOO_CLIENT_SECRET=your_client_secret
 * 
 * NOTE: The yahoo-fantasy package is designed for server-side use.
 * For client-side, we'll use API routes or handle OAuth manually.
 */

import YahooFantasy from 'yahoo-fantasy';

// Re-export types for compatibility
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
  type: 'add' | 'drop' | 'trade' | 'commish' | 'waiver';
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

// OAuth URLs (still needed for client-side auth flow)
const YAHOO_AUTH_URL = 'https://api.login.yahoo.com/oauth2/request_auth';
const YAHOO_TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

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
  return Date.now() >= state.expiresAt;
}

/**
 * Initiate OAuth flow
 */
export function initiateAuth(): void {
  if (typeof window === 'undefined') return;
  
  const clientId = process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID || '';
  const redirectUri = `${window.location.origin}/api/auth/callback`;
  const state = Math.random().toString(36).substring(7);
  
  localStorage.setItem('yahoo_oauth_state', state);
  
  const authUrl = `${YAHOO_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
  
  window.location.href = authUrl;
}

/**
 * Exchange authorization code for access token
 * Uses the yahoo-fantasy package's auth helper if available, otherwise falls back to direct API call
 */
export async function exchangeCodeForToken(code: string): Promise<YahooAuthState> {
  const clientId = process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID || '';
  const clientSecret = process.env.NEXT_PUBLIC_YAHOO_CLIENT_SECRET || '';
  const redirectUri = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/callback`;
  
  // Use yahoo-fantasy package for token exchange (server-side)
  // For client-side, we'll use the API route
  try {
    const response = await fetch('/api/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, redirectUri }),
    });

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }

    const data = await response.json();
    const expiresAt = Date.now() + (data.expires_in * 1000);
    
    const authState: YahooAuthState = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };
    
    saveAuthState(authState);
    return authState;
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
}

/**
 * Create a yahoo-fantasy instance (server-side only)
 * This should be called from API routes
 */
export function createYahooFantasyInstance(accessToken?: string): YahooFantasy {
  const clientId = process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID || process.env.YAHOO_CLIENT_ID || '';
  const clientSecret = process.env.NEXT_PUBLIC_YAHOO_CLIENT_SECRET || process.env.YAHOO_CLIENT_SECRET || '';
  
  const yf = new YahooFantasy(clientId, clientSecret);
  
  if (accessToken) {
    yf.setUserToken(accessToken);
  }
  
  return yf;
}

/**
 * Fetch league information using yahoo-fantasy package
 * This should be called from an API route
 */
export async function fetchLeagueWithYF(leagueKey: string, accessToken: string): Promise<LeagueData> {
  const yf = createYahooFantasyInstance(accessToken);
  const data = await yf.league.meta(leagueKey);
  
  return {
    league_key: data.league_key,
    league_id: data.league_id,
    name: data.name,
    url: data.url || '',
    logo_url: data.logo_url || '',
    draft_status: data.draft_status || '',
    num_teams: parseInt(data.num_teams?.toString() || '0', 10),
    season: data.season || '',
    scoring_type: data.scoring_type || '',
    league_type: data.league_type || '',
  };
}

/**
 * Fetch standings using yahoo-fantasy package
 */
export async function fetchStandingsWithYF(leagueKey: string, accessToken: string): Promise<TeamData[]> {
  const yf = createYahooFantasyInstance(accessToken);
  const data = await yf.league.standings(leagueKey);
  
  return data.teams.map((team: any) => ({
    team_key: team.team_key,
    team_id: team.team_id,
    name: team.name,
    manager: {
      manager_id: team.managers?.[0]?.manager_id || '',
      nickname: team.managers?.[0]?.nickname || '',
      guid: team.managers?.[0]?.guid || '',
    },
    standings: {
      rank: parseInt(team.team_standings?.rank?.toString() || '0', 10),
      wins: parseFloat(team.team_standings?.outcome_totals?.wins?.toString() || '0'),
      losses: parseFloat(team.team_standings?.outcome_totals?.losses?.toString() || '0'),
      ties: parseFloat(team.team_standings?.outcome_totals?.ties?.toString() || '0'),
      points_for: parseFloat(team.team_standings?.points_for?.toString() || '0'),
      points_against: parseFloat(team.team_standings?.points_against?.toString() || '0'),
    },
  }));
}

/**
 * Fetch transactions using yahoo-fantasy package
 */
export async function fetchTransactionsWithYF(leagueKey: string, accessToken: string): Promise<TransactionData[]> {
  const yf = createYahooFantasyInstance(accessToken);
  const data = await yf.league.transactions(leagueKey);
  
  return (data.transactions || []).map((tx: any) => ({
    transaction_key: tx.transaction_key,
    transaction_id: tx.transaction_id,
    type: tx.type as TransactionData['type'],
    status: tx.status,
    timestamp: parseInt(tx.timestamp?.toString() || '0', 10),
    players: tx.players?.map((p: any) => ({
      player_key: p.player_key,
      player_id: p.player_id,
      name: { full: p.name?.full || '' },
      transaction_data: {
        type: p.transaction_data?.type || '',
        source_team_key: p.transaction_data?.source_team_key,
        destination_team_key: p.transaction_data?.destination_team_key,
      },
    })) || [],
  }));
}

/**
 * Fetch scoreboard using yahoo-fantasy package
 */
export async function fetchScoreboardWithYF(leagueKey: string, accessToken: string, week?: number): Promise<any> {
  const yf = createYahooFantasyInstance(accessToken);
  if (week) {
    return await yf.league.scoreboard(leagueKey, week);
  }
  return await yf.league.scoreboard(leagueKey);
}




