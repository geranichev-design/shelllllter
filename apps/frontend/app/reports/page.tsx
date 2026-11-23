import { AppShell } from '@/app/components/AppShell';
import { PageHeader, Card, EmptyState } from '@repo/ui';
import { FileBarChart } from 'lucide-react';

export default function ReportsPage() {
  return (
    <AppShell>
      <PageHeader title="Звіти" subtitle="Аналітика / Звіти" />
      <div className="p-6">
        <Card padding="none">
          <EmptyState
            icon={<FileBarChart />}
            title="Звіти в розробці"
            message="Тут будуть звіти по регіонах та типах укриттів"
          />
        </Card>
      </div>
    </AppShell>
  );
}
