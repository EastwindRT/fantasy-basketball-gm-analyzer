'use client';

/**
 * Component to show current authentication status
 */

import { useEffect, useState } from 'react';
import { getAuthState, isTokenExpired, YahooAuthState } from '@/lib/yahoo-api';

export default function AuthStatus() {
  const [authState, setAuthState] = useState<YahooAuthState>({ accessToken: null, refreshToken: null, expiresAt: null });
  const [expired, setExpired] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only run on client side to avoid hydration errors
    setMounted(true);
    const updateState = () => {
      const state = getAuthState();
      setAuthState(state);
      setExpired(isTokenExpired());
    };
    
    updateState();
    // Check auth state periodically
    const interval = setInterval(updateState, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return null; // Don't render until mounted to avoid hydration mismatch
  }

  if (authState.accessToken && !expired) {
    return (
      <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="font-semibold text-green-800 dark:text-green-200">Authenticated Successfully!</h3>
            <p className="text-sm text-green-700 dark:text-green-300">
              You are logged in. You can now analyze leagues.
            </p>
            {authState.expiresAt && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Token expires: {new Date(authState.expiresAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

