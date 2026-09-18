import { getStore } from "@Netlify/blobs";
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
    // DELETE : 조황게시글 삭제
    // ========================================
    if (method === "DELETE") {

      if (!verifyAdmin(event)) {
        return json(401, {
          message: "관리자 로그인이 필요합니다."
        });
      }

      const data = await body(event);
      const postId = String(data?.id || "").trim();

      if (!postId) {
        return json(400, {
          message: "삭제할 게시글 ID가 없습니다."
        });
      }

      const existingPosts = await boardStore.get("posts", {
        type: "json"
      });

      const posts = Array.isArray(existingPosts)
        ? existingPosts
        : [];

      const filteredPosts = posts.filter(
        post => String(post.id) !== postId
      );

      if (filteredPosts.length === posts.length) {
        return json(404, {
          message: "삭제할 게시글을 찾을 수 없습니다."
        });
      }

      await boardStore.setJSON("posts", filteredPosts);

      return json(200, {
        success: true,
        message: "게시글이 삭제되었습니다."
      });
    }


    // ========================================
    // PUT : 조황게시글 수정
    // ========================================
    if (method === "PUT") {

      if (!verifyAdmin(event)) {
        return json(401, {
          message: "관리자 로그인이 필요합니다."
        });
      }

      const data = await body(event);

      const postId = String(data?.id || "").trim();
      const title = String(data?.title || "").trim();
      const content = String(data?.content || "").trim();

      if (!postId) {
        return json(400, {
          message: "수정할 게시글 ID가 없습니다."
        });
      }

      if (!title) {
        return json(400, {
          message: "제목을 입력해주세요."
        });
      }

      if (!content) {
        return json(400, {
          message: "내용을 입력해주세요."
        });
      }

      const existingPosts = await boardStore.get("posts", {
        type: "json"
      });

      const posts = Array.isArray(existingPosts)
        ? existingPosts
        : [];

      const index = posts.findIndex(
        post => String(post.id) === postId
      );

      if (index === -1) {
        return json(404, {
          message: "수정할 게시글을 찾을 수 없습니다."
        });
      }

      posts[index] = {
        ...posts[index],
        title: title,
        content: content,
        images: Array.isArray(data?.images)
          ? data.images
          : (posts[index].images || []),
        updatedAt: new Date().toISOString()
      };

      await boardStore.setJSON("posts", posts);

      return json(200, {
        success: true,
        post: posts[index]
      });
    }


    // ========================================
    // POST : 조황게시글 등록
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
