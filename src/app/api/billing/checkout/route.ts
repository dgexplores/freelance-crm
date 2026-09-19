import { getUser } from "@/lib/session";
import { getStripe } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Create a Pro Checkout Session for the current user. */
export async function POST() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  const stripe = getStripe();
  const priceId = process.env["STRIPE_PRICE_ID"];
  if (!stripe || !priceId) {
    return Response.json(
      { error: "Billing is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID." },
      { status: 503 },
    );
  }

  const baseUrl =
    process.env["BETTER_AUTH_URL"] ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  let customerId = sub?.stripeCustomerId ?? undefined;
  if (customerId) {
    try {
      await stripe.customers.retrieve(customerId);
    } catch {
      customerId = undefined;
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/settings?billing=success`,
    cancel_url: `${baseUrl}/settings?billing=cancelled`,
    metadata: { userId: user.id },
    ...(customerId
      ? { customer: customerId }
      : { customer_email: user.email }),
  });

  if (sub && !sub.stripeCustomerId && typeof session.customer === "string") {
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { stripeCustomerId: session.customer },
    });
  }

  return Response.json({ url: session.url });
}
