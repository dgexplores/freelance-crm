"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { BadRequestError, safeActionMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { TASK_KINDS, type TaskKind } from "@/lib/tasks";

export type ActionResult<T = unknown> = {
  ok: boolean;
  message: string;
  data?: T;
};

const MAX_REASON_LENGTH = 500;
/** Far enough out to be a typo, near enough to be useless — reject both. */
const MAX_DUE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

export async function createTaskAction(
  dealId: string,
  kind: TaskKind,
  dueAt: Date,
  reason: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const deal = await prisma.deal.findFirst({ where: { id: dealId, userId: user.id } });
  if (!deal) return { ok: false, message: "Deal not found." };

  try {
    if (!TASK_KINDS.includes(kind)) {
      throw new BadRequestError("Unknown task type.");
    }
    // Server actions receive whatever the client sent — never trust the shape.
    const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
    if (Number.isNaN(due.getTime())) {
      throw new BadRequestError("Invalid due date.");
    }
    if (due.getTime() > Date.now() + MAX_DUE_AHEAD_MS) {
      throw new BadRequestError("Due date is too far in the future.");
    }
    const trimmedReason = (reason ?? "").trim();
    if (!trimmedReason) {
      throw new BadRequestError("A task needs a reason.");
    }
    if (trimmedReason.length > MAX_REASON_LENGTH) {
      throw new BadRequestError(`Reason is too long (max ${MAX_REASON_LENGTH} characters).`);
    }

    const task = await prisma.task.create({
      data: { dealId, kind, dueAt: due, reason: trimmedReason },
    });
    revalidatePath(`/board/${dealId}`);
    return { ok: true, message: `${kind.replace("_", " ")} task scheduled.`, data: task };
  } catch (err) {
    return {
      ok: false,
      message: safeActionMessage(err, "Failed to create task.", (detail) =>
        logger.error("Task create failed", { userId: user.id, dealId, error: detail }),
      ),
    };
  }
}

export async function completeTaskAction(taskId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const task = await prisma.task.findFirst({
    where: { id: taskId, deal: { userId: user.id } },
    include: { deal: true },
  });
  if (!task) return { ok: false, message: "Task not found." };

  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { done: true, doneAt: new Date() },
    });
    revalidatePath(`/board/${task.dealId}`);
    return { ok: true, message: "Task completed." };
  } catch (err) {
    return {
      ok: false,
      message: safeActionMessage(err, "Failed to complete task.", (detail) =>
        logger.error("Task complete failed", { userId: user.id, taskId, error: detail }),
      ),
    };
  }
}

/** Reopen a completed task — completing one by accident should be undoable. */
export async function reopenTaskAction(taskId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const task = await prisma.task.findFirst({
    where: { id: taskId, deal: { userId: user.id } },
    include: { deal: true },
  });
  if (!task) return { ok: false, message: "Task not found." };

  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { done: false, doneAt: null },
    });
    revalidatePath(`/board/${task.dealId}`);
    return { ok: true, message: "Task reopened." };
  } catch (err) {
    return {
      ok: false,
      message: safeActionMessage(err, "Failed to reopen task.", (detail) =>
        logger.error("Task reopen failed", { userId: user.id, taskId, error: detail }),
      ),
    };
  }
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const task = await prisma.task.findFirst({
    where: { id: taskId, deal: { userId: user.id } },
    include: { deal: true },
  });
  if (!task) return { ok: false, message: "Task not found." };

  try {
    await prisma.task.delete({ where: { id: taskId } });
    revalidatePath(`/board/${task.dealId}`);
    return { ok: true, message: "Task deleted." };
  } catch (err) {
    return {
      ok: false,
      message: safeActionMessage(err, "Failed to delete task.", (detail) =>
        logger.error("Task delete failed", { userId: user.id, taskId, error: detail }),
      ),
    };
  }
}
