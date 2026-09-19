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
    },
  });
  const usage = await getUsage(user.id);

  return (
    <SettingsClient
      userEmail={userData?.email ?? ""}
      userName={userData?.name ?? ""}
      rateCard={userData?.rateCard ?? ""}
      gmailSyncStartedAt={userData?.gmailSyncStartedAt?.toISOString() ?? null}
      billing={{ ...usage, enabled: billingEnabled() }}
    />
  );
}