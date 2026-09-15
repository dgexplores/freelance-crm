/**
 * Page sizes shared between server components and server actions.
 *
 * These live outside any `"use server"` module on purpose: a server action
 * file may only export async functions, so a constant declared there cannot be
 * imported by the page that needs to agree with it.
 */

/** Emails rendered on the deal page before the "load older" button appears. */
export const EMAIL_PAGE_SIZE = 20;
