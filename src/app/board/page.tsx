import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { BoardClient } from "@/app/board/board-client";
import { listStaleDeals } from "@/lib/ai/nudge";

export const metadata = { title: "Pipeline | Inbox CRM" };

export default async function BoardPage() {
  const user = await getUser();
  if (!user) return null; // middleware handles redirect

  const [deals, userData, factCount, staleDeals] = await Promise.all([
    prisma.deal.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        stage: true,
        whyInPipeline: true,
        value: true,
        wonAt: true,
        createdAt: true,
        updatedAt: true,
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            lastContact: true,
            emails: {
              select: { subject: true, fromAddr: true, receivedAt: true },
              orderBy: { receivedAt: "desc" },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
        name: true,
        gmailSyncStartedAt: true,
      },
    }),
    prisma.fact.count({ where: { userId: user.id } }),
    listStaleDeals(user.id, 5),
  ]);

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