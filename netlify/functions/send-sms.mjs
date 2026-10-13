export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({
          ok: false,
          message: "Method Not Allowed"
        })
      };
    }

    const {
      tel,
      name,
      date,
      course,
      time,
      count,
      price,
      orderNo
    } = JSON.parse(event.body || "{}");

    if (!tel || !name) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: "수신자 정보가 없습니다."
        })
      };
    }

    const relayUrl = process.env.ALIGO_RELAY_URL;
    const relaySecret = process.env.ALIGO_RELAY_SECRET;

    if (!relayUrl || !relaySecret) {
      console.error("알리고 릴레이 환경변수가 없습니다.");

      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          message: "알리고 릴레이 환경변수가 없습니다."
        })
      };
    }

    const response = await fetch(
      relayUrl.replace(/\/$/, "") + "/send-sms",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-relay-secret": relaySecret
        },
        body: JSON.stringify({
          tel,
          name,
          date,
          course,
          time,
          count,
          price,
          orderNo
        })
      }
    );

    const result = await response.json();

    console.log("===== 디지털오션 알리고 문자 릴레이 결과 =====");
    console.log(
      JSON.stringify({
        status: response.status,
        result
      })
    );

    if (!response.ok || !result.ok) {
      console.error(
        "알리고 문자 릴레이 발송 실패:",
        result
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: false,
          result
        })
      };
    }

    console.log("✅ 손님 문자 발송 성공");

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        result
      })
    };

  } catch (error) {
    console.error(
      "알리고 문자 릴레이 오류:",
      error
    );

    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        message: error.message
      })
    };
  }
}
