import { getStore } from "@netlify/blobs";
import { json, body, getAuthToken } from "./_lib.mjs";

const boardStore = getStore({
  name: "chunilho-board",
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_AUTH_TOKEN,
  consistency: "strong"
});

async function isAdmin(event) {
  const token = getAuthToken(event);

  if (!token) return false;

  try {
    const response = await fetch(
      "https://chunilho.netlify.app/api/admin-session",
      {
        headers: {
          Authorization: "Bearer " + token
        }
      }
    );

    return response.ok;
  } catch (error) {
    console.error("관리자 인증 오류:", error);
    return false;
  }
}

export async function handler(event) {
  const method = event.httpMethod;

  try {
    // 게시글 목록 조회
    if (method === "GET") {
      const posts = await boardStore.get("posts", {
        type: "json"
      });

      return json(200, {
        posts: Array.isArray(posts) ? posts : []
      });
    }

    // 게시글 등록
    if (method === "POST") {
      const admin = await isAdmin(event);

      if (!admin) {
        return json(401, {
          message: "관리자 권한이 필요합니다."
        });
      }

      const data = await body(event);

      const title = String(data.title || "").trim();
      const content = String(data.content || "").trim();

      if (!title || !content) {
        return json(400, {
          message: "제목과 내용을 입력해주세요."
        });
      }

      const posts = await boardStore.get("posts", {
        type: "json"
      }) || [];

      const now = new Date().toISOString();

      const post = {
        id: Date.now().toString(),
        title,
        content,
        images: Array.isArray(data.images) ? data.images : [],
        createdAt: now,
        updatedAt: now
      };

      posts.unshift(post);

      await boardStore.setJSON("posts", posts);

      return json(200, {
        success: true,
        post
      });
    }

    return json(405, {
      message: "Method Not Allowed"
    });

  } catch (error) {
    console.error("Board API Error:", error);

    return json(500, {
      message: error.message || "조황게시판 서버 오류가 발생했습니다."
    });
  }
}