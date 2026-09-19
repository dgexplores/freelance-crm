import Stripe from "stripe";
import { getStripe } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook: checkout.session.completed → active,
 * customer.subscription.updated/deleted → sync status.
 * Configure endpoint in Stripe Dashboard with these events.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!stripe || !secret) {
    return Response.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.["userId"];
        const customerId = typeof session.customer === "string" ? session.customer : null;
        const subId = typeof session.subscription === "string" ? session.subscription : null;
        if (userId) {
          await prisma.subscription.upsert({
            where: { userId },
            update: { status: "active", stripeCustomerId: customerId, stripeSubId: subId },
            create: { userId, status: "active", stripeCustomerId: customerId, stripeSubId: subId },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : "";
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : sub.status === "active" || sub.status === "trialing"
              ? "active"
              : sub.status === "past_due"
                ? "past_due"
                : "canceled";
        await prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: { status, stripeSubId: sub.id },
        });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logger.error("Billing webhook handler failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Handler failed." }, { status: 500 });
  }

  return Response.json({ received: true });
}
