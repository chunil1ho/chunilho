import {
  json,
  body,
  store,
  normalizeTel
} from "./_lib.mjs";

async function getPortOneToken() {
  const impKey = process.env.IMP_KEY;
  const impSecret = process.env.IMP_SECRET;

  if (!impKey || !impSecret) {
    throw new Error(
      "IMP_KEY / IMP_SECRET 환경변수가 필요합니다."
    );
  }

  const r = await fetch(
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

  const d = await r.json();

  if (
    !r.ok ||
    d.code !== 0 ||
    !d.response?.access_token
  ) {
    throw new Error(
      d.message || "PortOne 인증 실패"
    );
  }

  return d.response.access_token;
}

async function getPayment(impUid, token) {
  const r = await fetch(
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

  const d = await r.json();

  if (
    !r.ok ||
    d.code !== 0 ||
    !d.response
  ) {
    throw new Error(
      d.message || "결제 조회 실패"
    );
  }

  return d.response;
}

async function saveBooking(data, payment) {
  const orderNo = String(data.orderNo).trim();

  const key = "booking/" + orderNo;

  /*
   * 이미 저장된 예약이면 중복 저장하지 않음
   */
  const existing = await store.get(
    key,
    {
      type: "json"
    }
  );

  if (existing) {
    return {
      booking: existing,
      duplicate: true
    };
  }

  const booking = {
    orderNo,

    date: String(data.date),

    course: String(data.course),

    time: String(data.time || ""),

    count: Number(data.count),

    name: String(data.name),

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

    createdAt:
      new Date().toISOString()
  };

  /*
   * 예약 데이터 최종 확인
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
    !booking.count ||
    booking.count < 1
  ) {
    throw new Error(
      "예약 인원이 올바르지 않습니다."
    );
  }

  if (
    !booking.price ||
    booking.price < 1
  ) {
    throw new Error(
      "예약 금액이 올바르지 않습니다."
    );
  }

  /*
   * Netlify Blobs에 직접 저장
   */
  await store.setJSON(
    key,
    booking
  );

  return {
    booking,
    duplicate: false
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, {
      message: "Method Not Allowed"
    });
  }

  if (
    !process.env.IMP_KEY ||
    !process.env.IMP_SECRET
  ) {
    return json(500, {
      message:
        "IMP_KEY / IMP_SECRET 환경변수가 필요합니다."
    });
  }

  const data = await body(event);

  /*
   * 결제 검증에 필요한 값
   */
  if (
    !data.impUid ||
    !data.orderNo ||
    data.expectedAmount === undefined ||
    data.expectedAmount === null
  ) {
    return json(400, {
      message:
        "결제 검증 정보가 누락되었습니다."
    });
  }

  /*
   * 예약 정보 확인
   */
  if (
    !data.date ||
    !data.course ||
    !data.name ||
    !data.tel ||
    !data.count
  ) {
    return json(400, {
      message:
        "예약정보가 누락되었습니다."
    });
  }

  try {
    /*
     * 1. PortOne 인증
     */
    const token =
      await getPortOneToken();

    /*
     * 2. 실제 결제정보 조회
     */
    const payment =
      await getPayment(
        data.impUid,
        token
      );

    /*
     * 3. 결제 상태 확인
     */
    if (payment.status !== "paid") {
      throw new Error(
        "결제가 완료 상태가 아닙니다."
      );
    }

    /*
     * 4. 주문번호 확인
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
     * 5. 실제 결제금액 확인
     */
    if (
      Number(payment.amount) !==
      Number(data.expectedAmount)
    ) {
      throw new Error(
        "결제금액이 예약금액과 일치하지 않습니다."
      );
    }

    /*
     * 6. 서버 검증 완료
     *
     * 여기서 바로 Netlify Blobs에 저장합니다.
     *
     * 기존처럼 /api/bookings를 다시 호출하지 않습니다.
     */
    const result =
      await saveBooking(
        data,
        payment
      );

    /*
     * 7. 성공 응답
     */
    return json(200, {
      ok: true,
      verified: true,
      duplicate: result.duplicate,

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

  } catch (e) {
    console.error(
      "결제 검증 오류:",
      e
    );

    return json(400, {
      ok: false,
      verified: false,
      message:
        e.message ||
        "결제 검증 실패"
    });
  }
}
