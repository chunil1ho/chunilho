import crypto from "node:crypto";
import { store, json, body, normalizeTel } from "./_lib.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://chunilho.com",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  try {
    const [salt, originalHash] = String(storedHash).split(":");

    if (!salt || !originalHash) {
      return false;
    }

    const hash = crypto
      .scryptSync(password, salt, 64)
      .toString("hex");

    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(originalHash, "hex")
    );
  } catch (error) {
    return false;
  }
}

export async function handler(event) {
  const method = event.httpMethod;

  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ""
    };
  }
  /*
   * ==========================================
   * GET
   * 로그인 회원 정보 확인
   * ==========================================
   */

  if (method === "GET") {
    const auth = event.headers?.authorization || "";

    if (!auth.startsWith("Bearer ")) {
      return json(401, {
        message: "로그인이 필요합니다."
      });
    }

    const token = auth.substring(7).trim();

    if (!token) {
      return json(401, {
        message: "로그인이 필요합니다."
      });
    }

    let session;

    try {
      session = await store.get(
        "member-session/" + token,
        {
          type: "json"
        }
      );
    } catch (error) {
      console.error("회원 세션 조회 오류:", error);

      return json(500, {
        message: "회원 정보를 확인할 수 없습니다."
      });
    }

    if (!session) {
      return json(401, {
        message: "로그인 세션이 만료되었습니다."
      });
    }

    if (
      session.expiresAt &&
      new Date(session.expiresAt).getTime() < Date.now()
    ) {
      return json(401, {
        message: "로그인 세션이 만료되었습니다."
      });
    }

    let member;

    try {
      member = await store.get(
        "member/" + session.memberId,
        {
          type: "json"
        }
      );
    } catch (error) {
      console.error("회원 정보 조회 오류:", error);

      return json(500, {
        message: "회원 정보를 불러오지 못했습니다."
      });
    }

    if (!member) {
      return json(404, {
        message: "회원 정보를 찾을 수 없습니다."
      });
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: true,
        member: {
          memberId: member.memberId,
          name: member.name,
          tel: member.tel,
          status: member.status,
          createdAt: member.createdAt,
          lastLoginAt: member.lastLoginAt,
          reservationCount: member.reservationCount || 0
        }
      })
    };
  }
  /*
   * ==========================================
   * POST
   * 회원가입
   * ==========================================
   */

  if (method === "POST") {
    const data = await body(event);
    /*
     * ==========================================
     * 로그인
     * ==========================================
     */

    if (data.action === "login") {
      const memberId = String(data.memberId || "")
        .trim()
        .toLowerCase();

      const password = String(data.password || "");

      if (!memberId || !password) {
        return json(400, {
          message: "아이디와 비밀번호를 입력해주세요."
        });
      }

      const key = "member/" + memberId;

      let member;

      try {
        member = await store.get(key, {
          type: "json"
        });
      } catch (error) {
        console.error("회원 조회 오류:", error);

        return json(500, {
          message: "로그인 처리 중 오류가 발생했습니다."
        });
      }

      if (!member) {
        return json(401, {
          message: "아이디 또는 비밀번호가 올바르지 않습니다."
        });
      }

      if (member.status !== "정상") {
        return json(403, {
          message: "현재 이용이 제한된 회원입니다."
        });
      }

      if (!verifyPassword(password, member.passwordHash)) {
        return json(401, {
          message: "아이디 또는 비밀번호가 올바르지 않습니다."
        });
      }

      /*
       * 로그인 세션 생성
       */

      const token = crypto.randomBytes(32).toString("hex");

      const now = new Date().toISOString();

      const session = {
        token,
        memberId: member.memberId,
        createdAt: now,
        expiresAt: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 7
        ).toISOString()
      };

      try {
        await store.setJSON(
          "member-session/" + token,
          session
        );

        member.lastLoginAt = now;

        await store.setJSON(
          "member/" + member.memberId,
          member
        );
      } catch (error) {
        console.error("로그인 세션 저장 오류:", error);

        return json(500, {
          message: "로그인 처리 중 오류가 발생했습니다."
        });
      }

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ok: true,
          message: "로그인되었습니다.",
          token,
          member: {
            memberId: member.memberId,
            name: member.name,
            tel: member.tel,
            status: member.status
          }
        })
      };
    }
    const memberId = String(data.memberId || "")
      .trim()
      .toLowerCase();

    const password = String(data.password || "");
    const name = String(data.name || "").trim();
    const tel = normalizeTel(data.tel || "");

    if (!memberId) {
      return json(400, {
        message: "아이디를 입력해주세요."
      });
    }

    if (!/^[a-z0-9][a-z0-9._-]{3,19}$/.test(memberId)) {
      return json(400, {
        message: "아이디는 영문 소문자, 숫자, ., _, -만 사용할 수 있으며 4~20자로 입력해주세요."
      });
    }

    if (!password || password.length < 8) {
      return json(400, {
        message: "비밀번호는 8자 이상 입력해주세요."
      });
    }

    if (!name) {
      return json(400, {
        message: "이름을 입력해주세요."
      });
    }

    if (!tel) {
      return json(400, {
        message: "휴대폰 번호를 입력해주세요."
      });
    }

    const key = "member/" + memberId;

    // 기존 회원 확인
    try {
      const existing = await store.get(key, {
        type: "json"
      });

      if (existing) {
        return json(409, {
          message: "이미 사용 중인 아이디입니다."
        });
      }
    } catch (error) {
      console.error("회원 중복 확인 오류:", error);

      return json(500, {
        message: "회원 확인 중 오류가 발생했습니다."
      });
    }

    const now = new Date().toISOString();

    const member = {
      memberId,
      passwordHash: hashPassword(password),
      name,
      tel,
      status: "정상",
      createdAt: now,
      lastLoginAt: "",
      reservationCount: 0
    };

    try {
      await store.setJSON(key, member);
    } catch (error) {
      console.error("회원 저장 오류:", error);

      return json(500, {
        message: "회원가입 처리 중 오류가 발생했습니다."
      });
    }

    // 비밀번호는 절대로 응답으로 보내지 않음
    return {
      statusCode: 201,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: true,
        message: "회원가입이 완료되었습니다.",
        member: {
          memberId: member.memberId,
          name: member.name,
          tel: member.tel,
          status: member.status,
          createdAt: member.createdAt
        }
      })
    };
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({
      message: "Method Not Allowed"
    })
  };
}
