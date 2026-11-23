'use client';

import { useEffect } from 'react';

export default function Error({
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0b0e] px-6 text-center">
      <p className="text-[72px] font-bold leading-none text-[var(--color-danger)]">500</p>
      <h1 className="mt-4 text-[22px] font-semibold text-[#f0f2f8]">Помилка сервера</h1>
      <p className="mt-2 max-w-sm text-[13px] text-[#4a5568]">
        Щось пішло не так. Спробуйте оновити сторінку або зверніться до адміністратора.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-[#4a5568]">
          Код помилки: {error.digest}
        </p>
      )}
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded-[var(--radius-md)] bg-[#ff6b6b] px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110"
        >
          Спробувати знову
        </button>
        <a
          href="/dashboard"
          className="rounded-[var(--radius-md)] border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-[#f0f2f8] transition hover:bg-white/[0.08]"
        >
          На дашборд
        </a>
      </div>
    </div>
  );
}
