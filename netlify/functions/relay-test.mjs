export default async (req) => {
  try {
    const relayUrl = process.env.ALIGO_RELAY_URL;
    const relaySecret = process.env.ALIGO_RELAY_SECRET;

    if (!relayUrl || !relaySecret) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Netlify 환경변수가 없습니다."
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const response = await fetch(
      relayUrl.replace(/\/$/, "") + "/send-payment-kakao",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-relay-secret": relaySecret
        },
        body: JSON.stringify({
          orderNo: "NETLIFY-TEST-20261013",
          name: "천일호 테스트",
          tel: "01012345678",
          date: "2026-10-20",
          course: "주간 체험낚시 2시간",
          time: "오전 10:00",
          count: 2,
          price: 60000
        })
      }
    );

    const result = await response.json();

    return new Response(
      JSON.stringify({
        ok: response.ok && result.ok,
        relayStatus: response.status,
        result
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
