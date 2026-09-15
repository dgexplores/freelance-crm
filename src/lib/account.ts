import { prisma } from "@/lib/prisma";
import { EXPORT_SCHEMA_VERSION } from "@/lib/account-constants";

/**
 * Account-level data access: a full export, and a full erasure.
 *
 * The privacy policy promises both ("export or deletion ... at any time").
 * Both live here rather than in the route/action so the delete ordering can be
 * unit-tested without a running server.
 *
 * Client-safe values live in `@/lib/account-constants` — this module pulls in
 * Prisma and must stay server-side.
 */

export interface AccountExport {
  meta: {
    app: string;
    schemaVersion: number;
    exportedAt: string;
    note: string;
  };
  account: {
    id: string;
    email: string;
    name: string | null;
    rateCard: string | null;
    gmailSyncStartedAt: string | null;
    createdAt: string;
  } | null;
  contacts: unknown[];
  deals: unknown[];
  emails: unknown[];
  facts: unknown[];
  tasks: unknown[];
}

const EXPORT_NOTE =
  "OAuth access and refresh tokens are deliberately excluded from this export. " +
  "They are credentials, not your data; revoke them at " +
  "https://myaccount.google.com/permissions.";

/**
 * Everything the user owns, as plain JSON-safe values.
 *
 * `Account` (better-auth's token table) is intentionally omitted — see
 * EXPORT_NOTE. Downloading live refresh tokens into a file on disk would turn
 * a data-portability feature into a credential-leak feature.
 */
export async function collectUserData(userId: string): Promise<AccountExport> {
  const [user, contacts, deals, emails, facts, tasks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        rateCard: true,
        gmailSyncStartedAt: true,
        createdAt: true,
      },
    }),
    prisma.contact.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.deal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.email.findMany({ where: { userId }, orderBy: { receivedAt: "asc" } }),
    prisma.fact.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    // Task carries no userId of its own — it is reached through its deal.
    prisma.task.findMany({
      where: { deal: { userId } },
      orderBy: { dueAt: "asc" },
    }),
  ]);

  return {
    meta: {
      app: "inbox-crm",
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      note: EXPORT_NOTE,
    },
    account: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          rateCard: user.rateCard,
          gmailSyncStartedAt: user.gmailSyncStartedAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
        }
      : null,
    contacts: contacts.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      lastContact: c.lastContact?.toISOString() ?? null,
    })),
    deals: deals.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      wonAt: d.wonAt?.toISOString() ?? null,
    })),
    emails: emails.map((e) => ({ ...e, receivedAt: e.receivedAt.toISOString() })),
    facts: facts.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    tasks: tasks.map((t) => ({
      ...t,
      dueAt: t.dueAt.toISOString(),
      doneAt: t.doneAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

/**
 * Erase the user and everything they own, in one transaction.
 *
 * `Contact`, `Deal`, `Email` and `Fact` all hold a required `user` relation with
 * no `onDelete: Cascade`, so deleting the `User` row first would fail on a
 * foreign-key constraint. Children therefore go first, deepest-first:
 *
 *   Task   -> Deal      (Task.dealId)
 *   Fact   -> Contact   (Fact.contactId)
 *   Email  -> Contact   (Email.contactId)
 *   Deal   -> Contact   (Deal.contactId)
 *   Session, Account    (would cascade, but removing them explicitly ends the
 *                        session immediately rather than relying on that)
 *   User
 *
 * All of it is inside `$transaction`, so a mid-way failure leaves the account
 * intact rather than half-deleted.
 */
export async function deleteUserData(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.task.deleteMany({ where: { deal: { userId } } });
    await tx.fact.deleteMany({ where: { userId } });
    await tx.email.deleteMany({ where: { userId } });
    await tx.deal.deleteMany({ where: { userId } });
    await tx.contact.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
}
