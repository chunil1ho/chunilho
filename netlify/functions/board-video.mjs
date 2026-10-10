import { getStore } from "@netlify/blobs";
import { json } from "./_lib.mjs";
import { verifyAdmin } from "./_auth.mjs";

const videoStore = getStore({
    name: "chunilho-board-video",
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN,
    consistency: "strong"
});

export async function handler(event) {

    const method = event.httpMethod;

    try {

        // ========================================
        // OPTIONS
        // ========================================
        if (method === "OPTIONS") {
            return json(200, {
                ok: true
            });
        }


        // ========================================
        // POST : 동영상 업로드
        // ========================================
        if (method === "POST") {

            // 관리자 확인
            if (!verifyAdmin(event)) {
                return json(401, {
                    message: "관리자 로그인이 필요합니다."
                });
            }

            if (!event.body) {
                return json(400, {
                    message: "동영상 파일이 없습니다."
                });
            }


            // 동영상 크기 제한
            const estimatedSize =
                event.isBase64Encoded
                    ? Math.floor(event.body.length * 0.75)
                    : event.body.length;

            if (estimatedSize > 4 * 1024 * 1024) {
                return json(413, {
                    message: "동영상은 4MB 이하만 업로드할 수 있습니다."
                });
            }


            // Content-Type 확인
            const contentType =
                event.headers?.["content-type"] ||
                event.headers?.["Content-Type"] ||
                "";


            if (!contentType.startsWith("video/")) {
                return json(400, {
                    message: "동영상 파일만 업로드할 수 있습니다."
                });
            }


            // 허용 형식
            const allowedTypes = [
                "video/mp4",
                "video/webm",
                "video/quicktime"
            ];

            if (!allowedTypes.includes(contentType)) {
                return json(400, {
                    message:
                        "MP4, WebM, MOV 형식의 동영상만 업로드할 수 있습니다."
                });
            }


            // 파일 데이터 변환
            const buffer = event.isBase64Encoded
                ? Buffer.from(event.body, "base64")
                : Buffer.from(event.body);


            // 고유 파일명
            const extension =
                contentType === "video/mp4"
                    ? "mp4"
                    : contentType === "video/webm"
                        ? "webm"
                        : "mov";

            const key =
                "video-" +
                Date.now() +
                "-" +
                Math.random().toString(36).slice(2) +
                "." +
                extension;


            // Netlify Blobs 저장
            await videoStore.set(
                key,
                buffer,
                {
                    metadata: {
                        contentType: contentType
                    }
                }
            );


            // 재생 주소
            const videoUrl =
                "/api/board-video?key=" +
                encodeURIComponent(key);


            return json(200, {
                success: true,
                url: videoUrl,
                key: key
            });
        }


        // ========================================
        // GET : 동영상 재생
        // ========================================
        if (method === "GET") {

            const key =
                event.queryStringParameters?.key;

            if (!key) {
                return json(400, {
                    message: "동영상 키가 없습니다."
                });
            }


            const result =
                await videoStore.get(key, {
                    type: "arrayBuffer"
                });


            if (!result) {
                return json(404, {
                    message: "동영상을 찾을 수 없습니다."
                });
            }


            const buffer =
                Buffer.from(result);


            const metadata =
                await videoStore.getMetadata(key);


            const contentType =
                metadata?.metadata?.contentType ||
                "video/mp4";


            return {
                statusCode: 200,

                headers: {
                    "Content-Type": contentType,
                    "Cache-Control": "public, max-age=31536000",
                    "Access-Control-Allow-Origin":
                        "https://chunilho.com",
                    "Accept-Ranges": "bytes"
                },

                isBase64Encoded: true,

                body: buffer.toString("base64")
            };
        }


        // ========================================
        // 지원하지 않는 요청
        // ========================================
        return json(405, {
            message: "Method Not Allowed"
        });


    } catch (error) {

        console.error(
            "Board Video Error:",
            error
        );

        return json(500, {
            message:
                error?.message ||
                "동영상 처리 중 오류가 발생했습니다."
        });
    }
}
