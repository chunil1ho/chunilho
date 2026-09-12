import { getStore } from "@netlify/blobs";

export const store = getStore({
  name: "chunilho-bookings",
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_AUTH_TOKEN,
  consistency: "strong"
});

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    },
    body: JSON.stringify(body)
  };
}

export async function body(event) {
  try {
    if (!event.body) return {};
    return typeof event.body === "string"
      ? JSON.parse(event.body)
      : event.body;
  } catch {
    return {};
  }
}

export function normalizeTel(tel) {
  return String(tel || "").replace(/\D/g, "");
}

export function getAuthToken(event) {
  const headers = event?.headers || {};

  const authorization =
    headers.authorization ||
    headers.Authorization ||
    "";

  if (!authorization) return "";

  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  return authorization.trim();
}
