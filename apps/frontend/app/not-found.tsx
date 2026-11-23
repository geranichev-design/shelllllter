import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0b0e] px-6 text-center">
      <p className="text-[72px] font-bold leading-none text-[var(--accent)]">404</p>
      <h1 className="mt-4 text-[22px] font-semibold text-[#f0f2f8]">Сторінку не знайдено</h1>
      <p className="mt-2 max-w-sm text-[13px] text-[#4a5568]">
        Можливо, посилання застаріле або сторінку було видалено.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-[var(--color-on-accent)] transition hover:brightness-110"
        >
          На дашборд
        </Link>
        <Link
          href="/shelter-requests"
          className="rounded-[var(--radius-md)] border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-[#f0f2f8] transition hover:bg-white/[0.08]"
        >
          Список заявок
        </Link>
      </div>
    </div>
  );
}
