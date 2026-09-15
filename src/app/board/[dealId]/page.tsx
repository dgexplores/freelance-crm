import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { EMAIL_PAGE_SIZE } from "@/lib/pagination";
import { DealDetailClient } from "./deal-detail-client";

export const metadata = { title: "Deal | Inbox CRM" };

export default async function DealDetailPage({ params }: { params: Promise<{ dealId: string }> }) {
  const user = await getUser();
  if (!user) return null;
  const { dealId } = await params;

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, userId: user.id },
    include: {
      contact: {
        include: {
          emails: {
            orderBy: { receivedAt: "desc" },
            take: EMAIL_PAGE_SIZE,
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

  // Only the newest EMAIL_PAGE_SIZE messages are shipped; the client needs to
  // know whether paging further back is worth offering.
  const emailTotal = await prisma.email.count({
    where: { userId: user.id, contactId: deal.contactId },
  });

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
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
      hasMoreEmails={emailTotal > EMAIL_PAGE_SIZE}
    />
  );
}