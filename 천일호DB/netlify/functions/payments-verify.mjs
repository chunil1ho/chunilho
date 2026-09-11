import { json, body } from "./_lib.mjs";

async function getPortOneToken() {
  const r = await fetch("https://api.iamport.kr/users/getToken", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imp_key: process.env.IMP_KEY, imp_secret: process.env.IMP_SECRET })
  });
  const d = await r.json();
  if (!r.ok || d.code !== 0 || !d.response?.access_token) throw new Error(d.message || "PortOne 인증 실패");
  return d.response.access_token;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { message: "Method Not Allowed" });
  if (!process.env.IMP_KEY || !process.env.IMP_SECRET) return json(500, { message: "IMP_KEY / IMP_SECRET 환경변수가 필요합니다." });
  const data = await body(event);
  if (!data.impUid || !data.orderNo || !data.expectedAmount) return json(400, { message: "결제 검증 정보가 누락되었습니다." });
  try {
    const token = await getPortOneToken();
    const r = await fetch(`https://api.iamport.kr/payments/${encodeURIComponent(data.impUid)}`, { headers: { Authorization: token } });
    const p = await r.json();
    if (!r.ok || p.code !== 0 || !p.response) throw new Error(p.message || "결제 조회 실패");
    const payment = p.response;
    if (payment.status !== "paid") throw new Error("결제가 완료 상태가 아닙니다.");
    if (payment.merchant_uid !== data.orderNo) throw new Error("주문번호가 일치하지 않습니다.");
    if (Number(payment.amount) !== Number(data.expectedAmount)) throw new Error("결제금액이 예약금액과 일치하지 않습니다.");

    // 서버 검증 완료 후 bookings API로 저장
    const origin = event.headers?.host ? `https://${event.headers.host}` : "";
    const saved = await fetch(origin + "/api/bookings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, paymentStatus: "paid", paymentVerified: true })
    });
    const result = await saved.json();
    if (!saved.ok) throw new Error(result.message || "예약 저장 실패");
    return json(200, { ok: true, payment, booking: result.booking });
  } catch (e) {
    return json(400, { message: e.message || "결제 검증 실패" });
  }
}
