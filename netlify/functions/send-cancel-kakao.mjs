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
            orderNo,
            name,
            tel,
            date,
            course,
            time,
            count,
            price
        } = JSON.parse(event.body || "{}");

        const apiKey = process.env.ALIGO_API_KEY;
        const userId = process.env.ALIGO_USER_ID;
        const senderKey = process.env.ALIGO_SENDER_KEY;

        if (!apiKey || !userId || !senderKey) {
            console.error("알리고 알림톡 환경변수가 없습니다.");

            return {
                statusCode: 500,
                body: JSON.stringify({
                    ok: false,
                    message: "알리고 환경변수가 없습니다."
                })
            };
        }

        const formData = new URLSearchParams();

        formData.append("apikey", apiKey);
        formData.append("userid", userId);
        formData.append("senderkey", senderKey);

        // 취소 알림톡 템플릿
        formData.append("tpl_code", "UM_4486");

        // 알리고에 등록된 발신번호
        formData.append("sender", "01021040008");

        // 관리자 수신번호
        formData.append("receiver_1", "01077685913");
        formData.append("recvname_1", "천일호");
        formData.append("subject_1", "천일호 예약 취소");

        formData.append(
            "message_1",
            "🎣 천일호 예약 취소 안내\n\n" +
            `예약번호: ${orderNo || ""}\n` +
            `예약자: ${name || ""}\n` +
            `전화번호: ${tel || ""}\n` +
            `이용일: ${date || ""}\n` +
            `상품: ${course || ""}\n` +
            `시간: ${time || "미정"}\n` +
            `인원: ${count || 0}명\n` +
            `결제금액: ${Number(price || 0).toLocaleString()}원\n\n` +
            "예약이 취소되었습니다."
        );

        const response = await fetch(
            "https://kakaoapi.aligo.in/akv10/alimtalk/send/",
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

        console.log("===== 관리자 취소 알림톡 발송 결과 =====");
        console.log(
            JSON.stringify({
                status: response.status,
                result
            })
        );

        if (Number(result.code) !== 0) {
            console.error(
                "관리자 취소 알림톡 발송 실패:",
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

        console.log("✅ 관리자 취소 알림톡 발송 성공");

        return {
            statusCode: 200,
            body: JSON.stringify({
                ok: true,
                result
            })
        };

    } catch (error) {
        console.error(
            "관리자 취소 알림톡 오류:",
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
