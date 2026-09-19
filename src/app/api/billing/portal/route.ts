import { getUser } from "@/lib/session";
import { getStripe } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Open the Stripe customer portal (manage/cancel subscription). */
export async function POST() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ error: "Billing is not configured." }, { status: 503 });
  }
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!sub?.stripeCustomerId) {
    return Response.json({ error: "No billing account yet." }, { status: 404 });
  }
  const baseUrl =
    process.env["BETTER_AUTH_URL"] ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${baseUrl}/settings`,
  });
  return Response.json({ url: session.url });
}
