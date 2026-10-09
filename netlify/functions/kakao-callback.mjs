import { store } from "./_lib.mjs";

export async function handler(event) {
  try {
    const code = event.queryStringParameters?.code;

    if (!code) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        },
        body: `
          <h2>카카오 인증 실패</h2>
          <p>인증 코드(code)를 받지 못했습니다.</p>
        `
      };
    }

    const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
    const CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET;
    const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;

    if (!REST_API_KEY || !REDIRECT_URI) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        },
        body: `
          <h2>카카오 설정 오류</h2>
          <p>카카오 환경변수가 설정되지 않았습니다.</p>
        `
      };
    }

    // 카카오 인증코드 → Access Token 교환
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: REST_API_KEY,
      redirect_uri: REDIRECT_URI,
      code
    });

    if (CLIENT_SECRET) {
      tokenBody.append("client_secret", CLIENT_SECRET);
    }

    const response = await fetch(
      "https://kauth.kakao.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=utf-8"
        },
        body: tokenBody
      }
    );

    const tokenData = await response.json();

    console.log(
      "Kakao token response:",
      JSON.stringify({
        ok: response.ok,
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token
      })
    );

    if (!response.ok || !tokenData.access_token) {
      console.error("Kakao token error:", tokenData);

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        },
        body: `
          <h2>카카오 토큰 발급 실패</h2>
          <p>카카오 인증은 되었지만 토큰 발급에 실패했습니다.</p>
          <p>Netlify Function 로그를 확인해주세요.</p>
        `
      };
    }

    // 토큰을 Netlify Blobs에 안전하게 저장
    await store.setJSON("kakao/admin-token", {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || "",
      token_type: tokenData.token_type || "bearer",
      expires_in: Number(tokenData.expires_in || 0),
      refresh_token_expires_in:
        Number(tokenData.refresh_token_expires_in || 0),
      savedAt: new Date().toISOString()
    });

    console.log("Kakao admin token saved.");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>카카오 관리자 인증 완료</title>
        </head>
        <body style="
          font-family: sans-serif;
          text-align: center;
          padding: 60px 20px;
        ">
          <h2>✅ 카카오 관리자 인증 완료</h2>
          <p>카카오 계정 인증 및 토큰 저장이 완료되었습니다.</p>
          <p>이제 카카오톡 알림 연결을 진행할 수 있습니다.</p>
        </body>
        </html>
      `
    };

  } catch (error) {
    console.error("Kakao callback error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      },
      body: `
        <h2>카카오 인증 처리 오류</h2>
        <p>${String(error.message || error)}</p>
      `
    };
  }
}
