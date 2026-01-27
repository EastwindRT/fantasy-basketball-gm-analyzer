'use client';

/**
 * Account Switcher Component
 * 
 * Allows users to switch between Yahoo accounts or re-authenticate
 */

import { useState } from 'react';
import { getAuthState, clearAuthState, initiateAuth } from '@/lib/yahoo-api';

export default function AccountSwitcher() {
  const [isClearing, setIsClearing] = useState(false);
  const authState = getAuthState();

  const handleSwitchAccount = () => {
    if (window.confirm(
      'This will log you out and allow you to authenticate with a different Yahoo account.\n\n' +
      'You will be taken to Yahoo\'s login page where you can:\n' +
      '1. Log out of your current Yahoo account (if needed)\n' +
      '2. Log in with a different account\n\n' +
      'Click OK to continue.'
    )) {
      setIsClearing(true);
      clearAuthState();
      
      // Small delay to show feedback, then initiate new auth with forceLogin=true
      setTimeout(() => {
        setIsClearing(false);
        initiateAuth(true); // Force login screen to appear
      }, 500);
    }
  };

  const handleReAuthenticate = () => {
    if (window.confirm(
      'This will log you out. You can then authenticate again with the same or different account.\n\n' +
      'Use this if you need to switch to an account that has access to a private league.'
    )) {
      setIsClearing(true);
      clearAuthState();
      
      setTimeout(() => {
        setIsClearing(false);
        window.location.reload();
      }, 500);
    }
  };

  if (!authState.accessToken) {
    return null; // Don't show if not authenticated
  }

  return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
        Account Management
      </h3>
      <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
        Need to access a private league with a different Yahoo account? Switch accounts below.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleSwitchAccount}
          disabled={isClearing}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm"
        >
          {isClearing ? 'Switching...' : 'Switch Yahoo Account'}
        </button>
        <button
          onClick={handleReAuthenticate}
          disabled={isClearing}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 transition-colors text-sm"
        >
          {isClearing ? 'Logging out...' : 'Log Out & Re-authenticate'}
        </button>
      </div>
      <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
        💡 <strong>Tip:</strong> When you switch accounts, make sure to log in with the Yahoo account 
        that is a member of the private league you want to analyze.
      </p>
    </div>
  );
}

