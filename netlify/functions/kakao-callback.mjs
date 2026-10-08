export default async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

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

    if (!REST_API_KEY || !CLIENT_SECRET || !REDIRECT_URI) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        },
        body: `
          <h2>환경변수 오류</h2>
          <p>카카오 환경변수가 설정되지 않았습니다.</p>
        `
      };
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: REST_API_KEY,
      redirect_uri: REDIRECT_URI,
      code: code,
      client_secret: CLIENT_SECRET
    });

    const response = await fetch(
      "https://kauth.kakao.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=utf-8"
        },
        body
      }
    );

    const tokenData = await response.json();

    if (!response.ok) {
      console.error("Kakao token error:", tokenData);

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        },
        body: `
          <h2>카카오 인증 실패</h2>
          <p>토큰 발급에 실패했습니다.</p>
          <p>Netlify Functions 로그를 확인해주세요.</p>
        `
      };
    }

    console.log("Kakao authentication successful.");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      },
      body: `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>카카오 인증 완료</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              text-align: center;
            }

            .box {
              max-width: 500px;
              margin: 50px auto;
              padding: 30px;
              border: 1px solid #ddd;
              border-radius: 15px;
            }

            h2 {
              margin-bottom: 15px;
            }
          </style>
        </head>

        <body>
          <div class="box">
            <h2>✅ 카카오 관리자 인증 완료</h2>
            <p>카카오 계정 인증이 정상적으로 완료되었습니다.</p>
            <p>이제 다음 단계에서 카카오톡 알림 기능을 연결합니다.</p>
          </div>
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
        <h2>오류가 발생했습니다.</h2>
        <p>Netlify Functions 로그를 확인해주세요.</p>
      `
    };
  }
};
