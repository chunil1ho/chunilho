import { store } from "./_lib.mjs";

export async function handler(event) {
  try {
    // GET으로 테스트할 수 있게 구성
    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        },
        body: "GET 요청만 사용할 수 있습니다."
      };
    }

    // 저장된 카카오 토큰 가져오기
    const tokenData = await store.getJSON("kakao/admin-token");

    if (!tokenData || !tokenData.access_token) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        },
        body: "카카오 관리자 토큰이 없습니다. 먼저 카카오 인증을 진행해주세요."
      };
    }

    const templateObject = {
      object_type: "text",
      text: "🎣 천일호 테스트 알림\n\n카카오톡 자동 알림 연결이 정상적으로 작동하고 있습니다.",
      link: {
        web_url: "https://chunilho.com",
        mobile_web_url: "https://chunilho.com"
      },
      button_title: "천일호 홈페이지"
    };

    const response = await fetch(
      "https://kapi.kakao.com/v2/api/talk/memo/default/send",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
        },
        body: new URLSearchParams({
          template_object: JSON.stringify(templateObject)
        })
      }
    );

    const result = await response.json();

    console.log(
      "Kakao send result:",
      JSON.stringify({
        ok: response.ok,
        status: response.status,
        result
      })
    );

    if (!response.ok) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        },
        body: `
          <h2>❌ 카카오톡 발송 실패</h2>
          <p>HTTP 상태: ${response.status}</p>
          <pre>${JSON.stringify(result, null, 2)}</pre>
        `
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      },
      body: `
        <h2>✅ 카카오톡 테스트 발송 성공</h2>
        <p>관리자 카카오톡으로 테스트 메시지를 보냈습니다.</p>
        <p>카카오톡을 확인해주세요.</p>
      `
    };

  } catch (error) {
    console.error("Kakao send error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      },
      body: `
        <h2>❌ 오류 발생</h2>
        <pre>${String(error.message || error)}</pre>
      `
    };
  }
}
