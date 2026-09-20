import { getUser } from "@/lib/session";
import { BoardClient } from "@/app/board/board-client";
import { loadBoardData } from "@/app/board/board-data";
import { BoardSkeleton } from "@/components/skeletons";
import { Suspense } from "react";

export const metadata = { title: "Pipeline | Inbox CRM" };

export const dynamic = "force-dynamic";

async function BoardContent({ userId }: { userId: string }) {
  const data = await loadBoardData(userId);
  const { deals, userData, factCount, staleDeals, staleDays } = data;

  const serializable = deals.map((deal) => ({
    id: deal.id,
    title: deal.title,
    stage: deal.stage,
    whyInPipeline: deal.whyInPipeline,
    value: deal.value,
    wonAt: deal.wonAt?.toISOString() ?? null,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
    contact: {
      name: deal.contact.name,
      email: deal.contact.email,
      lastContact: deal.contact.lastContact?.toISOString() ?? null,
    },
    latestEmail: deal.contact.emails[0]
      ? {
          subject: deal.contact.emails[0].subject,
          fromAddr: deal.contact.emails[0].fromAddr,
          receivedAt: deal.contact.emails[0].receivedAt.toISOString(),
        }
      : null,
  }));

  return (
    <BoardClient
      userEmail={userData?.email ?? ""}
      gmailSyncStartedAt={userData?.gmailSyncStartedAt?.toISOString() ?? null}
      factCount={factCount}
      deals={serializable}
      staleCount={staleDeals.length}
      staleDays={staleDays}
    />
  );
}

export default async function BoardPage() {
  const user = await getUser();
  if (!user) return null;

  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardContent userId={user.id} />
    </Suspense>
  );
}