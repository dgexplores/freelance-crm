import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { billingEnabled, getUsage } from "@/lib/billing";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Settings | Inbox CRM" };

// Per-user data — never prerender at build time (needs request DB access).
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) return null;

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      name: true,
      rateCard: true,
      gmailSyncStartedAt: true,
      staleDays: true,
      autoFollowUp: true,
    },
  });
  const usage = await getUsage(user.id);
  const gmailConnected = await prisma.account.count({
    where: { userId: user.id, providerId: "google" },
  });

  return (
    <SettingsClient
      userEmail={userData?.email ?? ""}
      userName={userData?.name ?? ""}
      rateCard={userData?.rateCard ?? ""}
      gmailSyncStartedAt={userData?.gmailSyncStartedAt?.toISOString() ?? null}
      staleDays={userData?.staleDays ?? 5}
      autoFollowUp={userData?.autoFollowUp ?? true}
      gmailConnected={gmailConnected > 0}
      billing={{ ...usage, enabled: billingEnabled() }}
    />
  );
}