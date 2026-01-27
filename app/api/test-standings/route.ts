/**
 * Test endpoint to see raw Yahoo standings response
 */
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const YAHOO_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const leagueKey = searchParams.get('league') || '466.l.10624';
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  try {
    const response = await axios.get(
      `${YAHOO_API_BASE}/leagues;league_keys=${leagueKey}/standings?format=json`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    // Return the raw response for analysis
    return NextResponse.json({
      leagueKey,
      rawResponse: response.data,
      // Extract key parts for easier viewing
      analysis: {
        hasFantasyContent: !!response.data?.fantasy_content,
        leagueKeys: Object.keys(response.data?.fantasy_content?.leagues?.[0]?.league || {}),
        leagueIsArray: Array.isArray(response.data?.fantasy_content?.leagues?.[0]?.league),
        firstTeamSample: getFirstTeam(response.data),
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      response: error.response?.data,
    }, { status: 500 });
  }
}

function getFirstTeam(data: any): any {
  try {
    const league = data?.fantasy_content?.leagues?.[0]?.league;
    const leagueData = Array.isArray(league) ? league : [league];
    const standings = leagueData[1]?.standings?.[0]?.teams;
    if (!standings) return null;
    const firstTeamKey = Object.keys(standings).find(k => k !== 'count');
    return firstTeamKey ? standings[firstTeamKey] : null;
  } catch {
    return null;
  }
}
