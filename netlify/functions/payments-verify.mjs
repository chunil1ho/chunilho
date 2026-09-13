import {
  json,
  body,
  store,
  normalizeTel
} from "./_lib.mjs";


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
      data.message || "PortOne 결제정보 조회에 실패했습니다."
    );
  }

  return data.response;
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
    throw new Error("예약 날짜가 없습니다.");
  }

  if (!booking.course) {
    throw new Error("예약 코스가 없습니다.");
  }

  if (!booking.name) {
    throw new Error("예약자명이 없습니다.");
  }

  if (!booking.tel) {
    throw new Error("전화번호가 없습니다.");
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
   *
   * 실제 결제 요청은 POST이지만
   * 브라우저/Netlify 환경에서 OPTIONS가 들어와도
   * 405가 발생하지 않도록 처리합니다.
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
   * ------------------------------------------
   */
  const data = await body(event);


  /*
   * ------------------------------------------
   * 결제 검증 필수값
   * ------------------------------------------
   */
  if (
    !data.impUid ||
    !data.orderNo ||
    data.expectedAmount === undefined ||
    data.expectedAmount === null
  ) {
    return json(400, {
      ok: false,
      verified: false,
      message:
        "결제 검증 정보가 누락되었습니다."
    });
  }


  /*
   * ------------------------------------------
   * 예약 필수값
   * ------------------------------------------
   */
  if (
    !data.date ||
    !data.course ||
    !data.name ||
    !data.tel ||
    !data.count
  ) {
    return json(400, {
      ok: false,
      verified: false,
      message:
        "예약정보가 누락되었습니다."
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
        data.impUid,
        token
      );


    /*
     * ========================================
     * 3. 결제 상태 확인
     * ========================================
     */
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
      String(data.orderNo)
    ) {
      throw new Error(
        "주문번호가 일치하지 않습니다."
      );
    }


    /*
     * ========================================
     * 5. 실제 결제금액 확인
     * ========================================
     */
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
     * 6. 예약 저장
     * ========================================
     */
    const result =
      await saveBooking(
        data,
        payment
      );


    /*
     * ========================================
     * 7. 성공
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
