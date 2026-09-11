import crypto from "node:crypto";
import { getAuthToken } from "./_lib.mjs";

export function verifyAdmin(event) {
  const token = getAuthToken(event);
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!token || !secret) return false;
  const [data, sig] = token.split(".");
  if (!data || !sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    return p.exp > Date.now();
  } catch { return false; }
}
