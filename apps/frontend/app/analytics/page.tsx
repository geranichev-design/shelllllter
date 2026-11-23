import { AppShell } from '@/app/components/AppShell';
import { PageHeader, Card, EmptyState } from '@repo/ui';
import { BarChart2 } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <AppShell>
      <PageHeader title="Аналітика" subtitle="Огляд / Аналітика" />
      <div className="p-6">
        <Card padding="none">
          <EmptyState
            icon={<BarChart2 />}
            title="Аналітика в розробці"
            message="Статистика та графіки з'являться в наступній версії"
          />
        </Card>
      </div>
    </AppShell>
  );
}
