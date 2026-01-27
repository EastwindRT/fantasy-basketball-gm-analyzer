'use client';

/**
 * Test button to help debug authentication issues
 */

import { initiateAuth, getAuthState } from '@/lib/yahoo-api';
import { useState } from 'react';

export default function AuthTestButton() {
  const [testing, setTesting] = useState(false);
  const authState = getAuthState();
  const clientId = process.env.NEXT_PUBLIC_YAHOO_CLIENT_ID || '';

  const handleTest = () => {
    setTesting(true);
    console.log('=== AUTHENTICATION TEST ===');
    console.log('Client ID configured:', !!clientId);
    console.log('Client ID value:', clientId ? `${clientId.substring(0, 20)}...` : 'NOT SET');
    console.log('Current origin:', window.location.origin);
    console.log('Expected redirect URI:', `${window.location.origin}/api/auth/callback`);
    console.log('Current auth state:', authState);
    
    if (!clientId) {
      alert('ERROR: NEXT_PUBLIC_YAHOO_CLIENT_ID is not set in .env.local\n\nPlease:\n1. Check your .env.local file\n2. Make sure NEXT_PUBLIC_YAHOO_CLIENT_ID is set\n3. Restart the dev server (npm run dev:https)');
      setTesting(false);
      return;
    }

    console.log('Initiating OAuth flow...');
    try {
      initiateAuth();
    } catch (error: any) {
      console.error('Error initiating auth:', error);
      alert(`Error: ${error.message}`);
      setTesting(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h3 className="font-bold mb-2 text-blue-900 dark:text-blue-200">Authentication Test</h3>
      <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
        Click the button below to test the OAuth flow. Check the browser console (F12) for detailed logs.
      </p>
      <button
        onClick={handleTest}
        disabled={testing}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
      >
        {testing ? 'Testing...' : 'Test Authentication Flow'}
      </button>
      {!clientId && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          ⚠️ Client ID not configured. Check your .env.local file.
        </div>
      )}
    </div>
  );
}


