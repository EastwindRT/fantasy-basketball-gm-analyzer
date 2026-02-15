'use client';

import { useState } from 'react';

interface PasswordGateProps {
  onAuthenticated: (token: string) => void;
}

export default function PasswordGate({ onAuthenticated }: PasswordGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError('Invalid password');
        setLoading(false);
        return;
      }

      const { token } = await res.json();
      sessionStorage.setItem('admin_token', token);
      onAuthenticated(token);
    } catch {
      setError('Connection error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] p-4">
      <div className="bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-white/10 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 flex items-center justify-center">
            <svg className="w-7 h-7 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-[20px] font-bold text-gray-900 dark:text-white">Admin Access</h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">Enter password to manage settings</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-[#2c2c2e] border border-gray-200 dark:border-white/10 text-[15px] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
          />
          {error && (
            <p className="text-[13px] text-[var(--color-danger)] text-center font-medium">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-white text-[15px] font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? 'Verifying...' : 'Unlock'}
          </button>
        </form>

        <a href="/" className="block text-center mt-4 text-[13px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
