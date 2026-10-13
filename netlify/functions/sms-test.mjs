export async function handler() {
  try {
    const relayUrl = process.env.ALIGO_RELAY_URL;
    const relaySecret = process.env.ALIGO_RELAY_SECRET;

    const response = await fetch(
      relayUrl.replace(/\/$/, "") + "/send-sms",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-relay-secret": relaySecret
        },
        body: JSON.stringify({
          tel: "01077685913",
          name: "천일호 테스트",
          date: "2026-10-20",
          course: "주간 체험낚시 2시간",
          time: "오전 10:00",
          count: 2,
          price: 60000,
          orderNo: "SMS-TEST-20261013"
        })
      }
    );

    const result = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: response.ok && result.ok,
        relayStatus: response.status,
        result
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: error.message
      })
    };
  }
}
