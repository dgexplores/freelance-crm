/**
 * Task domain constants.
 *
 * Kept out of `./task-actions.ts` because that module is marked `"use server"`,
 * where every export must be an async function. The deal page is a client
 * component and needs `TASK_KINDS` as a runtime value to render the kind
 * selector, so the constant has to live somewhere plain.
 */

export const TASK_KINDS = ["follow_up", "brief", "proposal"] as const;

export type TaskKind = (typeof TASK_KINDS)[number];

/** Human labels for the task-kind selector. */
export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  follow_up: "Follow up",
  brief: "Brief",
  proposal: "Proposal",
};
