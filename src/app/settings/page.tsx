import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Settings | Inbox CRM" };

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

  return (
    <SettingsClient
      userEmail={userData?.email ?? ""}
      userName={userData?.name ?? ""}
      rateCard={userData?.rateCard ?? ""}
      gmailSyncStartedAt={userData?.gmailSyncStartedAt?.toISOString() ?? null}
    />
  );
}