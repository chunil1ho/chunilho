import { getStore } from "@netlify/blobs";
import { json, body } from "./_lib.mjs";
import { verifyAdmin } from "./_auth.mjs";

// 상품 전용 저장소: 기존 예약 저장소와 분리
const productStore = getStore({
  name: "chunilho-products",
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_AUTH_TOKEN,
  consistency: "strong"
});

const PRODUCT_KEY = "settings/products";

const DEFAULT_PRODUCTS = [
  {
    id: "day-2h", name: "주간 체험 2시간",
    description: "초보자와 가족 누구나 즐길 수 있는 서귀포 앞바다 체험낚시",
    price: 30000, active: true, season: "연중",
    scheduleType: "day-2h", image: "image/pic1.jpg",
    detail: {
      duration: "2시간", provided: "낚싯대·채비·미끼",
      lifeJacket: "무료 대여", targetFish: "", equipmentFee: "",
      departure: "10:00, 12:00, 13:00, 14:00, 16:00", notice: ""
    },
    damage: {
      title: "장비 파손 및 분실 보상 기준",
      content: "릴 파손 시: 40,000원\n낚싯대 파손 시: 20,000원\n낚싯대 및 릴을 바다에 빠뜨릴 경우: 60,000원\n바다에 빠진 릴을 건져 올리더라도 염분으로 인해 사용이 불가능해질 수 있어 변상하셔야 합니다. 빠뜨린 릴은 가지고 가셔도 됩니다."
    }
  },
  {
    id: "day-3h", name: "주간 체험 3시간",
    description: "여유롭게 즐기는 서귀포 앞바다 체험낚시",
    price: 40000, active: true, season: "연중",
    scheduleType: "day-3h", image: "image/pic1.jpg",
    detail: {
      duration: "3시간", provided: "낚싯대·채비·미끼",
      lifeJacket: "무료 대여", targetFish: "", equipmentFee: "",
      departure: "10:00, 12:00, 13:00, 15:00", notice: ""
    },
    damage: {
      title: "장비 파손 및 분실 보상 기준",
      content: "릴 파손 시: 40,000원\n낚싯대 파손 시: 20,000원\n낚싯대 및 릴을 바다에 빠뜨릴 경우: 60,000원\n바다에 빠진 릴을 건져 올리더라도 염분으로 인해 사용이 불가능해질 수 있어 변상하셔야 합니다. 빠뜨린 릴은 가지고 가셔도 됩니다."
    }
  },
  {
    id: "galchi", name: "야간 갈치낚시",
    description: "제주 밤바다의 대표 낚시, 갈치와 고등어를 함께 즐겨보세요.",
    price: 90000, active: true, season: "8월~11월 중순",
    scheduleType: "galchi", image: "image/pic2.jpg",
    detail: {
      duration: "", provided: "농심 육개장사발면",
      lifeJacket: "무료 대여", targetFish: "갈치·고등어·삼치 등",
      equipmentFee: "20,000원 현장결제", departure: "18:00", notice: ""
    },
    damage: {
      title: "갈치 체험 시 장비 파손 및 분실 보상 기준",
      content: "릴 파손 시: 500,000원\n낚싯대 파손 시: 90,000원\n낚싯대 및 릴을 바다에 빠뜨릴 경우: 200,000원\n바다에 빠진 릴을 건져 올리더라도 염분으로 인해 사용이 불가능해질 수 있어 변상하셔야 합니다."
    }
  },
  {
    id: "hanchi", name: "야간 한치 체험낚시",
    description: "제주 밤바다에서 즐기는 짜릿한 한치 손맛",
    price: 60000, active: true, season: "6월 중순~9월 초",
    scheduleType: "hanchi", image: "image/pic3.jpg",
    detail: {
      duration: "", provided: "농심 육개장사발면",
      lifeJacket: "무료 대여", targetFish: "한치",
      equipmentFee: "10,000원 현장결제", departure: "18:30", notice: ""
    },
    damage: {
      title: "장비 파손 및 분실 보상 기준",
      content: "릴 파손 시: 40,000원\n낚싯대 파손 시: 20,000원\n낚싯대 및 릴을 바다에 빠뜨릴 경우: 60,000원\n바다에 빠진 릴을 건져 올리더라도 염분으로 인해 사용이 불가능해질 수 있어 변상하셔야 합니다. 빠뜨린 릴은 가지고 가셔도 됩니다."
    }
  },
  {
    id: "jigging", name: "지깅체험 4시간",
    description: "제주 앞바다에서 즐기는 짜릿한 지깅 체험",
    price: 90000, active: true, season: "연중",
    scheduleType: "jigging", image: "image/pic6.jpg",
    detail: {
      duration: "4시간", provided: "낚싯대·채비·메탈지그·구명조끼",
      lifeJacket: "포함", targetFish: "부시리·잿방어 등",
      equipmentFee: "", departure: "오전 06:00~08:00 / 오후 13:00~14:00",
      notice: "정확한 출항 시간은 구매 후 전화·문자·카카오톡·위챗으로 확인합니다."
    },
    damage: {
      title: "지깅 체험 시 장비 파손 및 분실 보상 기준",
      content: "릴 파손 시: 500,000원\n낚싯대 파손 시: 90,000원\n낚싯대 및 릴을 바다에 빠뜨릴 경우: 200,000원\n바다에 빠진 릴을 건져 올리더라도 염분으로 인해 사용이 불가능해질 수 있어 변상하셔야 합니다.\n메탈지그는 첫 1개는 대여비에 포함되며, 2번째부터 분실 시 1개당 20,000원입니다."
    }
  }
];

function validateProducts(products) {
  if (!Array.isArray(products) || products.length > 50) {
    throw new Error("상품 목록 형식이 올바르지 않습니다.");
  }

  const ids = new Set();

  return products.map((p) => {
    const id = String(p.id || "").trim();
    const name = String(p.name || "").trim();
    const price = Number(p.price);

    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(id)) {
      throw new Error("상품 ID가 올바르지 않습니다.");
    }
    if (ids.has(id)) throw new Error("중복된 상품 ID가 있습니다.");
    ids.add(id);

    if (!name || name.length > 100) {
      throw new Error("상품명을 확인해 주세요.");
    }
    if (!Number.isSafeInteger(price) || price < 0 || price > 100000000) {
      throw new Error("상품 가격이 올바르지 않습니다.");
    }

    const d = p.detail || {};
    const damage = p.damage || {};

    return {
      id, name,
      description: String(p.description || ""),
      price,
      active: p.active !== false,
      season: String(p.season || ""),
      scheduleType: String(p.scheduleType || "custom"),
      image: String(p.image || ""),
      detail: {
        duration: String(d.duration || ""),
        provided: String(d.provided || ""),
        lifeJacket: String(d.lifeJacket || ""),
        targetFish: String(d.targetFish || ""),
        equipmentFee: String(d.equipmentFee || ""),
        departure: String(d.departure || ""),
        notice: String(d.notice || "")
      },
      damage: {
        title: String(damage.title || ""),
        content: String(damage.content || "")
      }
    };
  });
}

export async function getProducts() {
  const saved = await productStore.get(PRODUCT_KEY, { type: "json" });
  return Array.isArray(saved) ? saved : DEFAULT_PRODUCTS;
}

export async function handler(event) {
  const method = event.httpMethod;

  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "https://chunilho.com",
        "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      },
      body: ""
    };
  }

  if (method === "GET") {
    try {
      return json(200, { ok: true, products: await getProducts() });
    } catch (error) {
      console.error("상품 조회 오류:", error);
      return json(500, {
        ok: false,
        message: "상품 정보를 불러오지 못했습니다."
      });
    }
  }

  if (method === "PUT") {
    if (!verifyAdmin(event)) {
      return json(401, {
        ok: false,
        message: "관리자 인증이 필요합니다."
      });
    }

    try {
      const data = await body(event);
      const products = validateProducts(data.products);
      await productStore.setJSON(PRODUCT_KEY, products);
      return json(200, { ok: true, products });
    } catch (error) {
      console.error("상품 저장 오류:", error);
      return json(400, {
        ok: false,
        message: error.message || "상품 저장에 실패했습니다."
      });
    }
  }

  return json(405, {
    ok: false,
    message: "허용되지 않는 요청입니다."
  });
}
