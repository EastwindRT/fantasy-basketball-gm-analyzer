import { NextRequest, NextResponse } from 'next/server';

// NBA team metadata
const NBA_TEAMS: Record<string, { name: string; city: string; conference: 'East' | 'West' }> = {
  ATL: { name: 'Hawks', city: 'Atlanta', conference: 'East' },
  BOS: { name: 'Celtics', city: 'Boston', conference: 'East' },
  BKN: { name: 'Nets', city: 'Brooklyn', conference: 'East' },
  CHA: { name: 'Hornets', city: 'Charlotte', conference: 'East' },
  CHI: { name: 'Bulls', city: 'Chicago', conference: 'East' },
  CLE: { name: 'Cavaliers', city: 'Cleveland', conference: 'East' },
  DAL: { name: 'Mavericks', city: 'Dallas', conference: 'West' },
  DEN: { name: 'Nuggets', city: 'Denver', conference: 'West' },
  DET: { name: 'Pistons', city: 'Detroit', conference: 'East' },
  GSW: { name: 'Warriors', city: 'Golden State', conference: 'West' },
  HOU: { name: 'Rockets', city: 'Houston', conference: 'West' },
  IND: { name: 'Pacers', city: 'Indiana', conference: 'East' },
  LAC: { name: 'Clippers', city: 'LA', conference: 'West' },
  LAL: { name: 'Lakers', city: 'Los Angeles', conference: 'West' },
  MEM: { name: 'Grizzlies', city: 'Memphis', conference: 'West' },
  MIA: { name: 'Heat', city: 'Miami', conference: 'East' },
  MIL: { name: 'Bucks', city: 'Milwaukee', conference: 'East' },
  MIN: { name: 'Timberwolves', city: 'Minnesota', conference: 'West' },
  NOP: { name: 'Pelicans', city: 'New Orleans', conference: 'West' },
  NYK: { name: 'Knicks', city: 'New York', conference: 'East' },
  OKC: { name: 'Thunder', city: 'Oklahoma City', conference: 'West' },
  ORL: { name: 'Magic', city: 'Orlando', conference: 'East' },
  PHI: { name: '76ers', city: 'Philadelphia', conference: 'East' },
  PHX: { name: 'Suns', city: 'Phoenix', conference: 'West' },
  POR: { name: 'Trail Blazers', city: 'Portland', conference: 'West' },
  SAC: { name: 'Kings', city: 'Sacramento', conference: 'West' },
  SAS: { name: 'Spurs', city: 'San Antonio', conference: 'West' },
  TOR: { name: 'Raptors', city: 'Toronto', conference: 'East' },
  UTA: { name: 'Jazz', city: 'Utah', conference: 'West' },
  WAS: { name: 'Wizards', city: 'Washington', conference: 'East' },
};

// In-memory cache to avoid hammering the NBA CDN
let scheduleCache: { data: any; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function getNBASchedule() {
  const now = Date.now();
  if (scheduleCache && now - scheduleCache.fetchedAt < CACHE_TTL_MS) {
    return scheduleCache.data;
  }

  const res = await fetch('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FantasyBBAnalyzer/1.0)',
    },
    next: { revalidate: 21600 }, // Next.js cache: 6 hours
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch NBA schedule: ${res.status}`);
  }

  const data = await res.json();
  scheduleCache = { data, fetchedAt: now };
  return data;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from'); // YYYY-MM-DD
    const daysParam = parseInt(searchParams.get('days') || '7', 10);
    const days = Math.min(Math.max(daysParam, 1), 30); // clamp 1–30

    // Default from = today (ET)
    const fromDate = fromParam ? new Date(fromParam + 'T00:00:00') : new Date();
    fromDate.setHours(0, 0, 0, 0);

    // Build the list of date strings we care about (YYYY-MM-DD)
    const targetDates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(fromDate);
      d.setDate(d.getDate() + i);
      targetDates.push(d.toISOString().slice(0, 10)); // "2025-02-20"
    }
    const targetDateSet = new Set(targetDates);

    const scheduleData = await getNBASchedule();
    const gameDates: any[] = scheduleData?.leagueSchedule?.gameDates ?? [];

    // Build: teamTricode -> { date -> [opponentTricode, ...] }
    const teamGames: Record<string, Record<string, string[]>> = {};

    for (const dateObj of gameDates) {
      // gameDate is like "02/20/2025 00:00:00"
      const rawDate: string = dateObj.gameDate ?? '';
      // Parse MM/DD/YYYY
      const parts = rawDate.split(' ')[0].split('/');
      if (parts.length !== 3) continue;
      const isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      if (!targetDateSet.has(isoDate)) continue;

      for (const game of dateObj.games ?? []) {
        const home: string = game.homeTeam?.teamTricode;
        const away: string = game.awayTeam?.teamTricode;
        if (!home || !away) continue;

        if (!teamGames[home]) teamGames[home] = {};
        if (!teamGames[home][isoDate]) teamGames[home][isoDate] = [];
        teamGames[home][isoDate].push(away);

        if (!teamGames[away]) teamGames[away] = {};
        if (!teamGames[away][isoDate]) teamGames[away][isoDate] = [];
        teamGames[away][isoDate].push(home);
      }
    }

    // Build result for all 30 NBA teams
    const teams = Object.entries(NBA_TEAMS).map(([tricode, meta]) => {
      const games: Record<string, { count: number; opponents: string[] }> = {};
      let total = 0;
      for (const date of targetDates) {
        const opps = teamGames[tricode]?.[date] ?? [];
        games[date] = { count: opps.length, opponents: opps };
        total += opps.length;
      }
      return { tricode, ...meta, games, total };
    });

    // Sort descending by total games
    teams.sort((a, b) => b.total - a.total);

    return NextResponse.json({ teams, dates: targetDates });
  } catch (err: any) {
    console.error('NBA schedule route error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
