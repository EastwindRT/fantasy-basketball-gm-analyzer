/**
 * Token Exchange API Route
 * 
 * Server-side token exchange using yahoo-fantasy package.
 * This keeps client_secret secure and uses the package's better auth handling.
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const YAHOO_TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

export async function POST(request: NextRequest) {
  try {
    const { code, redirectUri } = await request.json();

    // Try to use server-side env vars first, fall back to public for demo
    const clientId = process.env.YAHOO_CLIENT_ID || process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID;
    const clientSecret = process.env.YAHOO_CLIENT_SECRET || process.env.NEXT_PUBLIC_YAHOO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Yahoo API credentials not configured' },
        { status: 500 }
      );
    }

    // Use yahoo-fantasy package if it has auth helpers, otherwise use direct API call
    // The package v4+ may have auth helpers, but we'll use direct call for now
    const response = await axios.post(
      YAHOO_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
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
      refresh_token: response.data.refresh_token,
      expires_at: expiresAt,
      expires_in: response.data.expires_in,
    });
  } catch (error: any) {
    console.error('Token exchange error:', error);
    const errorMessage = error.response?.data?.error_description || 
                         error.response?.data?.error || 
                         error.message || 
                         'Token exchange failed';
    const statusCode = error.response?.status || 500;
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error.response?.data || null,
      },
      { status: statusCode }
    );
  }
}



