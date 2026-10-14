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

        const booking = JSON.parse(event.body || "{}");

        if (!booking.tel || !booking.name) {
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
            relayUrl.replace(/\/$/, "") + "/send-cancel-sms",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-relay-secret": relaySecret
                },
                body: JSON.stringify(booking)
            }
        );

        const result = await response.json();

        console.log("===== 고객 취소 문자 릴레이 결과 =====");
        console.log(
            JSON.stringify({
                status: response.status,
                result
            })
        );

        return {
            statusCode: response.status,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error(
            "고객 취소 문자 릴레이 오류:",
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
