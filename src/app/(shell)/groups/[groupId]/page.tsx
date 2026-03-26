import { GroupDetailPage } from "@/features/groups/group-detail-page";

export default async function GroupDetailRoute({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  return <GroupDetailPage groupId={groupId} />;
}

