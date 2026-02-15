/**
 * Yahoo League API Route (alternate)
 *
 * Note: The main app uses /api/yahoo/fetch as its proxy.
 * This route exists as a convenience endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const YAHOO_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leagueKey = searchParams.get('leagueKey');
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!leagueKey || !accessToken) {
      return NextResponse.json(
        { error: 'Missing leagueKey or accessToken' },
        { status: 400 }
      );
    }

    const response = await axios.get(
      `${YAHOO_API_BASE}/leagues;league_keys=${leagueKey}?format=json`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('League fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch league data' },
      { status: error.response?.status || 500 }
    );
  }
}
