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

    const fileSize =
    event.headers?.["x-file-size"] ||
    event.headers?.["X-File-Size"];
    
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
const totalFileSize =
    Number(fileSize);

if (
    !Number.isSafeInteger(totalFileSize) ||
    totalFileSize <= 0
) {
    return corsJson(400, {
        message: "동영상 파일 크기 정보가 없습니다."
    });
}

if (
    totalFileSize >
    1 * 1024 * 1024 * 1024
) {
    return corsJson(413, {
        message:
            "동영상은 1GB 이하만 업로드할 수 있습니다."
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

/* ========================================
   마지막 청크 → 업로드 완료 처리
   ======================================== */

if (index === count - 1) {

    const { blobs } =
        await videoStore.list({
            prefix:
                safeUploadId + "/chunk-"
        });

    if (blobs.length !== count) {

        return corsJson(409, {
            message:
                "아직 모든 동영상 조각이 업로드되지 않았습니다."
        });
    }

    const extension =
        contentType === "video/mp4"
            ? "mp4"
            : contentType === "video/webm"
                ? "webm"
                : "mov";

    const manifestKey =
        safeUploadId +
        "/manifest.json";

    await videoStore.setJSON(
        manifestKey,
        {
            uploadId: safeUploadId,
            totalSize: totalFileSize,
            totalChunks: count,
            contentType: contentType,
            extension: extension
        },
        {
            metadata: {
                contentType:
                    "application/json"
            }
        }
    );

    const videoUrl =
        "/api/board-video?key=" +
        encodeURIComponent(
            safeUploadId
        );

    return corsJson(200, {
        success: true,
        complete: true,
        url: videoUrl,
        key: safeUploadId
    });
}


/* 아직 업로드 중 */

return corsJson(200, {
    success: true,
    complete: false,
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

    const safeKey =
        key.replace(
            /[^a-zA-Z0-9_-]/g,
            ""
        );

    if (!safeKey) {
        return corsJson(400, {
            message: "잘못된 동영상 키입니다."
        });
    }

    // ========================================
    // manifest 가져오기
    // ========================================

    const manifestKey =
        safeKey + "/manifest.json";

    const manifest =
        await videoStore.get(
            manifestKey,
            {
                type: "json"
            }
        );

    if (!manifest) {
        return corsJson(404, {
            message:
                "동영상 정보를 찾을 수 없습니다."
        });
    }

    const totalSize =
        Number(manifest.totalSize);

    const totalChunks =
        Number(manifest.totalChunks);

    const contentType =
        manifest.contentType ||
        "video/mp4";

    if (
        !Number.isSafeInteger(totalSize) ||
        !Number.isInteger(totalChunks) ||
        totalSize <= 0 ||
        totalChunks < 1
    ) {
        return corsJson(500, {
            message:
                "동영상 정보가 올바르지 않습니다."
        });
    }

    // ========================================
    // Range 확인
    // ========================================

    const rangeHeader =
        event.headers?.range ||
        event.headers?.Range;

    let start = 0;
    let end =
        Math.min(
            totalSize - 1,
            (4 * 1024 * 1024) - 1
        );

    if (rangeHeader) {

        const match =
            rangeHeader.match(
                /bytes=(\d*)-(\d*)/
            );

        if (!match) {
            return {
                statusCode: 416,
                headers: {
                    "Content-Range":
                        "bytes */" +
                        totalSize,
                    ...CORS_HEADERS
                },
                body: ""
            };
        }

        const rangeStart =
            match[1] !== ""
                ? Number(match[1])
                : null;

        const rangeEnd =
            match[2] !== ""
                ? Number(match[2])
                : null;

        // bytes=-500000
        if (rangeStart === null) {

            const suffixLength =
                Math.min(
                    Number(rangeEnd),
                    4 * 1024 * 1024
                );

            start =
                Math.max(
                    0,
                    totalSize - suffixLength
                );

            end =
                totalSize - 1;

        } else {

            start =
                rangeStart;

            if (
                rangeEnd !== null
            ) {
                end =
                    Math.min(
                        rangeEnd,
                        start +
                        (4 * 1024 * 1024) - 1
                    );
            } else {
                end =
                    Math.min(
                        totalSize - 1,
                        start +
                        (4 * 1024 * 1024) - 1
                    );
            }
        }
    }

    // ========================================
    // 범위 확인
    // ========================================

    if (
        start < 0 ||
        start >= totalSize ||
        end < start
    ) {
        return {
            statusCode: 416,
            headers: {
                "Content-Range":
                    "bytes */" +
                    totalSize,
                ...CORS_HEADERS
            },
            body: ""
        };
    }

    end =
        Math.min(
            end,
            totalSize - 1
        );

    const contentLength =
        end - start + 1;

    // ========================================
    // 필요한 청크 계산
    // ========================================

    const CHUNK_SIZE =
        4 * 1024 * 1024;

    const firstChunk =
        Math.floor(
            start / CHUNK_SIZE
        );

    const lastChunk =
        Math.floor(
            end / CHUNK_SIZE
        );

    const buffers = [];

    for (
        let i = firstChunk;
        i <= lastChunk;
        i++
    ) {

        const chunkKey =
            safeKey +
            "/chunk-" +
            String(i).padStart(6, "0");

        const chunk =
            await videoStore.get(
                chunkKey,
                {
                    type: "arrayBuffer"
                }
            );

        if (!chunk) {
            return corsJson(404, {
                message:
                    "동영상 데이터가 손상되었거나 누락되었습니다."
            });
        }

        buffers.push(
            Buffer.from(chunk)
        );
    }

    // ========================================
    // 필요한 부분만 잘라내기
    // ========================================

    const combined =
        Buffer.concat(buffers);

    const offset =
        start -
        firstChunk * CHUNK_SIZE;

    const bodyBuffer =
        combined.slice(
            offset,
            offset + contentLength
        );

    // ========================================
    // 동영상 응답
    // ========================================

    return {
        statusCode:
            rangeHeader ? 206 : 200,

        headers: {
            "Content-Type":
                contentType,

            "Content-Length":
                String(bodyBuffer.length),

            "Accept-Ranges":
                "bytes",

            "Content-Range":
                "bytes " +
                start +
                "-" +
                end +
                "/" +
                totalSize,

            "Cache-Control":
                "public, max-age=31536000",

            ...CORS_HEADERS
        },

        isBase64Encoded:
            true,

        body:
            bodyBuffer.toString(
                "base64"
            )
    };
}

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
