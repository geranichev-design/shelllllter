'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="uk">
      <body style={{ margin: 0, background: '#0a0b0e', fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 72, fontWeight: 700, lineHeight: 1, color: '#ff6b6b', margin: 0 }}>
            500
          </p>
          <h1 style={{ marginTop: 16, fontSize: 22, fontWeight: 600, color: '#f0f2f8' }}>
            Критична помилка
          </h1>
          <p style={{ marginTop: 8, maxWidth: 360, fontSize: 13, color: '#4a5568' }}>
            Додаток не зміг завантажитись. Спробуйте оновити сторінку.
          </p>
          {error.digest && (
            <p style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 11, color: '#4a5568' }}>
              Код помилки: {error.digest}
            </p>
          )}
          <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
            <button
              onClick={reset}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                background: '#ff6b6b',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Спробувати знову
            </button>
            <a
              href="/"
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#f0f2f8',
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              На головну
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
