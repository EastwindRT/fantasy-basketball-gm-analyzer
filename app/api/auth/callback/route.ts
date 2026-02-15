/**
 * OAuth Callback Route
 *
 * Handles the OAuth callback from Yahoo after user authorization.
 */

import { NextRequest, NextResponse } from 'next/server';

function getBaseUrl(request: NextRequest): string {
  // Use forwarded headers (set by reverse proxies like Render, Vercel, etc.)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  // Fallback: use the Host header
  const host = request.headers.get('host');
  if (host && !host.startsWith('localhost')) {
    return `https://${host}`;
  }
  // Last resort: use request.url
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const baseUrl = getBaseUrl(request);

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', baseUrl));
  }

  return NextResponse.redirect(new URL(`/?code=${code}&state=${state}`, baseUrl));
}
