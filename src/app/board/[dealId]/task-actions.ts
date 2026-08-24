"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";

export type ActionResult<T = unknown> = {
  ok: boolean;
  message: string;
  data?: T;
};

export async function createTaskAction(
  dealId: string,
  kind: "follow_up" | "brief" | "proposal",
  dueAt: Date,
  reason: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const deal = await prisma.deal.findFirst({ where: { id: dealId, userId: user.id } });
  if (!deal) return { ok: false, message: "Deal not found." };

  try {
    const task = await prisma.task.create({
      data: {
        dealId,
        kind,
        dueAt,
        reason,
      },
    });
    revalidatePath(`/board/${dealId}`);
    return { ok: true, message: `${kind.replace("_", " ")} task scheduled.`, data: task };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create task.";
    return { ok: false, message };
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
    const message = err instanceof Error ? err.message : "Failed to complete task.";
    return { ok: false, message };
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
    const message = err instanceof Error ? err.message : "Failed to delete task.";
    return { ok: false, message };
  }
}