import { getUser } from "@/lib/session";
import { BoardClient } from "@/app/board/board-client";
import { loadBoardData } from "@/app/board/board-data";

export const metadata = { title: "Pipeline | Inbox CRM" };

// Per-user data — never prerender at build time (needs request DB access).
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const user = await getUser();
  if (!user) return null; // middleware handles redirect

  // Bounded: a stalled DB rejects to error.tsx (retry) instead of holding
  // Suspense open until the platform closes the stream (React #412).
  const [deals, userData, factCount, staleDeals] = await loadBoardData(user.id).then(
    (d) => [d.deals, d.userData, d.factCount, d.staleDeals] as const,
  );

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
    />
  );
}