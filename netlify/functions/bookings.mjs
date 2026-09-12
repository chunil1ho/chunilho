import {
  store,
  json,
  body,
  normalizeTel
} from "./_lib.mjs";

import { verifyAdmin } from "./_auth.mjs";

export async function handler(event) {
  const method = event.httpMethod;

  /*
   * ==========================================
   * GET
   * ==========================================
   *
   * 일반 사용자:
   *   /api/bookings?tel=01012345678
   *
   * 관리자:
   *   /api/bookings?admin=1
   */

  if (method === "GET") {
    const params = event.queryStringParameters || {};
    const isAdmin = params.admin === "1";

    // 관리자 조회
    if (isAdmin && !verifyAdmin(event)) {
      return json(401, {
        message: "관리자 인증이 필요합니다."
      });
    }

    const tel = normalizeTel(params.tel || "");

    let blobs;

    try {
      const result = await store.list({
        prefix: "booking/"
      });

      blobs = result?.blobs || [];
    } catch (error) {
      console.error("예약 목록 조회 오류:", error);

      return json(500, {
        message: "예약 데이터를 불러오지 못했습니다."
      });
    }

    const all = [];

    for (const blob of blobs) {
      try {
        const item = await store.get(blob.key, {
          type: "json"
        });

        if (item) {
          all.push(item);
        }
      } catch (error) {
        console.error(
          "예약 데이터 읽기 오류:",
          blob.key,
          error
        );
      }
    }

    // 최신 예약부터
    all.sort((a, b) =>
      String(b.createdAt || "").localeCompare(
        String(a.createdAt || "")
      )
    );

    // 관리자
    if (isAdmin) {
      return json(200, {
        bookings: all
      });
    }

    // 일반 사용자
    if (!tel) {
      return json(400, {
        message: "전화번호가 필요합니다."
      });
    }

    const filtered = all.filter(
      booking =>
        normalizeTel(booking.tel) === tel
    );

    return json(200, {
      bookings: filtered
    });
  }

  /*
   * ==========================================
   * POST
   * ==========================================
   *
   * 결제 검증이 끝난 예약 저장.
   *
   * 실제 결제 검증은 payments/verify.mjs에서
   * 처리하고, 여기서는 최종 예약 저장을 담당합니다.
   */

  if (method === "POST") {
    const data = await body(event);

    /*
     * 필수값 확인
     */
    if (
      !data.orderNo ||
      !data.date ||
      !data.course ||
      !data.name ||
      !data.tel ||
      !data.count ||
      data.price === undefined ||
      data.price === null
    ) {
      return json(400, {
        message: "필수 예약정보가 누락되었습니다."
      });
    }

    const orderNo = String(data.orderNo).trim();

    if (!orderNo) {
      return json(400, {
        message: "예약번호가 없습니다."
      });
    }

    const key = "booking/" + orderNo;

    /*
     * ==========================================
     * 중요
     *
     * 기존 index.html에서도 결제 검증 후
     * /api/bookings를 다시 호출하고 있기 때문에
     * 이미 저장된 주문번호라면 중복 저장 대신
     * 기존 예약을 그대로 반환합니다.
     *
     * 따라서 현재 index.html을 당장 수정하지 않아도
     * 중복 예약이 생성되지 않습니다.
     * ==========================================
     */

    try {
      const exists = await store.get(key, {
        type: "json"
      });

      if (exists) {
        return json(200, {
          ok: true,
          booking: exists,
          duplicate: true
        });
      }
    } catch (error) {
      console.error(
        "기존 예약 확인 오류:",
        error
      );

      return json(500, {
        message: "기존 예약 확인에 실패했습니다."
      });
    }

    /*
     * 신규 저장은 서버 결제검증 완료 상태만 허용
     */
    if (data.paymentStatus !== "paid") {
      return json(400, {
        message:
          "결제 검증이 완료된 예약만 저장할 수 있습니다."
      });
    }

    if (data.paymentVerified !== true) {
      return json(400, {
        message:
          "서버 결제검증 정보가 없습니다."
      });
    }

    const cleanTel = normalizeTel(data.tel);

    const booking = {
      orderNo,

      date: String(data.date),

      course: String(data.course),

      time: String(data.time || ""),

      count: Number(data.count),

      name: String(data.name),

      tel: cleanTel,

      price: Number(data.price),

      status: "결제완료",

      paymentStatus: "paid",

      paymentVerified: true,

      impUid: String(data.impUid || ""),

      createdAt: new Date().toISOString()
    };

    /*
     * 데이터 유효성 추가 확인
     */

    if (!booking.count || booking.count < 1) {
      return json(400, {
        message: "예약 인원이 올바르지 않습니다."
      });
    }

    if (!booking.price || booking.price < 1) {
      return json(400, {
        message: "예약 금액이 올바르지 않습니다."
      });
    }

    if (!booking.tel) {
      return json(400, {
        message: "전화번호가 올바르지 않습니다."
      });
    }

    /*
     * Netlify Blobs 저장
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

      return json(500, {
        message:
          "예약 저장 중 서버 오류가 발생했습니다."
      });
    }

    return json(201, {
      ok: true,
      booking
    });
  }

  /*
   * ==========================================
   * PATCH
   * ==========================================
   *
   * 관리자 예약 상태 변경
   */

  if (method === "PATCH") {
    if (!verifyAdmin(event)) {
      return json(401, {
        message: "관리자 인증이 필요합니다."
      });
    }

    const path = event.path || "";

    const parts = path.split("/");

    const orderNo = decodeURIComponent(
      parts[parts.length - 1] || ""
    );

    if (!orderNo) {
      return json(400, {
        message: "예약번호가 없습니다."
      });
    }

    const key = "booking/" + orderNo;

    let current;

    try {
      current = await store.get(key, {
        type: "json"
      });
    } catch (error) {
      console.error(
        "예약 조회 오류:",
        error
      );

      return json(500, {
        message: "예약 조회에 실패했습니다."
      });
    }

    if (!current) {
      return json(404, {
        message: "예약을 찾을 수 없습니다."
      });
    }

    const data = await body(event);

    if (data.status) {
      current.status = String(data.status);
    }

    current.updatedAt =
      new Date().toISOString();

    try {
      await store.setJSON(
        key,
        current
      );
    } catch (error) {
      console.error(
        "예약 상태 저장 오류:",
        error
      );

      return json(500, {
        message:
          "예약 상태 변경에 실패했습니다."
      });
    }

    return json(200, {
      ok: true,
      booking: current
    });
  }

  /*
   * ==========================================
   * 기타 메서드
   * ==========================================
   */

  return json(405, {
    message: "Method Not Allowed"
  });
}
