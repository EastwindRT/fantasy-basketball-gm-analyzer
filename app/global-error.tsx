'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ padding: '40px', fontFamily: 'monospace' }}>
        <h2>Something went wrong!</h2>
        <pre style={{ color: 'red', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {error.message}
        </pre>
        <pre style={{ color: '#666', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px' }}>
          {error.stack}
        </pre>
        <button onClick={() => reset()} style={{ marginTop: '20px', padding: '10px 20px' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
