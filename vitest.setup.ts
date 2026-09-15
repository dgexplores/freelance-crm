import "@testing-library/jest-dom";
import { vi, beforeAll, afterAll } from "vitest";

// Mock server-only (Next.js internal)
vi.mock("server-only", () => ({}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/board",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock better-auth
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
}));

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    deal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contact: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    email: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    fact: {
      createMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock server actions
vi.mock("@/app/board/actions", () => ({
  importGmailAction: vi.fn(),
  moveDealAction: vi.fn(),
  updateDealAction: vi.fn(),
  updateContactAction: vi.fn(),
  setFactAppliedAction: vi.fn(),
  scheduleStaleFollowUpsAction: vi.fn(),
  DEAL_STAGES: ["INBOX", "QUALIFIED", "PROPOSAL", "WON", "LOST"],
}));

vi.mock("@/app/settings/actions", () => ({
  updateRateCardAction: vi.fn(),
}));

vi.mock("@/app/board/[dealId]/task-actions", () => ({
  createTaskAction: vi.fn(),
  completeTaskAction: vi.fn(),
  reopenTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
  TASK_KINDS: ["follow_up", "brief", "proposal"],
}));

// Suppress console.error in tests unless explicitly testing errors
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === "string" && args[0].includes("Warning:")) return;
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});