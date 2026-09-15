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

// Mock Prisma. `$transaction` runs its callback against the same model mocks,
// so delete ordering can be asserted by inspecting call order.
vi.mock("@/lib/prisma", () => {
  const models = {
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    deal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    contact: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    email: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    fact: {
      createMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    session: { deleteMany: vi.fn() },
    account: { findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  };

  return {
    prisma: {
      ...models,
      $transaction: vi.fn(async (fn: (tx: typeof models) => Promise<unknown>) =>
        fn(models),
      ),
    },
  };
}));

// Mock server actions
vi.mock("@/app/board/actions", () => ({
  importGmailAction: vi.fn(),
  moveDealAction: vi.fn(),
  updateDealAction: vi.fn(),
  updateContactAction: vi.fn(),
  setFactAppliedAction: vi.fn(),
  scheduleStaleFollowUpsAction: vi.fn(),
}));

vi.mock("@/app/settings/actions", () => ({
  updateRateCardAction: vi.fn(),
  deleteAccountAction: vi.fn(),
}));

vi.mock("@/app/board/[dealId]/task-actions", () => ({
  createTaskAction: vi.fn(),
  completeTaskAction: vi.fn(),
  reopenTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
}));

vi.mock("@/app/board/[dealId]/email-actions", () => ({
  loadMoreEmailsAction: vi.fn(),
}));

// NOTE: TASK_KINDS deliberately has no mock — it lives in the plain
// `@/lib/tasks` module precisely so it is importable outside a "use server"
// file, and mocking it here would hide a regression of that constraint.

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