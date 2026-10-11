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
  const posts = await boardStore.get("posts", { type: "json" });

  const allPosts = Array.isArray(posts) ? posts : [];

  // 홈페이지에서는 최신 3개만, 필요한 정보만 전송
  if (event.queryStringParameters?.home === "1") {
    const homePosts = allPosts
      .slice()
      .sort((a, b) => {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      })
      .slice(0, 3)
      .map(post => {
        let firstImage = "";

        // 본문에서 첫 번째 이미지 찾기
        if (post.content) {
          const match = post.content.match(
            /<img[^>]+src=["']([^"']+)["']/i
          );

          if (match) {
            firstImage = match[1];
          }
        }

        // 본문에 이미지가 없으면 첨부 이미지 첫 번째 사용
        if (!firstImage && Array.isArray(post.images) && post.images.length > 0) {
          firstImage = post.images[0];
        }

        return {
          id: post.id,
          title: post.title,
          createdAt: post.createdAt,
          image: firstImage
        };
      });

    return json(200, {
      posts: homePosts
    });
  }
// 특정 게시글 상세보기 요청
const postId = event.queryStringParameters?.id;
console.log("상세 요청 postId:", postId);
  
if (postId) {
const post = allPosts.find(
  post => String(post.id || post.postId || post.no) === String(postId)
);
  if (!post) {
    return json(404, {
      message: "게시글을 찾을 수 없습니다."
    });
  }

  return json(200, {
    post
  });
}
// 일반 조황게시판 목록에서는 필요한 정보만 전송
const listPosts = allPosts.map(post => ({
  id: post.id,
  title: post.title,
  createdAt: post.createdAt
}));

return json(200, {
  posts: listPosts
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
