import "server-only";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export const FREE_AI_QUOTA = 20;
export const PRO_AI_QUOTA = 500;
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export class BillingUnavailableError extends AppError {
  constructor() {
    super("Billing is not configured. Set STRIPE_SECRET_KEY.", 503, "unavailable");
    this.name = "BillingUnavailableError";
  }
}

export class QuotaExceededError extends AppError {
  constructor(limit: number) {
    super(
      `Monthly AI quota reached (${limit} generations). Upgrade for more.`,
      402,
      "quota_exceeded",
    );
    this.name = "QuotaExceededError";
  }
}

let stripe: Stripe | null | undefined;
export function getStripe(): Stripe | null {
  if (stripe !== undefined) return stripe;
  const key = process.env["STRIPE_SECRET_KEY"];
  stripe = key ? new Stripe(key) : null;
  return stripe;
}

export function billingEnabled(): boolean {
  return Boolean(process.env["STRIPE_SECRET_KEY"] && process.env["STRIPE_PRICE_ID"]);
}

export async function getSubscription(userId: string) {
  return prisma.subscription.findUnique({ where: { userId } });
}

function quotaFor(status: string): number {
  return status === "active" ? PRO_AI_QUOTA : FREE_AI_QUOTA;
}

function periodExpired(periodStart: Date): boolean {
  return Date.now() - periodStart.getTime() >= PERIOD_MS;
}

/** Current usage snapshot for settings UI. */
export async function getUsage(userId: string): Promise<{
  used: number;
  limit: number;
  status: string;
  pro: boolean;
}> {
  const sub = await getSubscription(userId);
  const used = sub && !periodExpired(sub.periodStart) ? sub.aiUsed : 0;
  const status = sub?.status ?? "free";
  return { used, limit: quotaFor(status), status, pro: status === "active" };
}

/**
 * Throw QuotaExceededError when the monthly budget is spent.
 * Call BEFORE generation so no tokens burn on over-quota users.
 */
export async function checkAiQuota(userId: string): Promise<void> {
  const { used, limit } = await getUsage(userId);
  if (used >= limit) throw new QuotaExceededError(limit);
}

/**
 * Count one generation. Rolls the 30-day window automatically.
 * Counted at generation start (streaming included) — imprecise by design,
 * documented; over-counting favors the house by at most one unit per click.
 */
export async function recordAiUsage(userId: string): Promise<void> {
  const sub = await getSubscription(userId);
  if (!sub || periodExpired(sub.periodStart)) {
    await prisma.subscription.upsert({
      where: { userId },
      update: { aiUsed: 1, periodStart: new Date() },
      create: { userId, aiUsed: 1 },
    });
    return;
  }
  await prisma.subscription.update({
    where: { userId },
    data: { aiUsed: { increment: 1 } },
  });
}
