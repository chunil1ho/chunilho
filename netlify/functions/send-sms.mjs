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

    const apiKey = process.env.ALIGO_API_KEY;
    const userId = process.env.ALIGO_USER_ID;

    if (!apiKey || !userId) {
      console.error("알리고 문자 환경변수가 없습니다.");

      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          message: "알리고 환경변수가 없습니다."
        })
      };
    }

const message =
  `🎣 천일호 예약 결제 완료\n` +
  `예약번호: ${booking?.orderNo || ""}\n` +
  `예약자: ${name}\n` +
  `전화번호: ${tel}\n` +
  `이용일: ${date}\n` +
  `상품: ${course}\n` +
  `시간: ${time || "미정"}\n` +
  `인원: ${count}명\n` +
  `결제금액: ${Number(price).toLocaleString()}원\n\n` +
  `결제가 완료되었습니다.\n` +
  `업체 연락 후 예약이 최종 확정됩니다.`;

    const formData = new URLSearchParams();

    formData.append("key", apiKey);
    formData.append("user_id", userId);

    // 알리고에 등록된 발신번호
    formData.append("sender", "01021040008");

    // 손님 전화번호
    formData.append(
      "receiver",
      String(tel).replace(/-/g, "")
    );

    formData.append("msg", message);

    // 90byte 초과 가능성이 있으므로 LMS
    formData.append("msg_type", "LMS");

    formData.append(
      "title",
      "천일호 예약 및 결제 완료"
    );

    const response = await fetch(
      "https://apis.aligo.in/send/",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: formData
      }
    );

    const result = await response.json();

    console.log("===== 알리고 문자 발송 결과 =====");
    console.log(
      JSON.stringify({
        status: response.status,
        result
      })
    );

    if (Number(result.result_code) < 0) {
      console.error(
        "알리고 문자 발송 실패:",
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
      "알리고 문자 오류:",
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
