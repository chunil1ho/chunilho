import { json } from "./_lib.mjs";
import { verifyAdmin } from "./_auth.mjs";
export async function handler(event) { return verifyAdmin(event) ? json(200, { ok: true }) : json(401, { message: "관리자 세션이 만료되었습니다." }); }
