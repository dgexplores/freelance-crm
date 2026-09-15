"use server";

import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { safeActionMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { EMAIL_PAGE_SIZE } from "@/lib/pagination";

export type LoadedEmail = {
  id: string;
  subject: string;
  body: string;
  direction: string;
  receivedAt: string;
  gmailId: string | null;
  threadId: string | null;
};

export type LoadMoreEmailsResult =
  | { ok: true; emails: LoadedEmail[]; hasMore: boolean }
  | { ok: false; message: string };

/**
 * Fetch one more page of a contact's email history, older than `beforeIso`.
 *
 * The deal page only ships the newest EMAIL_PAGE_SIZE messages, so without this
 * the rest of a long thread is simply unreachable. Scoping is by `userId` *and*
 * by the deal's contact — knowing a deal id from another account must not be
 * enough to page through its mail.
 */
export async function loadMoreEmailsAction(
  dealId: string,
  beforeIso: string,
): Promise<LoadMoreEmailsResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const before = new Date(beforeIso);
  if (!beforeIso || Number.isNaN(before.getTime())) {
    return { ok: false, message: "Invalid pagination cursor." };
  }

  try {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, userId: user.id },
      select: { contactId: true },
    });
    if (!deal) return { ok: false, message: "Deal not found." };

    // Fetch one extra row to learn whether another page exists, without a
    // second count query.
    const rows = await prisma.email.findMany({
      where: {
        userId: user.id,
        contactId: deal.contactId,
        receivedAt: { lt: before },
      },
      orderBy: { receivedAt: "desc" },
      take: EMAIL_PAGE_SIZE + 1,
      select: {
        id: true,
        subject: true,
        body: true,
        direction: true,
        receivedAt: true,
        gmailId: true,
        threadId: true,
      },
    });

    const hasMore = rows.length > EMAIL_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, EMAIL_PAGE_SIZE) : rows;

    return {
      ok: true,
      emails: page.map((e) => ({
        id: e.id,
        subject: e.subject,
        body: e.body,
        direction: e.direction,
        receivedAt: e.receivedAt.toISOString(),
        gmailId: e.gmailId,
        threadId: e.threadId,
      })),
      hasMore,
    };
  } catch (err) {
    return {
      ok: false,
      message: safeActionMessage(err, "Failed to load older emails.", (detail) =>
        logger.error("Load older emails failed", {
          userId: user.id,
          dealId,
          error: detail,
        }),
      ),
    };
  }
}
