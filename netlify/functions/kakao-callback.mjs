export async function handler(event) {
  try {

    // 카카오가 전달한 인증 코드
    const code =
      event.queryStringParameters?.code;

    if (!code) {
      return new Response(
        `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>카카오 인증 실패</title>
        </head>
        <body>
          <h2>카카오 인증 실패</h2>
          <p>인증 코드(code)를 받지 못했습니다.</p>
        </body>
        </html>
        `,
        {
          status: 400,
          headers: {
            "Content-Type":
              "text/html; charset=utf-8"
          }
        }
      );
    }

    const REST_API_KEY =
      process.env.KAKAO_REST_API_KEY;

    const CLIENT_SECRET =
      process.env.KAKAO_CLIENT_SECRET;

    const REDIRECT_URI =
      process.env.KAKAO_REDIRECT_URI;

    if (
      !REST_API_KEY ||
      !CLIENT_SECRET ||
      !REDIRECT_URI
    ) {
      return new Response(
        `
        <h2>환경변수 오류</h2>
        <p>카카오 환경변수가 설정되지 않았습니다.</p>
        `,
        {
          status: 500,
          headers: {
            "Content-Type":
              "text/html; charset=utf-8"
          }
        }
      );
    }

    // 카카오 액세스 토큰 요청
    const tokenBody =
      new URLSearchParams({
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
        body: tokenBody
      }
    );

    const tokenData =
      await response.json();

    if (!response.ok) {
      console.error(
        "Kakao token error:",
        tokenData
      );

      return new Response(
        `
        <h2>카카오 인증 실패</h2>
        <p>카카오 토큰 발급에 실패했습니다.</p>
        <p>Netlify Functions 로그를 확인해주세요.</p>
        `,
        {
          status: 500,
          headers: {
            "Content-Type":
              "text/html; charset=utf-8"
          }
        }
      );
    }

    console.log(
      "Kakao authentication successful."
    );

    return new Response(
      `
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
          <p>이제 카카오톡 알림 연결을 진행할 수 있습니다.</p>
        </div>
      </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/html; charset=utf-8"
        }
      }
    );

  } catch (error) {

    console.error(
      "Kakao callback error:",
      error
    );

    return new Response(
      `
      <h2>오류가 발생했습니다.</h2>
      <p>Netlify Functions 로그를 확인해주세요.</p>
      `,
      {
        status: 500,
        headers: {
          "Content-Type":
            "text/html; charset=utf-8"
        }
      }
    );
  }
}
