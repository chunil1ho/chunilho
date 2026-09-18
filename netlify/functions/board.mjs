import { getStore } from "@netlify/blobs";
import { json, body } from "./_lib.mjs";
import { verifyAdmin } from "./_auth.mjs";

const boardStore = getStore({
  name: "chunilho-board",
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_AUTH_TOKEN,
  consistency: "strong"
});

export async function handler(event) {
  const method = event.httpMethod;

  try {

    // ========================================
    // OPTIONS : 브라우저 프리플라이트
    // ========================================
    if (method === "OPTIONS") {
      return json(200, {
        ok: true
      });
    }

    // ========================================
    // GET : 조황게시판 목록
    // ========================================
    if (method === "GET") {

      const posts = await boardStore.get("posts", {
        type: "json"
      });

      return json(200, {
        posts: Array.isArray(posts) ? posts : []
      });
    }


    // ========================================
    // POST : 조황글 등록
    // ========================================
    if (method === "POST") {

      // 관리자 인증
      if (!verifyAdmin(event)) {
        return json(401, {
          message: "관리자 로그인이 필요합니다."
        });
      }

      // 요청 데이터
      const data = await body(event);

      const title = String(data?.title || "").trim();
      const content = String(data?.content || "").trim();

      // 제목 확인
      if (!title) {
        return json(400, {
          message: "제목을 입력해주세요."
        });
      }

      // 내용 확인
      if (!content) {
        return json(400, {
          message: "내용을 입력해주세요."
        });
      }


      // 기존 게시글 가져오기
      const existingPosts = await boardStore.get("posts", {
        type: "json"
      });

      const posts = Array.isArray(existingPosts)
        ? existingPosts
        : [];


      // 새 게시글 생성
      const now = new Date().toISOString();

      const post = {
        id: Date.now().toString(),
        title: title,
        content: content,
        images: Array.isArray(data?.images)
          ? data.images
          : [],
        createdAt: now,
        updatedAt: now
      };


      // 최신 글을 맨 위에 추가
      posts.unshift(post);


      // Netlify Blobs 저장
      await boardStore.setJSON("posts", posts);


      // 성공 응답
      return json(200, {
        success: true,
        post: post
      });
    }


    // ========================================
    // 지원하지 않는 요청
    // ========================================
    return json(405, {
      message: "Method Not Allowed"
    });

  } catch (error) {

    console.error("Board API Error:", error);

    return json(500, {
      message:
        error?.message ||
        "조황게시판 서버 오류가 발생했습니다."
    });
  }
}
