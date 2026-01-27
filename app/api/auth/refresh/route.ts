/**
 * Server-side Token Refresh Route
 *
 * Handles OAuth token refresh securely on the server side,
 * keeping the client_secret out of client-side code.
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const YAHOO_TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Missing refresh token' },
        { status: 400 }
      );
    }

    const clientId = process.env.YAHOO_CLIENT_ID || process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID;
    const clientSecret = process.env.YAHOO_CLIENT_SECRET || process.env.NEXT_PUBLIC_YAHOO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing Yahoo API credentials');
      return NextResponse.json(
        { error: 'Server configuration error: Missing API credentials' },
        { status: 500 }
      );
    }

    const response = await axios.post(
      YAHOO_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const expiresAt = Date.now() + (response.data.expires_in * 1000);

    return NextResponse.json({
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token || refreshToken,
      expires_in: response.data.expires_in,
      expires_at: expiresAt,
    });
  } catch (error: any) {
    console.error('Token refresh error:', error.response?.data || error.message);

    const status = error.response?.status || 500;
    const message = error.response?.data?.error_description ||
                   error.response?.data?.error ||
                   'Failed to refresh token';

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
