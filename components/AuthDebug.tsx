'use client';

/**
 * Debug component to help troubleshoot authentication issues
 */

import { useEffect, useState } from 'react';
import { getAuthState, isTokenExpired, YahooAuthState } from '@/lib/yahoo-api';

export default function AuthDebug() {
  const [authState, setAuthState] = useState<YahooAuthState>({ accessToken: null, refreshToken: null, expiresAt: null });
  const [expired, setExpired] = useState(true);
  const [hasClientId, setHasClientId] = useState(false);
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only run on client side to avoid hydration errors
    setMounted(true);
    setAuthState(getAuthState());
    setExpired(isTokenExpired());
    setHasClientId(!!process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID);
    setHasClientSecret(!!process.env.NEXT_PUBLIC_YAHOO_CLIENT_SECRET);
    setCurrentOrigin(window.location.origin);
  }, []);

  if (!mounted) {
    return null; // Don't render until mounted to avoid hydration mismatch
  }

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs">
      <h3 className="font-bold mb-2">Auth Debug Info (Dev Only)</h3>
      <div className="space-y-1">
        <div>Client ID configured: {hasClientId ? '✅ Yes' : '❌ No'}</div>
        <div>Client Secret configured: {hasClientSecret ? '✅ Yes' : '❌ No'}</div>
        <div>Current Origin: {currentOrigin}</div>
        <div>Expected Redirect URI: {currentOrigin}/api/auth/callback</div>
        <div>Has Access Token: {authState.accessToken ? '✅ Yes' : '❌ No'}</div>
        <div>Has Refresh Token: {authState.refreshToken ? '✅ Yes' : '❌ No'}</div>
        <div>Token Expired: {expired ? '⚠️ Yes' : '✅ No'}</div>
        {authState.expiresAt && (
          <div>Token Expires: {new Date(authState.expiresAt).toLocaleString()}</div>
        )}
      </div>
      <div className="mt-3 text-yellow-600 dark:text-yellow-400">
        <strong>Important:</strong> Make sure your Yahoo Developer Console redirect URI matches:
        <br />
        <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">
          {currentOrigin}/api/auth/callback
        </code>
      </div>
    </div>
  );
}



