
/*
 * PortOne V1 Webhook
 * KICC Alipay Plus / WeChat Pay
 *
 * 결제 완료 알림을 받으면
 * 기존 payments-verify 함수에서
 * PortOne API로 실제 결제 상태를 재검증합니다.
 */

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  try {
    const payload = event.body
      ? JSON.parse(event.body)
      : {};

    const impUid = String(
      payload.imp_uid || ""
    ).trim();

    const merchantUid = String(
      payload.merchant_uid || ""
    ).trim();

    const status = String(
      payload.status || ""
    ).trim();

    // 결제 완료 이벤트만 처리
    if (status !== "paid") {
      return {
        statusCode: 200,
        body: "Ignored"
      };
    }

    if (!impUid || !merchantUid) {
      return {
        statusCode: 400,
        body: "Missing payment information"
      };
    }

    // 기존 결제 검증 함수 호출
    // 실제 결제 여부와 금액은 기존 함수가
    // PortOne API를 통해 다시 확인합니다.
    const verifyResponse = await fetch(
      "https://chunilho.netlify.app/.netlify/functions/payments-verify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          impUid,
          orderNo: merchantUid
        })
      }
    );

    const verifyResult =
      await verifyResponse.json();

    if (
      !verifyResponse.ok ||
      !verifyResult?.verified
    ) {
      console.error(
        "Webhook 결제 검증 실패:",
        verifyResult
      );

      return {
        statusCode: 500,
        body: "Payment verification failed"
      };
    }

    console.log(
      "Webhook 결제 검증 성공:",
      merchantUid
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: true,
        verified: true
      })
    };

  } catch (error) {
    console.error(
      "Webhook 처리 오류:",
      error
    );

    return {
      statusCode: 500,
      body: "Webhook processing error"
    };
  }
}
