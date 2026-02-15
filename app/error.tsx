'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '40px', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ color: '#FF3B30' }}>Something went wrong!</h2>
      <pre style={{ color: '#FF3B30', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#fff5f5', padding: '16px', borderRadius: '8px' }}>
        {error.message}
      </pre>
      <details style={{ marginTop: '16px' }}>
        <summary style={{ cursor: 'pointer', color: '#666' }}>Stack trace</summary>
        <pre style={{ color: '#666', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px', marginTop: '8px' }}>
          {error.stack}
        </pre>
      </details>
      <button
        onClick={() => reset()}
        style={{ marginTop: '20px', padding: '10px 20px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  );
}
