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
            relayUrl.replace(/\/$/, "") + "/send-cancel-kakao",
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

        console.log("===== 관리자 취소 알림톡 릴레이 결과 =====");
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
            "관리자 취소 알림톡 릴레이 오류:",
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
