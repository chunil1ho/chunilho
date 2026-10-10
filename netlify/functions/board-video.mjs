import { getStore } from "@netlify/blobs";
import { json } from "./_lib.mjs";
import { verifyAdmin } from "./_auth.mjs";

const videoStore = getStore({
    name: "chunilho-board-video",
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN,
    consistency: "strong"
});
const CORS_HEADERS = {
    "Access-Control-Allow-Origin":
        "https://www.chunilho.com",

    "Access-Control-Allow-Methods":
        "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers":
        "Content-Type, Authorization"
};

function corsJson(statusCode, data) {

    const response =
        json(statusCode, data);

    return {
        ...response,

        headers: {
            ...(response.headers || {}),
            ...CORS_HEADERS
        }
    };
}
export async function handler(event) {

    const method = event.httpMethod;

    try {

// ========================================
// OPTIONS : CORS 사전 요청
// ========================================
if (method === "OPTIONS") {

    return {
        statusCode: 204,

        headers: {
            "Access-Control-Allow-Origin":
                "https://www.chunilho.com",

            "Access-Control-Allow-Methods":
                "GET, POST, OPTIONS",

            "Access-Control-Allow-Headers":
                "Content-Type, Authorization",

            "Access-Control-Max-Age":
                "86400"
        },

        body: ""
    };
}
        // ========================================
        // POST : 동영상 업로드
        // ========================================
        if (method === "POST") {

            // 관리자 확인
            if (!verifyAdmin(event)) {
                return corsJson(401, {
                    message: "관리자 로그인이 필요합니다."
                });
            }

            if (!event.body) {
                return corsJson(400, {
                    message: "동영상 파일이 없습니다."
                });
            }


            // 동영상 크기 제한
            const estimatedSize =
                event.isBase64Encoded
                    ? Math.floor(event.body.length * 0.75)
                    : event.body.length;

            if (estimatedSize > 4 * 1024 * 1024) {
                return corsJson(413, {
                    message: "동영상은 4MB 이하만 업로드할 수 있습니다."
                });
            }


            // Content-Type 확인
            const contentType =
                event.headers?.["content-type"] ||
                event.headers?.["Content-Type"] ||
                "";


            if (!contentType.startsWith("video/")) {
                return corsJson(400, {
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
                return corsJson(400, {
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


return {
    statusCode: 200,

    headers: {
        "Content-Type":
            "application/json",

        "Access-Control-Allow-Origin":
            "https://www.chunilho.com",

        "Access-Control-Allow-Methods":
            "GET, POST, OPTIONS",

        "Access-Control-Allow-Headers":
            "Content-Type, Authorization"
    },

    body: JSON.stringify({
        success: true,
        url: videoUrl,
        key: key
    })
};
        }


// ========================================
// GET : 동영상 재생
// ========================================
if (method === "GET") {

    const key =
        event.queryStringParameters?.key;

    if (!key) {
        return corsJson(400, {
            message: "동영상 키가 없습니다."
        });
    }


    const result =
        await videoStore.get(key, {
            type: "arrayBuffer"
        });


    if (!result) {
        return corsJson(404, {
            message: "동영상을 찾을 수 없습니다."
        });
    }


    const buffer =
        Buffer.from(result);

    const totalSize =
        buffer.length;


    const metadata =
        await videoStore.getMetadata(key);


    const contentType =
        metadata?.metadata?.contentType ||
        metadata?.contentType ||
        "video/mp4";


    // ========================================
    // Range 요청 확인
    // ========================================

    const rangeHeader =
        event.headers?.range ||
        event.headers?.Range;


    // ========================================
    // Range 없이 전체 동영상 요청
    // ========================================

    if (!rangeHeader) {

        return {

            statusCode: 200,

            headers: {
                "Content-Type": contentType,
                "Content-Length":
                    String(totalSize),

                "Cache-Control":
                    "public, max-age=31536000",

                "Access-Control-Allow-Origin":
                    "https://www.chunilho.com",

                "Accept-Ranges":
                    "bytes"
            },

            isBase64Encoded: true,

            body:
                buffer.toString("base64")
        };
    }


    // ========================================
    // Range 파싱
    // ========================================

    const match =
        rangeHeader.match(
            /bytes=(\d*)-(\d*)/
        );


    if (!match) {

        return {

            statusCode: 416,

            headers: {
                "Content-Range":
                    `bytes */${totalSize}`,

                "Access-Control-Allow-Origin":
                    "https://www.chunilho.com"
            },

            body: ""
        };
    }


    let start =
        match[1] === ""
            ? 0
            : Number(match[1]);


    let end =
        match[2] === ""
            ? totalSize - 1
            : Number(match[2]);


    // ========================================
    // 끝에서부터 요청하는 Range
    // 예: bytes=-500000
    // ========================================

    if (match[1] === "") {

        const requestedLength =
            Number(match[2]);

        start =
            Math.max(
                totalSize - requestedLength,
                0
            );

        end =
            totalSize - 1;
    }


    // ========================================
    // 잘못된 Range
    // ========================================

    if (
        start < 0 ||
        start >= totalSize ||
        start > end
    ) {

        return {

            statusCode: 416,

            headers: {
                "Content-Range":
                    `bytes */${totalSize}`,

                "Access-Control-Allow-Origin":
                    "https://www.chunilho.com"
            },

            body: ""
        };
    }


    end =
        Math.min(
            end,
            totalSize - 1
        );


    const chunk =
        buffer.subarray(
            start,
            end + 1
        );


    // ========================================
    // 206 Partial Content
    // ========================================

    return {

        statusCode: 206,

        headers: {

            "Content-Type":
                contentType,

            "Content-Length":
                String(chunk.length),

            "Content-Range":
                `bytes ${start}-${end}/${totalSize}`,

            "Accept-Ranges":
                "bytes",

            "Cache-Control":
                "public, max-age=31536000",

            "Access-Control-Allow-Origin":
                "https://www.chunilho.com"
        },

        isBase64Encoded: true,

        body:
            chunk.toString("base64")
    };
}

        // ========================================
        // 지원하지 않는 요청
        // ========================================
        return corsJson(405, {
            message: "Method Not Allowed"
        });


} catch (error) {

    console.error(
        "Board Video Error:",
        error
    );

    return {
        statusCode: 500,

        headers: {
            "Content-Type":
                "application/json",

            "Access-Control-Allow-Origin":
                "https://www.chunilho.com",

            "Access-Control-Allow-Methods":
                "GET, POST, OPTIONS",

            "Access-Control-Allow-Headers":
                "Content-Type, Authorization"
        },

        body: JSON.stringify({
            message:
                error?.message ||
                "동영상 처리 중 오류가 발생했습니다."
        })
    };
}
}
