import { getStore } from "@netlify/blobs";

export const store = getStore({
  name: "chunilho-bookings",
  consistency: "strong"
});

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

export async function body(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return {};
  }
}

export function normalizeTel(tel) {
  return String(tel || "").replace(/\D/g, "");
}

export function getAuthToken(event) {
  const h =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";

  return h.startsWith("Bearer ")
    ? h.slice(7)
    : "";
}
