// Dev seed: demo inbox so /board renders without Gmail OAuth.
// Usage: DEV_BYPASS_AUTH=true DATABASE_URL=... node scripts/seed-dev.mjs
// Idempotent: upserts by (userId,email) / (userId,gmailId).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const userEmail = "dev@local.test";

const user = await prisma.user.upsert({
  where: { email: userEmail },
  update: {},
  create: { email: userEmail, name: "Dev User", emailVerified: true },
});

const contacts = [
  { email: "ava@example.com", name: "Ava Patel", company: "Acme Co", subject: "Website redesign quote", body: "Hi! We need a website redesign, budget around $5k, timeline 6 weeks. Can you send a proposal?", stage: "INBOX", dealTitle: "Acme Co — Website redesign" },
  { email: "liam@example.com", name: "Liam Chen", company: "Liam Studios", subject: "Re: Discovery call follow-up", body: "Great speaking today. As discussed we want a 20h discovery sprint at your strategy rate. Please confirm next steps.", stage: "QUALIFIED", dealTitle: "Liam Studios — Discovery sprint" },
  { email: "mia@example.com", name: "Mia Rossi", company: "Rossi Media", subject: "Proposal approved – let's start", body: "Your proposal looks good. We accept the frontend build at the quoted rate. Start date next Monday?", stage: "PROPOSAL", dealTitle: "Rossi Media — Frontend build" },
];

for (const [i, c] of contacts.entries()) {
  const contact = await prisma.contact.upsert({
    where: { userId_email: { userId: user.id, email: c.email } },
    update: {},
    create: { userId: user.id, email: c.email, name: c.name, company: c.company, source: "dev-seed", lastContact: new Date() },
  });
  const gmailId = `dev-seed-${i}`;
  await prisma.email.upsert({
    where: { userId_gmailId: { userId: user.id, gmailId } },
    update: {},
    create: {
      userId: user.id, contactId: contact.id, gmailId, subject: c.subject,
      fromAddr: c.email, body: c.body, direction: "INBOUND", receivedAt: new Date(),
    },
  });
  const existing = await prisma.deal.findFirst({ where: { userId: user.id, contactId: contact.id } });
  if (!existing) {
    await prisma.deal.create({
      data: {
        userId: user.id, contactId: contact.id, title: c.dealTitle,
        stage: c.stage, whyInPipeline: `Dev seed: ${c.subject}`,
      },
    });
  }
  await prisma.fact.upsert({
    where: { id: `dev-seed-fact-${i}` },
    update: {},
    create: {
      id: `dev-seed-fact-${i}`, userId: user.id, contactId: contact.id,
      claim: c.subject, source: "email", strength: "strong", applied: true,
    },
  });
}

console.log(`Seeded dev inbox for ${userEmail}: ${contacts.length} contacts/deals.`);
await prisma.$disconnect();
