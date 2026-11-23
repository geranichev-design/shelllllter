import { RequestDetailClient } from './request-detail-client';

export default async function ShelterRequestDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequestDetailClient id={id} />;
}
