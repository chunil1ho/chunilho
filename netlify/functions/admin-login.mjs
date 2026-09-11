import crypto from "node:crypto";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function readBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return {};
  }
}

function sign(payload) {
  const secret = process.env.ADMIN_TOKEN_SECRET;

  if (!secret) {
    throw new Error("ADMIN_TOKEN_SECRET 환경변수가 설정되지 않았습니다.");
  }

  const data = Buffer.from(
    JSON.stringify(payload)
  ).toString("base64url");

  const sig = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  return `${data}.${sig}`;
}

export async function handler(event) {
  const method =
    event?.httpMethod ||
    event?.requestContext?.http?.method ||
    "";

  if (method !== "POST") {
    return json(405, {
      message: "Method Not Allowed"
    });
  }

  try {
    const { id = "", pw = "" } = readBody(event);

    const adminId = process.env.ADMIN_ID;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const tokenSecret = process.env.ADMIN_TOKEN_SECRET;

    if (!adminId || !adminPassword || !tokenSecret) {
      console.error("관리자 로그인 환경변수 누락");

      return json(500, {
        message: "관리자 로그인 서버 설정이 완료되지 않았습니다."
      });
    }

    if (
      String(id) !== String(adminId) ||
      String(pw) !== String(adminPassword)
    ) {
      return json(401, {
        message: "아이디 또는 비밀번호가 올바르지 않습니다."
      });
    }

    const token = sign({
      sub: String(adminId),
      exp: Date.now() + 1000 * 60 * 60 * 8
    });

    return json(200, {
      token
    });

  } catch (error) {
    console.error("admin-login error:", error);

    return json(500, {
      message: "관리자 로그인 서버 오류가 발생했습니다."
    });
  }
}
