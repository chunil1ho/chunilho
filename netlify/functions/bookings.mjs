import { store, json, body, normalizeTel } from "./_lib.mjs";
import { verifyAdmin } from "./_auth.mjs";

export async function handler(event) {
  const method = event.httpMethod;

  if (method === "GET") {
    const isAdmin = event.queryStringParameters?.admin === "1";

    if (isAdmin && !verifyAdmin(event)) {
      return json(401, { message: "관리자 인증이 필요합니다." });
    }

    const tel = normalizeTel(event.queryStringParameters?.tel || "");

    const { blobs } = await store.list({ prefix: "booking/" });
    const all = [];

    for (const b of blobs) {
      const item = await store.get(b.key, { type: "json" });
      if (item) all.push(item);
    }

    all.sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );

    if (isAdmin) {
      return json(200, { bookings: all });
    }

    if (!tel) {
      return json(400, { message: "전화번호가 필요합니다." });
    }

    return json(200, {
      bookings: all.filter(
        b => normalizeTel(b.tel) === tel
      )
    });
  }

  if (method === "POST") {
    const data = await body(event);

    if (
      !data.orderNo ||
      !data.date ||
      !data.course ||
      !data.name ||
      !data.tel ||
      !data.count ||
      !data.price
    ) {
      return json(400, {
        message: "필수 예약정보가 누락되었습니다."
      });
    }

    if (data.paymentStatus !== "paid") {
      return json(400, {
        message: "결제 검증이 완료된 예약만 저장할 수 있습니다."
      });
    }

    if (!data.paymentVerified) {
      return json(400, {
        message: "서버 결제검증 정보가 없습니다."
      });
    }

    const key = "booking/" + data.orderNo;
    const exists = await store.get(key, { type: "json" });

    if (exists) {
      return json(200, {
        booking: exists,
        duplicate: true
      });
    }

    const booking = {
      orderNo: String(data.orderNo),
      date: String(data.date),
      course: String(data.course),
      time: String(data.time || ""),
      count: Number(data.count),
      name: String(data.name),
      tel: normalizeTel(data.tel),
      price: Number(data.price),
      status: "결제완료",
      impUid: String(data.impUid || ""),
      createdAt: new Date().toISOString()
    };

    await store.setJSON(key, booking);

    return json(201, { booking });
  }

  if (method === "PATCH") {
    if (!verifyAdmin(event)) {
      return json(401, {
        message: "관리자 인증이 필요합니다."
      });
    }

    const orderNo = event.path.split("/").pop();
    const key = "booking/" + decodeURIComponent(orderNo);

    const current = await store.get(key, { type: "json" });

    if (!current) {
      return json(404, {
        message: "예약을 찾을 수 없습니다."
      });
    }

    const data = await body(event);

    current.status = data.status || current.status;
    current.updatedAt = new Date().toISOString();

    await store.setJSON(key, current);

    return json(200, { booking: current });
  }

  return json(405, {
    message: "Method Not Allowed"
  });
}
