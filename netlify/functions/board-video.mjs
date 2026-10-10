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
// POST : 동영상 청크 업로드
// ========================================
if (method === "POST") {

    // 관리자 확인
    if (!verifyAdmin(event)) {
        return corsJson(401, {
            message: "관리자 로그인이 필요합니다."
        });
    }

    const uploadId =
        event.headers?.["x-upload-id"] ||
        event.headers?.["X-Upload-Id"];

    const chunkIndex =
        event.headers?.["x-chunk-index"] ||
        event.headers?.["X-Chunk-Index"];

    const totalChunks =
        event.headers?.["x-total-chunks"] ||
        event.headers?.["X-Total-Chunks"];

    const contentType =
        event.headers?.["content-type"] ||
        event.headers?.["Content-Type"] ||
        "";

    if (!uploadId) {
        return corsJson(400, {
            message: "업로드 ID가 없습니다."
        });
    }

    if (
        chunkIndex === undefined ||
        totalChunks === undefined
    ) {
        return corsJson(400, {
            message: "동영상 청크 정보가 없습니다."
        });
    }

    if (!event.body) {
        return corsJson(400, {
            message: "동영상 데이터가 없습니다."
        });
    }

    if (!contentType.startsWith("video/")) {
        return corsJson(400, {
            message: "동영상 파일만 업로드할 수 있습니다."
        });
    }

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

    const index =
        Number(chunkIndex);

    const count =
        Number(totalChunks);

    if (
        !Number.isInteger(index) ||
        !Number.isInteger(count) ||
        index < 0 ||
        count < 1 ||
        index >= count
    ) {
        return corsJson(400, {
            message: "잘못된 청크 정보입니다."
        });
    }

    // 1GB 제한
    const MAX_VIDEO_SIZE =
        1 * 1024 * 1024 * 1024;

    // 청크 데이터 변환
    const buffer =
        event.isBase64Encoded
            ? Buffer.from(event.body, "base64")
            : Buffer.from(event.body);

    // 청크 자체는 4MB 이하
    if (
        buffer.length >
        4 * 1024 * 1024
    ) {
        return corsJson(413, {
            message:
                "동영상 청크가 너무 큽니다."
        });
    }

    // 업로드 ID에 사용할 수 없는 문자 제거
    const safeUploadId =
        uploadId.replace(
            /[^a-zA-Z0-9_-]/g,
            ""
        );

    if (!safeUploadId) {
        return corsJson(400, {
            message: "잘못된 업로드 ID입니다."
        });
    }

    // 청크 저장
    const chunkKey =
        safeUploadId +
        "/chunk-" +
        String(index).padStart(6, "0");

    await videoStore.set(
        chunkKey,
        buffer,
        {
            metadata: {
                contentType: contentType
            }
        }
    );

    return corsJson(200, {
        success: true,
        uploadId: safeUploadId,
        chunkIndex: index,
        totalChunks: count
    });
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
