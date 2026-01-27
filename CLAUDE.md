# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fantasy Basketball GM Analyzer - a Next.js application for analyzing General Manager (GM) performances across Yahoo Fantasy Basketball leagues over multiple seasons.

## Development Commands

```bash
npm run dev          # Start dev server (HTTP, default port 3000)
npm run dev:https    # Start dev server with HTTPS on port 3001
npm run build        # Production build
npm run lint         # ESLint
```

## Environment Setup

Copy `env.example` to `.env.local` and add Yahoo API credentials:
- `NEXT_PUBLIC_YAHOO_CLIENT_ID` - Client ID from Yahoo Developer Console
- `NEXT_PUBLIC_YAHOO_CLIENT_SECRET` - Client Secret from Yahoo Developer Console

Yahoo redirect URI should be set to: `https://localhost:3001/api/auth/callback`

## Current State & Recent Changes

### Working Features
- Yahoo OAuth authentication with account switching
- League discovery (auto-find user's leagues)
- Standings data with wins/losses/ties
- Draft picks display with round/pick info (grouped by season)
- Head-to-head records
- Category dominance charts
- Roster churn stats
- Data caching (IndexedDB with 24hr expiration for historical data)

### Recent Bug Fixes (January 2025)
1. **Stats showing zero** - Fixed falsy value check in `lib/yahoo-api.ts:862-868` that treated `0` wins/losses as missing data. Changed from `?` operator to `!= null` checks.
2. **Standings extraction** - Made code search for `team_standings` in all array positions (Yahoo API structure varies)
3. **Draft Picks** - Changed from "Most Drafted" aggregation to showing individual draft picks with round/pick/season

### Known Issues / TODO

#### Multiple League IDs Per Season
**IMPORTANT**: Yahoo creates a NEW league ID each season when you renew a league. The same league across 4 seasons will have 4 different league IDs.

The app now supports this via:
- `seasonLeagueKeys` in store (`lib/store.ts`) - maps season to league ID
- Checkbox in InputForm: "Different league ID for each season"
- When checked, shows input fields for each season's league ID

**To use**: Enter seasons (e.g., "2022,2023,2024,2025"), check the box, then enter each season's league ID.

**Future improvement needed**: Auto-discover all league IDs from user's league history using:
```
/users;use_login=1/games;game_keys=nba/leagues
```
This returns all leagues across all seasons - could auto-populate the season-specific IDs.

#### Dashboard Improvements Needed
The Dashboard component (`components/Dashboard.tsx`) needs work to be more informative:
- Currently shows basic GM cards with W-L-T record
- Could add: season-by-season breakdown, trend indicators, comparison charts
- GMDetailView has more detail but Dashboard overview is sparse

#### Transaction Stats (Most Added/Traded)
May still show empty if:
- League has no add/drop transactions (auction leagues work differently)
- Transaction data structure varies from expected format
- Debug logging added - check browser console for: `Season XXXX transaction counts - Adds: X, Drops: Y, Trades: Z`

## Architecture

### Data Flow
1. **Authentication**: OAuth 2.0 flow via `/api/auth/callback` and `/api/auth/token` routes
2. **API Proxy**: All Yahoo API calls go through `/api/yahoo/fetch` to avoid CORS issues
3. **Caching**: IndexedDB (with localStorage fallback) caches API responses (1hr regular, 24hr historical)
4. **State**: Zustand store (`lib/store.ts`) manages global app state
5. **Processing**: Raw API data transformed into GM analytics in `lib/data-processor.ts`

### Key Modules

- **`lib/yahoo-api.ts`**: Yahoo OAuth handling, token management, and API wrapper functions
- **`lib/data-processor.ts`**: Transforms raw Yahoo data into `GMAnalytics` objects with rankings, player interactions, roster churn, consistency scores
- **`lib/data-cache.ts`**: IndexedDB caching layer with automatic expiration
- **`lib/store.ts`**: Zustand store for auth state, league data, GM analytics, UI state
  - `seasonLeagueKeys: { [season: string]: string }` - Different league ID per season

### API Routes

- `/api/auth/callback` - OAuth callback handler
- `/api/auth/token` - Server-side token exchange (keeps client_secret secure)
- `/api/yahoo/fetch` - Proxies all Yahoo Fantasy API requests with Bearer token

### Component Structure

- `InputForm` - League ID input, season selection, multiple league IDs option
- `Dashboard` - GM cards ranked by overall performance
- `GMDetailView` - Detailed stats for selected GM
  - `DraftPicksSection` - Shows draft picks with round/pick by season
  - `PlayerInteractionSection` - Most added/dropped/traded players
- `charts/` - Recharts visualizations (RankingTrendChart, CategoryDominanceChart, HeadToHeadHeatmap)

## Yahoo Fantasy API

### League Key Format
Yahoo uses numeric game keys per sport/season, NOT `sport.l.id.year`:
- Correct: `418.l.10624` (game_key 418 = NBA 2022-23 season)
- Wrong: `nba.l.10624.2023`

Game keys are hardcoded in `lib/yahoo-api.ts` (NBA_GAME_KEYS). The `buildLeagueKey()` function converts `nba.l.{id}` + season to the proper format.

### NBA Game Keys (for reference)
```
2025: 466  (2025-26 season)
2024: 454  (2024-25 season)
2023: 428  (2023-24 season)
2022: 418  (2022-23 season)
2021: 410  (2021-22 season)
2020: 402  (2020-21 season)
```

### Dynamic League Discovery
**Always prefer discovering user leagues dynamically** instead of hardcoding league keys:
```
/users;use_login=1/games;game_keys=nba/leagues
```
This returns all NBA leagues the authenticated user belongs to across all seasons.

### Endpoints Used
- `/users;use_login=1/games;game_keys={sport}/leagues` - Discover user's leagues
- `/leagues;league_keys={key}` - League info
- `/leagues;league_keys={key}/standings` - Team standings
- `/leagues;league_keys={key}/transactions` - Adds, drops, trades
- `/leagues;league_keys={key}/scoreboard` - Matchups/scores
- `/leagues;league_keys={key}/draftresults` - Draft picks
- `/leagues;league_keys={key}/settings` - League settings and stat categories

## Path Alias

`@/*` maps to project root (configured in tsconfig.json)

## Debugging Tips

1. **Clear cache** - Use the "Clear Cache" button in the app UI when testing changes
2. **Browser console** - Check F12 console for debug logs:
   - `=== STANDINGS FOR {year} ===` - Shows team count per season
   - `Season XXXX transaction counts` - Shows add/drop/trade counts
   - `Processing X draft results for season YYYY`
3. **API responses** - Server logs show full Yahoo API request/response details
