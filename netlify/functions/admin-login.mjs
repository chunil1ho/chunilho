import crypto from "node:crypto";
import { json, body } from "./_lib.mjs";

function sign(payload) {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret) throw new Error("ADMIN_TOKEN_SECRET 환경변수가 설정되지 않았습니다.");
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return data + "." + sig;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { message: "Method Not Allowed" });
  const { id, pw } = await body(event);
  if (!process.env.ADMIN_ID || !process.env.ADMIN_PASSWORD) return json(500, { message: "관리자 환경변수가 설정되지 않았습니다." });
  if (id !== process.env.ADMIN_ID || pw !== process.env.ADMIN_PASSWORD) return json(401, { message: "아이디 또는 비밀번호가 올바르지 않습니다." });
  return json(200, { token: sign({ sub: id, exp: Date.now() + 1000 * 60 * 60 * 8 }) });
}
