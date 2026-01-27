'use client';

/**
 * Helper component with instructions for logging out of Yahoo
 */

export default function YahooLogoutHelper() {
  return (
    <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
      <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">
        Having trouble switching accounts?
      </h3>
      <p className="text-sm text-purple-800 dark:text-purple-300 mb-2">
        If Yahoo keeps logging you in with the same account, try this:
      </p>
      <ol className="text-sm text-purple-800 dark:text-purple-300 list-decimal list-inside space-y-1 mb-3">
        <li>Click "Switch Yahoo Account" button above</li>
        <li>When redirected to Yahoo, look for a "Sign out" or "Use another account" link</li>
        <li>Sign out of your current Yahoo account</li>
        <li>Sign in with the account that has access to your private league</li>
      </ol>
      <p className="text-xs text-purple-700 dark:text-purple-400">
        💡 <strong>Tip:</strong> You can also manually log out of Yahoo at{' '}
        <a 
          href="https://login.yahoo.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline hover:text-purple-900 dark:hover:text-purple-200"
        >
          login.yahoo.com
        </a>
        {' '}before clicking "Switch Account"
      </p>
    </div>
  );
}


