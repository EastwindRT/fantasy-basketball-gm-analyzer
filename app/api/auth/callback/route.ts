/**
 * OAuth Callback Route
 * 
 * Handles the OAuth callback from Yahoo after user authorization.
 * Exchanges the authorization code for an access token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/yahoo-api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  // NOTE: State verification will be done client-side after redirect
  // Server-side routes don't have access to localStorage

  if (!code) {
    return NextResponse.redirect(
      new URL('/?error=no_code', request.url)
    );
  }

  try {
    // Exchange code for token
    // NOTE: In production, this should be done server-side
    // For now, we'll redirect back to the app with the code
    // The client will handle the token exchange
    return NextResponse.redirect(
      new URL(`/?code=${code}&state=${state}`, request.url)
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent((err as Error).message)}`, request.url)
    );
  }
}

