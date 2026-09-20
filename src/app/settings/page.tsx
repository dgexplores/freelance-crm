import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { billingEnabled, getUsage } from "@/lib/billing";
import { getUserPrefs } from "@/lib/prefs";
import { SettingsClient } from "./settings-client";
import { SettingsSkeleton } from "@/components/skeletons";
import { Suspense } from "react";

export const metadata = { title: "Settings | Inbox CRM" };

export const dynamic = "force-dynamic";

async function SettingsContent({ userId }: { userId: string }) {
  const [userData, usage, prefs, gmailConnected] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        rateCard: true,
        gmailSyncStartedAt: true,
      },
    }),
    getUsage(userId),
    getUserPrefs(userId),
    prisma.account.count({
      where: { userId, providerId: "google" },
    }),
  ]);

  return (
    <SettingsClient
      userEmail={userData?.email ?? ""}
      userName={userData?.name ?? ""}
      rateCard={userData?.rateCard ?? ""}
      gmailSyncStartedAt={userData?.gmailSyncStartedAt?.toISOString() ?? null}
      staleDays={prefs.staleDays}
      autoFollowUp={prefs.autoFollowUp}
      gmailConnected={gmailConnected > 0}
      billing={{ ...usage, enabled: billingEnabled() }}
    />
  );
}

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) return null;

  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent userId={user.id} />
    </Suspense>
  );
}