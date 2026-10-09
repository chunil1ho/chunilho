import {
  json,
  body,
  store,
  normalizeTel
} from "./_lib.mjs";
/*
 * ==========================================
 * 카카오톡 관리자 알림
 * ==========================================
 */
async function sendKakaoAdminMessage(booking) {
  try {
    const tokenData = await store.get(
      "kakao/admin-token",
      { type: "json" }
    );

    if (!tokenData?.access_token) {
      console.error(
        "카카오 관리자 토큰이 없습니다."
      );
      return false;
    }

    const templateObject = {
      object_type: "text",
      text:
        "🎣 천일호 신규 예약 알림\n\n" +
        `예약번호: ${booking.orderNo}\n\n` +
        `예약자: ${booking.name}\n` +
        `전화번호: ${booking.tel}\n\n` +
        `이용일: ${booking.date}\n` +
        `상품: ${booking.course}\n` +
        `시간: ${booking.time || "미정"}\n` +
        `인원: ${booking.count}명\n\n` +
        `결제금액: ${Number(booking.price).toLocaleString()}원\n\n` +
        "✅ 결제 완료",
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
          "Authorization":
            `Bearer ${tokenData.access_token}`,
          "Content-Type":
            "application/x-www-form-urlencoded;charset=utf-8"
        },
        body: new URLSearchParams({
          template_object:
            JSON.stringify(templateObject)
        })
      }
    );

    const result = await response.json();

    console.log(
      "카카오 관리자 알림 결과:",
      JSON.stringify({
        ok: response.ok,
        status: response.status,
        result
      })
    );

    if (!response.ok) {
      console.error(
        "카카오 관리자 알림 발송 실패:",
        result
      );

      return false;
    }

    return true;

  } catch (error) {
    console.error(
      "카카오 관리자 알림 오류:",
      error
    );

    return false;
  }
}

/*
 * ==========================================
 * PortOne 인증 토큰 발급
 * ==========================================
 */
async function getPortOneToken() {
  const impKey = process.env.IMP_KEY;
  const impSecret = process.env.IMP_SECRET;

  if (!impKey || !impSecret) {
    throw new Error(
      "IMP_KEY / IMP_SECRET 환경변수가 설정되지 않았습니다."
    );
  }

  const response = await fetch(
    "https://api.iamport.kr/users/getToken",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        imp_key: impKey,
        imp_secret: impSecret
      })
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    data.code !== 0 ||
    !data.response?.access_token
  ) {
    throw new Error(
      data.message || "PortOne 인증에 실패했습니다."
    );
  }

  return data.response.access_token;
}


/*
 * ==========================================
 * PortOne 실제 결제정보 조회
 * ==========================================
 */
async function getPayment(impUid, token) {
  const response = await fetch(
    `https://api.iamport.kr/payments/${encodeURIComponent(
      impUid
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: token
      }
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    data.code !== 0 ||
    !data.response
  ) {
    throw new Error(
      data.message ||
      "PortOne 결제정보 조회에 실패했습니다."
    );
  }

  return data.response;
}


/*
 * ==========================================
 * custom_data 예약정보 복원
 * ==========================================
 */
function parseCustomData(payment) {
  const customData = payment?.custom_data;

  if (!customData) {
    return null;
  }

  if (typeof customData === "object") {
    return customData;
  }

if (typeof customData === "string") {
  try {
    let parsed = JSON.parse(customData);

    // custom_data가 JSON 문자열 안에
    // JSON 문자열로 한 번 더 들어있는 경우
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    return parsed;
  } catch (error) {
    console.error(
      "PortOne custom_data JSON 파싱 오류:",
      error
    );

    throw new Error(
      "결제에 저장된 예약정보를 읽을 수 없습니다."
    );
  }
}

  return null;
}


/*
 * ==========================================
 * 예약 저장
 * ==========================================
 */
async function saveBooking(data, payment) {
  const orderNo = String(data.orderNo || "").trim();

  if (!orderNo) {
    throw new Error("주문번호가 없습니다.");
  }

  const key = "booking/" + orderNo;


  /*
   * ------------------------------------------
   * 이미 저장된 예약인지 확인
   * ------------------------------------------
   */
  let existing = null;

  try {
    existing = await store.get(
      key,
      {
        type: "json"
      }
    );
  } catch (error) {
    console.error(
      "기존 예약 확인 오류:",
      error
    );

    throw new Error(
      "기존 예약 확인 중 서버 오류가 발생했습니다."
    );
  }


  /*
   * 이미 저장되어 있으면 중복 저장하지 않음
   */
  if (existing) {
    return {
      booking: existing,
      duplicate: true
    };
  }


  /*
   * ------------------------------------------
   * 예약 데이터 생성
   * ------------------------------------------
   */
  const booking = {
    orderNo,

    date: String(data.date || ""),

    course: String(data.course || ""),

    time: String(data.time || ""),

    count: Number(data.count),

    name: String(data.name || ""),

    tel: normalizeTel(data.tel),

    price: Number(data.expectedAmount),

    status: "결제완료",

    paymentStatus: "paid",

    paymentVerified: true,

    impUid: String(
      payment.imp_uid ||
      data.impUid ||
      ""
    ),

    createdAt: new Date().toISOString()
  };


  /*
   * ------------------------------------------
   * 예약 데이터 검증
   * ------------------------------------------
   */
  if (!booking.date) {
    throw new Error(
      "예약 날짜가 없습니다."
    );
  }

  if (!booking.course) {
    throw new Error(
      "예약 코스가 없습니다."
    );
  }

  if (!booking.name) {
    throw new Error(
      "예약자명이 없습니다."
    );
  }

  if (!booking.tel) {
    throw new Error(
      "전화번호가 없습니다."
    );
  }

  if (
    !Number.isFinite(booking.count) ||
    booking.count < 1
  ) {
    throw new Error(
      "예약 인원이 올바르지 않습니다."
    );
  }

  if (
    !Number.isFinite(booking.price) ||
    booking.price < 1
  ) {
    throw new Error(
      "예약 금액이 올바르지 않습니다."
    );
  }

  if (!booking.impUid) {
    throw new Error(
      "결제번호(imp_uid)가 없습니다."
    );
  }


  /*
   * ------------------------------------------
   * Netlify Blobs 저장
   * ------------------------------------------
   */
  try {
    await store.setJSON(
      key,
      booking
    );
  } catch (error) {
    console.error(
      "예약 저장 오류:",
      error
    );

    throw new Error(
      "결제 검증은 완료되었지만 예약 저장에 실패했습니다."
    );
  }


  return {
    booking,
    duplicate: false
  };
}


/*
 * ==========================================
 * Netlify Function
 * ==========================================
 */
export async function handler(event) {

  /*
   * OPTIONS 요청 허용
   */
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization"
      },
      body: ""
    };
  }


  /*
   * 결제 검증은 POST만 허용
   */
  if (event.httpMethod !== "POST") {
    return json(405, {
      ok: false,
      verified: false,
      message: "POST 요청만 허용됩니다."
    });
  }


  /*
   * ------------------------------------------
   * PortOne 환경변수 확인
   * ------------------------------------------
   */
  if (
    !process.env.IMP_KEY ||
    !process.env.IMP_SECRET
  ) {
    return json(500, {
      ok: false,
      verified: false,
      message:
        "IMP_KEY / IMP_SECRET 환경변수가 설정되지 않았습니다."
    });
  }


  /*
   * ------------------------------------------
   * 요청 데이터
   *
   * 이제 모바일에서는
   * impUid + orderNo만 보내도 됩니다.
   * ------------------------------------------
   */
  const requestData = await body(event);


  if (
    !requestData.impUid ||
    !requestData.orderNo
  ) {
    return json(400, {
      ok: false,
      verified: false,
      message:
        "결제 검증 정보가 누락되었습니다."
    });
  }


  try {

    /*
     * ========================================
     * 1. PortOne 인증
     * ========================================
     */
    const token =
      await getPortOneToken();


/*
 * ========================================
 * 2. 실제 결제정보 조회
 * ========================================
 */
const payment =
  await getPayment(
    requestData.impUid,
    token
  );

/*
 * ========================================
 * 3. 결제 상태 확인
 * ========================================
 */

console.log(
  "PortOne 결제 조회 결과:",
  JSON.stringify(payment)
);

if (payment.status !== "paid") {
  throw new Error(
    "결제가 완료 상태가 아닙니다."
  );
}


    /*
     * ========================================
     * 4. 주문번호 확인
     * ========================================
     */
    if (
      String(payment.merchant_uid) !==
      String(requestData.orderNo)
    ) {
      throw new Error(
        "주문번호가 일치하지 않습니다."
      );
    }


    /*
     * ========================================
     * 5. PortOne에 저장된 custom_data 복원
     * ========================================
     */
    const customData =
      parseCustomData(payment);

console.log(
  "PortOne custom_data:",
  JSON.stringify(customData)
);
    
    if (!customData) {
      throw new Error(
        "결제에 저장된 예약정보를 찾을 수 없습니다."
      );
    }


    /*
     * ========================================
     * 6. custom_data 주문번호 확인
     * ========================================
     */
    if (
      customData.orderNo &&
      String(customData.orderNo) !==
        String(payment.merchant_uid)
    ) {
      throw new Error(
        "예약 주문번호가 결제 주문번호와 일치하지 않습니다."
      );
    }


    /*
     * ========================================
     * 7. 예약정보 구성
     *
     * 모바일:
     * custom_data에서 복원
     *
     * PC:
     * 기존 요청값이 있다면 그대로 사용
     * ========================================
     */
    const data = {

      impUid:
        requestData.impUid,

      orderNo:
        payment.merchant_uid,

      date:
        requestData.date ||
        customData.date,

      course:
        requestData.course ||
        customData.course,

      time:
        requestData.time ||
        customData.time,

      count:
        requestData.count ??
        customData.count,

      name:
        requestData.name ||
        customData.name,

      tel:
        requestData.tel ||
        customData.tel,

      expectedAmount:
        requestData.expectedAmount ??
        customData.expectedAmount
    };

    console.log(
  "최종 예약 데이터:",
  JSON.stringify(data)
);

    /*
     * ========================================
     * 8. 예약정보 필수값 확인
     * ========================================
     */
    if (
      !data.date ||
      !data.course ||
      !data.name ||
      !data.tel ||
      !data.count
    ) {
      throw new Error(
        "결제에 저장된 예약정보가 완전하지 않습니다."
      );
    }


    /*
     * ========================================
     * 9. 결제금액 확인
     * ========================================
     */
    if (
      data.expectedAmount === undefined ||
      data.expectedAmount === null
    ) {
      throw new Error(
        "예약 결제금액 정보를 찾을 수 없습니다."
      );
    }


    if (
      Number(payment.amount) !==
      Number(data.expectedAmount)
    ) {
      throw new Error(
        `결제금액이 일치하지 않습니다. 실제 결제금액: ${payment.amount}원 / 예약금액: ${data.expectedAmount}원`
      );
    }


    /*
     * ========================================
     * 10. 예약 저장
     * ========================================
     */
    const result =
      await saveBooking(
        data,
        payment
      );
let kakaoNotified = false;

if (!result.duplicate) {
  kakaoNotified =
    await sendKakaoAdminMessage(result.booking);
}
    /*
     * ========================================
     * 11. 성공
     * ========================================
     */
    return json(200, {

      ok: true,

      verified: true,

      duplicate:
        result.duplicate,

      payment: {

        impUid:
          payment.imp_uid,

        merchantUid:
          payment.merchant_uid,

        amount:
          payment.amount,

        status:
          payment.status

      },

      booking:
        result.booking

    });


  } catch (error) {

    console.error(
      "결제 검증 오류:",
      error
    );


    /*
     * 결제 검증 실패
     */
    return json(400, {

      ok: false,

      verified: false,

      message:
        error?.message ||
        "결제 검증에 실패했습니다."

    });

  }
}
