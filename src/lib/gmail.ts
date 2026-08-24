import "server-only";
import { prisma } from "@/lib/prisma";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] ?? "";
const CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] ?? "";

export type ImportedMessage = {
  gmailId: string;
  threadId: string | null;
  subject: string;
  fromAddr: string;
  receivedAt: Date;
  snippet: string;
  body: string;
};

export class GmailImportError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Read-only, forward-only Gmail import.
 *
 * Safety invariants:
 *  - Only the Gmail API read endpoint (`gmail.readonly` scope) is ever called.
 *  - No send/trash/delete/modify/archive/move requests are ever made.
 *  - A per-user forward-only boundary is recorded on the first run; messages
 *    older than that boundary are never fetched. The boundary never moves, so
 *    no message is ever skipped between imports.
 */
export async function getGmailAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "google" },
  });
  if (!account?.accessToken) {
    throw new GmailImportError(
      "No Google account linked for this user. Re-auth with Google.",
      401,
    );
  }

  const expiresAt = account.accessTokenExpiresAt;
  const isExpired =
    !expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (!isExpired) return account.accessToken;

  if (!account.refreshToken) {
    throw new GmailImportError(
      "Google access token expired and no refresh token is available. Re-auth with Google.",
      401,
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new GmailImportError(
      `Failed to refresh Google access token (${res.status}). Re-auth with Google.`,
      401,
    );
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };
  await prisma.account.update({
    where: { id: account.id },
    data: {
      accessToken: data.access_token,
      accessTokenExpiresAt: new Date(
        Date.now() + (data.expires_in ?? 3600) * 1000,
      ),
    },
  });
  return data.access_token;
}

function decodeBase64Url(value: string): string {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(base64, "base64").toString("utf8");
}

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

function extractBody(payload: GmailPart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const body = extractBody(part);
    if (body) return body;
  }
  return "";
}

export type GmailListResponse = {
  messages?: { id: string }[];
  nextPageToken?: string;
};

export type GmailMessageResponse = {
  id: string;
  threadId: string;
  internalDate?: string;
  snippet?: string;
  payload?: {
    headers?: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailPart[];
  };
};

async function gmailFetch(
  token: string,
  url: string,
): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new GmailImportError(
      `Gmail API request failed (${res.status}): ${res.statusText}`,
      res.status,
    );
  }
  return res.json();
}

export async function fetchNewMessages(
  userId: string,
  sinceMs: number,
  opts: { maxPages?: number; pageSize?: number } = {},
): Promise<ImportedMessage[]> {
  const maxPages = opts.maxPages ?? 10;
  const pageSize = opts.pageSize ?? 25;

  const token = await getGmailAccessToken(userId);
  const q = `in:inbox after:${Math.floor(sinceMs / 1000)}`;

  const imported: ImportedMessage[] = [];
  let nextPageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      q,
      maxResults: String(pageSize),
      fields: "messages(id),nextPageToken",
    });
    if (nextPageToken) params.set("pageToken", nextPageToken);

    const list = (await gmailFetch(
      token,
      `${GMAIL_API}/messages?${params.toString()}`,
    )) as GmailListResponse;

    const ids = list.messages?.map((m) => m.id) ?? [];
    if (ids.length === 0) break;

    const results = await Promise.all(
      ids.map(async (id) => {
        const msg = (await gmailFetch(
          token,
          `${GMAIL_API}/messages/${id}?format=full`,
        )) as GmailMessageResponse;
        const headers = msg.payload?.headers ?? [];
        const getHeader = (name: string) =>
          headers.find(
            (h) => h.name.toLowerCase() === name.toLowerCase(),
          )?.value;
        const receivedAt = new Date(Number(msg.internalDate));
        const body = extractBody(msg.payload);
        return {
          gmailId: msg.id,
          threadId: msg.threadId,
          subject: getHeader("Subject") ?? "",
          fromAddr: getHeader("From") ?? "",
          receivedAt,
          snippet: msg.snippet ?? "",
          body,
        } satisfies ImportedMessage;
      }),
    );

    imported.push(...results.filter((m) => m.fromAddr.trim() !== ""));

    nextPageToken = list.nextPageToken;
    if (!nextPageToken) break;
  }

  return imported;
}

export type ImportContext = {
  firstRun: boolean;
  sinceMs: number;
};

export async function getImportContext(userId: string): Promise<ImportContext> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.gmailSyncStartedAt) {
    return { firstRun: false, sinceMs: user.gmailSyncStartedAt.getTime() };
  }
  // First run: backfill at most the last day, then a forward-only boundary
  // is recorded after a successful import (never before, so a failed first
  // run cannot lose mail).
  return { firstRun: true, sinceMs: Date.now() - 24 * 60 * 60 * 1000 };
}

export async function recordForwardOnlyBoundary(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { gmailSyncStartedAt: new Date() },
  });
}

export type ImportResult = {
  boundary: Date | null;
  firstRun: boolean;
  fetched: number;
  imported: number;
  skipped: number;
  contacts: number;
  deals: number;
  facts: number;
  errors: string[];
};