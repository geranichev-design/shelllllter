import ShelterDetailClient from './shelter-detail-client';

export default async function ShelterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShelterDetailClient id={id} />;
}
