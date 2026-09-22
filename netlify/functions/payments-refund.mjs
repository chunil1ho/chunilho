import {
  json,
  body,
  store
} from "./_lib.mjs";

import { verifyAdmin } from "./_auth.mjs";


/*
 * =========================================
 * PortOne 인증 토큰 발급
 * =========================================
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
      data.message ||
      "PortOne 인증에 실패했습니다."
    );
  }

  return data.response.access_token;
}


/*
 * =========================================
 * PortOne 결제정보 조회
 * =========================================
 */
async function getPayment(
  impUid,
  token
) {

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
 * =========================================
 * 실제 PortOne 환불
 * =========================================
 */
async function cancelPayment({
  token,
  impUid,
  amount,
  reason,
  checksum
}) {

  const response = await fetch(
    "https://api.iamport.kr/payments/cancel",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: token
      },

      body: JSON.stringify({
        imp_uid: impUid,
        amount,
        reason,
        checksum
      })
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
      "PortOne 결제 취소에 실패했습니다."
    );
  }

  return data.response;
}


/*
 * =========================================
 * Netlify Function
 * =========================================
 */
export async function handler(event) {

  /*
   * OPTIONS
   */
  if (event.httpMethod === "OPTIONS") {

    return {
      statusCode: 204,

      headers: {
        "Access-Control-Allow-Origin":
          "https://chunilho.com",

        "Access-Control-Allow-Methods":
          "POST, OPTIONS",

        "Access-Control-Allow-Headers":
          "Content-Type, Authorization"
      },

      body: ""
    };
  }


  /*
   * POST만 허용
   */
  if (event.httpMethod !== "POST") {

    return json(405, {
      ok: false,
      message: "POST 요청만 허용됩니다."
    });
  }


  /*
   * 관리자만 환불 가능
   */
  if (!verifyAdmin(event)) {

    return json(401, {
      ok: false,
      message: "관리자 인증이 필요합니다."
    });
  }


  /*
   * 환경변수 확인
   */
  if (
    !process.env.IMP_KEY ||
    !process.env.IMP_SECRET
  ) {

    return json(500, {
      ok: false,

      message:
        "IMP_KEY / IMP_SECRET 환경변수가 설정되지 않았습니다."
    });
  }


  try {

    /*
     * =====================================
     * 1. 요청 데이터
     * =====================================
     */
    const requestData =
      await body(event);

    const orderNo =
      String(
        requestData.orderNo || ""
      ).trim();

    const requestedAmount =
      Number(
        requestData.amount
      );

    const reason =
      String(
        requestData.reason ||
        "천일호 환불규정에 따른 환불"
      );


    if (!orderNo) {

      return json(400, {
        ok: false,
        message: "예약번호가 없습니다."
      });
    }


    if (
      !Number.isFinite(
        requestedAmount
      ) ||
      requestedAmount <= 0
    ) {

      return json(400, {
        ok: false,
        message: "환불금액이 올바르지 않습니다."
      });
    }


    /*
     * =====================================
     * 2. 예약 조회
     * =====================================
     */
    const key =
      "booking/" + orderNo;

    const booking =
      await store.get(
        key,
        {
          type: "json"
        }
      );


    if (!booking) {

      return json(404, {
        ok: false,
        message:
          "환불할 예약을 찾을 수 없습니다."
      });
    }


    /*
     * =====================================
     * 3. 결제번호 확인
     * =====================================
     */
    const impUid =
      String(
        booking.impUid || ""
      ).trim();


    if (!impUid) {

      return json(400, {
        ok: false,
        message:
          "예약에 결제번호(imp_uid)가 없습니다."
      });
    }


    /*
     * =====================================
     * 4. 예약 결제금액 확인
     * =====================================
     */
    const bookingPrice =
      Number(
        booking.price || 0
      );


    if (
      !Number.isFinite(
        bookingPrice
      ) ||
      bookingPrice <= 0
    ) {

      return json(400, {
        ok: false,
        message:
          "예약 결제금액을 확인할 수 없습니다."
      });
    }


    /*
     * =====================================
     * 5. PortOne 인증
     * =====================================
     */
    const token =
      await getPortOneToken();


    /*
     * =====================================
     * 6. 현재 PortOne 결제정보 조회
     * =====================================
     */
    const payment =
      await getPayment(
        impUid,
        token
      );


    console.log(
      "환불 전 PortOne 결제정보:",
      JSON.stringify(payment)
    );


    /*
     * =====================================
     * 7. 결제 상태 확인
     * =====================================
     */
    if (
      payment.status !== "paid"
    ) {

      return json(400, {
        ok: false,

        message:
          "현재 환불 가능한 결제 상태가 아닙니다.",
        
        paymentStatus:
          payment.status
      });
    }


    /*
     * =====================================
     * 8. 주문번호 일치 확인
     * =====================================
     */
    if (
      String(
        payment.merchant_uid
      ) !== orderNo
    ) {

      return json(400, {
        ok: false,
        message:
          "예약번호와 결제 주문번호가 일치하지 않습니다."
      });
    }


    /*
     * =====================================
     * 9. 실제 결제금액 확인
     * =====================================
     */
    const paidAmount =
      Number(
        payment.amount || 0
      );


    if (
      paidAmount !== bookingPrice
    ) {

      return json(400, {
        ok: false,

        message:
          "예약금액과 실제 결제금액이 일치하지 않습니다."
      });
    }


    /*
     * =====================================
     * 10. 환불 가능 금액 확인
     *
     * PortOne의 cancel_amount를 이용하여
     * 현재 남아 있는 환불 가능 금액 계산
     * =====================================
     */
    const cancelledAmount =
      Number(
        payment.cancel_amount || 0
      );

    const cancelableAmount =
      paidAmount - cancelledAmount;


    if (
      cancelableAmount <= 0
    ) {

      return json(400, {
        ok: false,
        message:
          "이미 전액 환불된 결제입니다."
      });
    }


    /*
     * =====================================
     * 11. 요청 환불금액 검증
     * =====================================
     */
    if (
      requestedAmount >
      cancelableAmount
    ) {

      return json(400, {
        ok: false,

        message:
          "환불금액이 현재 환불 가능 금액을 초과합니다.",

        cancelableAmount
      });
    }


    /*
     * =====================================
     * 12. 실제 PortOne 환불
     * =====================================
     */
    const refundResult =
      await cancelPayment({

        token,

        impUid,

        amount:
          requestedAmount,

        reason,

        checksum:
          cancelableAmount

      });


    console.log(
      "PortOne 환불 결과:",
      JSON.stringify(refundResult)
    );


    /*
     * =====================================
     * 13. 예약 정보 업데이트
     * =====================================
     */
const refundedAmount =
  Number(
    refundResult.cancel_amount ||
    requestedAmount
  );

const previousRefundAmount =
  Number(
    booking.refundAmount || 0
  );

const totalRefundAmount =
  previousRefundAmount +
  refundedAmount;

if (totalRefundAmount >= bookingPrice) {
  booking.status = "취소완료";
  booking.paymentStatus = "cancelled";
} else {
  booking.status = "부분환불";
  booking.paymentStatus = "partially_refunded";
}

booking.refundAmount =
  totalRefundAmount;

    booking.refundRequestedAt =
      new Date().toISOString();

    booking.refundReason =
      reason;

    booking.refundCompletedAt =
      refundResult.cancelled_at
        ? new Date(
            refundResult.cancelled_at * 1000
          ).toISOString()
        : new Date().toISOString();

    booking.paymentStatus =
      "cancelled";

    booking.updatedAt =
      new Date().toISOString();


    /*
     * =====================================
     * 14. 예약 저장
     * =====================================
     */
    await store.setJSON(
      key,
      booking
    );


    /*
     * =====================================
     * 15. 성공
     * =====================================
     */
    return json(200, {

      ok: true,

      message:
        "환불 처리가 완료되었습니다.",

      orderNo,

      refundAmount:
        refundedAmount,

      booking,

      payment: {

        impUid:
          payment.imp_uid,

        merchantUid:
          payment.merchant_uid,

        amount:
          payment.amount,

        status:
          payment.status

      }

    });

  } catch (error) {

    console.error(
      "환불 처리 오류:",
      error
    );


    return json(400, {

      ok: false,

      message:
        error?.message ||
        "환불 처리 중 오류가 발생했습니다."

    });
  }
}
