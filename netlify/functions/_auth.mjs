import crypto from "node:crypto";
import { getAuthToken } from "./_lib.mjs";

export function verifyAdmin(event) {
  const token = getAuthToken(event);
  const secret = process.env.ADMIN_TOKEN_SECRET;

  if (!token || !secret) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [data, sig] = parts;

  if (!data || !sig) {
    return false;
  }

  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");

    if (sig.length !== expected.length) {
      return false;
    }

    if (
      !crypto.timingSafeEqual(
        Buffer.from(sig),
        Buffer.from(expected)
      )
    ) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    );

    if (!payload.exp) {
      return false;
    }

    return Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}
