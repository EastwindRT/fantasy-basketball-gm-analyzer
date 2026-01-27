/**
 * Yahoo League API Route
 * 
 * Server-side API route using yahoo-fantasy package to fetch league data.
 */

import { NextRequest, NextResponse } from 'next/server';
import YahooFantasy from 'yahoo-fantasy';

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

    const clientId = process.env.YAHOO_CLIENT_ID || process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID || '';
    const clientSecret = process.env.YAHOO_CLIENT_SECRET || process.env.NEXT_PUBLIC_YAHOO_CLIENT_SECRET || '';

    const yf = new YahooFantasy(clientId, clientSecret);
    yf.setUserToken(accessToken);

    const data = await yf.league.meta(leagueKey);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('League fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch league data' },
      { status: 500 }
    );
  }
}




