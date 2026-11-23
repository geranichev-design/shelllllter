'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getStoredAuth } from '@/lib/auth';
import { Card, ShelterStatusBadge, Table } from '@repo/ui';

type PendingShelter = {
  id: string;
  name: string;
  type: string;
  accessType: string;
  capacity: number;
  latitude: number;
  longitude: number;
  sourceRequestId: string | null;
};

export default function PendingVerificationPage() {
  const [items, setItems] = useState<PendingShelter[]>([]);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedRole = getStoredAuth()?.user.role ?? '';
    setRole(storedRole);

    if (storedRole !== 'DSNS') {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const data = await apiFetch<PendingShelter[]>('/shelters/pending-verification');
        setItems(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Помилка завантаження укриттів');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns = [
    { key: 'name', header: 'Назва', cell: (row: PendingShelter) => row.name },
    { key: 'type', header: 'Тип', cell: (row: PendingShelter) => row.type },
    { key: 'accessType', header: 'Тип доступу', cell: (row: PendingShelter) => row.accessType },
    { key: 'capacity', header: 'Місткість', cell: (row: PendingShelter) => row.capacity },
    {
      key: 'location',
      header: 'Координати',
      cell: (row: PendingShelter) => `${row.latitude}, ${row.longitude}`
    },
    {
      key: 'sourceRequestId',
      header: 'ID заявки',
      cell: (row: PendingShelter) => row.sourceRequestId ?? '-'
    },
    {
      key: 'status',
      header: 'Статус',
      cell: () => <ShelterStatusBadge status="NEED" />
    }
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#f0f2f8]">Потребують підтвердження</h1>
          <p className="mt-2 text-[#8892a4]">Укриття у стані «Потреба», які ще не переведені далі по життєвому циклу.</p>
        </div>
        <Link className="text-sm font-medium text-[var(--accent)] underline" href="/dashboard">
          Дашборд
        </Link>
      </div>

      {role !== 'DSNS' ? (
        <p className="mb-4 rounded-md bg-amber-900/30 px-3 py-2 text-sm text-amber-400">
          Ця сторінка призначена для користувачів ДСНС.
        </p>
      ) : null}

      {error ? <p className="mb-4 rounded-md bg-rose-900/30 px-3 py-2 text-sm text-rose-400">{error}</p> : null}
      {loading ? <p className="text-sm text-[#8892a4]">Завантаження...</p> : null}

      <Card padding="none">
        <Table
          data={items}
          columns={columns}
          keyExtractor={(row) => row.id}
          loading={loading}
          emptyMessage="Немає укриттів на перевірці"
        />
      </Card>
    </main>
  );
}
