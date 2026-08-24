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

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn(),
  signOut: vi.fn(),
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
    },
    task: {
      findFirst: vi.fn(),
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
}));

vi.mock("@/app/settings/actions", () => ({
  updateRateCardAction: vi.fn(),
}));

vi.mock("@/app/board/[dealId]/actions", () => ({
  generateBriefAction: vi.fn(),
  generateProposalAction: vi.fn(),
  generateNudgeAction: vi.fn(),
}));

vi.mock("@/app/board/[dealId]/task-actions", () => ({
  createTaskAction: vi.fn(),
  completeTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
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