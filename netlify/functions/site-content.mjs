import { getStore } from "@netlify/blobs";
import { json, body } from "./_lib.mjs";
import { verifyAdmin } from "./_auth.mjs";

const contentStore = getStore({
  name: "chunilho-site-content",
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_AUTH_TOKEN,
  consistency: "strong"
});

const DEFAULT_CONTENT = {
  hero: {
    badge: "제주 서귀포 필수 여행 코스",
    title: "바다 위에서 맞이하는 가장 찬란한 순간",
    subtitle: "초보자도, 아이도 누구나 손쉽게 손맛을 즐기는\\n서귀포 앞바다 힐링 배낚시",
    leftImage: "image/hero.jpg",
    rightImage: "image/hero2.jpg"
  },
  products: [
    { id:"day", title:"주간 체험낚시", description:"초보자와 가족 누구나 즐길 수 있는 서귀포 앞바다 체험낚시", image:"image/pic1.jpg", season:"연중", price:30000, secondPrice:40000, course:"주간 체험 2시간", visible:true },
    { id:"squid", title:"한치낚시", description:"제주 밤바다에서 즐기는 짜릿한 한치 손맛", image:"image/pic3.jpg", season:"6월 중순 ~ 9월 초", price:60000, secondPrice:0, course:"야간 한치 체험낚시", visible:true },
    { id:"hairtail", title:"갈치낚시", description:"제주 밤바다의 대표 낚시, 갈치와 고등어를 함께 즐겨보세요.", image:"image/pic2.jpg", season:"8월 ~ 11월 중순", price:90000, secondPrice:0, course:"야간 갈치낚시", visible:true },
    { id:"jigging", title:"지깅낚시", description:"제주 앞바다에서 즐기는 짜릿한 지깅 체험", image:"image/pic6.jpg", season:"연중", price:90000, secondPrice:0, course:"지깅체험 4시간", visible:true }
  ]
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function response(statusCode, data, extraHeaders = {}) {
  const result = json(statusCode, data);
  result.headers = { ...(result.headers || {}), ...extraHeaders };
  return result;
}

function safeAssetName(value) {
  const name = String(value || "").trim();
  return /^[a-z0-9-]{1,40}$/i.test(name) ? name : "";
}

export async function handler(event) {
  const method = event.httpMethod || event.requestContext?.http?.method || "GET";
  const asset = event.queryStringParameters?.asset;

  try {
    if (method === "OPTIONS") return response(204, { ok:true });

    if (asset) {
      const name = safeAssetName(asset);
      if (!name) return response(400, { message:"잘못된 이미지 이름입니다." });
      const key = "assets/" + name;

      if (method === "POST") {
        if (!verifyAdmin(event)) return response(401, { message:"관리자 로그인이 필요합니다." });
        const headers = event.headers || {};
        const contentType = String(headers["content-type"] || headers["Content-Type"] || "")
          .split(";")[0].trim().toLowerCase();
        if (!IMAGE_TYPES.has(contentType)) {
          return response(415, { message:"JPG, PNG, WebP, AVIF 사진만 업로드할 수 있습니다." });
        }
        if (!event.body) return response(400, { message:"업로드할 사진이 없습니다." });

        const bytes = event.isBase64Encoded
          ? Buffer.from(event.body, "base64")
          : Buffer.from(event.body, "binary");
        if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
          return response(413, { message:"사진은 4MB 이하만 업로드할 수 있습니다." });
        }

        await contentStore.set(key, bytes, { metadata:{ contentType } });
        return response(200, { ok:true, url:"/api/site-content?asset=" + encodeURIComponent(name) });
      }

      if (method === "GET") {
        const file = await contentStore.get(key, { type:"arrayBuffer" });
        if (!file) return response(404, { message:"이미지를 찾을 수 없습니다." });
        const metadata = await contentStore.getMetadata(key);
        const type = metadata?.metadata?.contentType || "application/octet-stream";
        return {
          statusCode:200,
          headers:{
            "Content-Type":type,
            "Cache-Control":"public, max-age=300",
            "Access-Control-Allow-Origin":"https://chunilho.com"
          },
          body:Buffer.from(file).toString("base64"),
          isBase64Encoded:true
        };
      }
      return response(405, { message:"허용되지 않은 요청입니다." });
    }

    if (method === "GET") {
      const saved = await contentStore.get("homepage", { type:"json" });
      return response(200, { content:saved || DEFAULT_CONTENT });
    }

    if (method === "PUT") {
      if (!verifyAdmin(event)) return response(401, { message:"관리자 인증이 필요합니다." });
      const data = await body(event);
      const incoming = data?.content;
      if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.products)) {
        return response(400, { message:"저장할 홈페이지 콘텐츠 형식이 올바르지 않습니다." });
      }

      const allowedIds = new Set(["day","squid","hairtail","jigging"]);
      const cleanProducts = incoming.products
        .filter(p => allowedIds.has(String(p?.id)))
        .map(p => ({
          id:String(p.id),
          title:String(p.title || "").slice(0,80),
          description:String(p.description || "").slice(0,240),
          image:String(p.image || "").slice(0,500),
          season:String(p.season || "").slice(0,80),
          price:Math.max(0, Math.min(100000000, Number(p.price) || 0)),
          secondPrice:Math.max(0, Math.min(100000000, Number(p.secondPrice) || 0)),
          course:String(p.course || "").slice(0,80),
          visible:p.visible !== false
        }));

      const hero = {
        badge:String(incoming.hero?.badge || "").slice(0,80),
        title:String(incoming.hero?.title || "").slice(0,120),
        subtitle:String(incoming.hero?.subtitle || "").slice(0,300),
        leftImage:String(incoming.hero?.leftImage || DEFAULT_CONTENT.hero.leftImage).slice(0,500),
        rightImage:String(incoming.hero?.rightImage || DEFAULT_CONTENT.hero.rightImage).slice(0,500)
      };

      const content = { hero, products:cleanProducts };
      await contentStore.setJSON("homepage", content);
      return response(200, { ok:true, content });
    }

    return response(405, { message:"허용되지 않은 요청입니다." });
  } catch (error) {
    console.error("site-content function error:", error);
    return response(500, { message:"홈페이지 콘텐츠 처리 중 서버 오류가 발생했습니다." });
  }
}
