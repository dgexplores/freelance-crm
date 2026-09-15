/**
 * Account constants shared by the settings page (a client component) and the
 * account data layer.
 *
 * These cannot live in `@/lib/account`, because that module imports Prisma —
 * and `@/lib/prisma` has no `server-only` guard, so importing it from a client
 * component would quietly bundle the Prisma client into the browser. Keeping
 * the plain values here means the client never touches the data layer.
 */

export const EXPORT_SCHEMA_VERSION = 1;

/** The user must type this verbatim to arm account deletion. */
export const DELETE_CONFIRMATION_WORD = "DELETE";
