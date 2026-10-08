export async function handler(event) {

  const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
  const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;

  if (!REST_API_KEY || !REDIRECT_URI) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      },
      body: "카카오 환경변수가 설정되지 않았습니다."
    };
  }

  const kakaoAuthUrl =
    "https://kauth.kakao.com/oauth/authorize" +
    "?response_type=code" +
    "&client_id=" +
    encodeURIComponent(REST_API_KEY) +
    "&redirect_uri=" +
    encodeURIComponent(REDIRECT_URI) +
    "&scope=talk_message";

  return {
    statusCode: 302,
    headers: {
      Location: kakaoAuthUrl
    },
    body: ""
  };
}
