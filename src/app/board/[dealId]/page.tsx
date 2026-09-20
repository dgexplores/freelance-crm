import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { DealDetailClient } from "./deal-detail-client";
import { DealDetailSkeleton } from "@/components/skeletons";
import { Suspense } from "react";

export const metadata = { title: "Deal | Inbox CRM" };

export const dynamic = "force-dynamic";

async function DealContent({ userId, dealId }: { userId: string; dealId: string }) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, userId },
    include: {
      contact: {
        include: {
          emails: {
            orderBy: { receivedAt: "desc" },
            take: 20,
            select: {
              id: true,
              subject: true,
              body: true,
              direction: true,
              receivedAt: true,
              gmailId: true,
              threadId: true,
            },
          },
          facts: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              claim: true,
              source: true,
              strength: true,
              applied: true,
              createdAt: true,
            },
          },
        },
      },
      tasks: {
        orderBy: { dueAt: "asc" },
        select: {
          id: true,
          kind: true,
          dueAt: true,
          reason: true,
          done: true,
          doneAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!deal) notFound();

  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, rateCard: true },
  });

  const serializableDeal = {
    id: deal.id,
    title: deal.title,
    stage: deal.stage,
    whyInPipeline: deal.whyInPipeline,
    value: deal.value,
    wonAt: deal.wonAt?.toISOString() ?? null,
    lostReason: deal.lostReason,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
    contact: {
      id: deal.contact.id,
      name: deal.contact.name,
      email: deal.contact.email,
      company: deal.contact.company,
      linkedinUrl: deal.contact.linkedinUrl,
      source: deal.contact.source,
      lastContact: deal.contact.lastContact?.toISOString() ?? null,
      emails: deal.contact.emails.map((e) => ({
        id: e.id,
        subject: e.subject,
        body: e.body,
        direction: e.direction,
        receivedAt: e.receivedAt.toISOString(),
        gmailId: e.gmailId,
        threadId: e.threadId,
      })),
      facts: deal.contact.facts.map((f) => ({
        id: f.id,
        claim: f.claim,
        source: f.source,
        strength: f.strength,
        applied: f.applied,
        createdAt: f.createdAt.toISOString(),
      })),
    },
    tasks: deal.tasks.map((t) => ({
      id: t.id,
      kind: t.kind,
      dueAt: t.dueAt.toISOString(),
      reason: t.reason,
      done: t.done,
      doneAt: t.doneAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  };

  return (
    <DealDetailClient
      deal={serializableDeal}
      userName={userData?.name ?? ""}
      userEmail={userData?.email ?? ""}
      hasRateCard={!!userData?.rateCard}
    />
  );
}

export default async function DealDetailPage({ params }: { params: Promise<{ dealId: string }> }) {
  const user = await getUser();
  if (!user) return null;
  const { dealId } = await params;

  return (
    <Suspense fallback={<DealDetailSkeleton />}>
      <DealContent userId={user.id} dealId={dealId} />
    </Suspense>
  );
}