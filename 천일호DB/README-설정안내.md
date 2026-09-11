# 천일호 서버 DB 예약 구조

현재 `index.html` 디자인은 유지하고 예약 데이터만 서버 저장 방식으로 변경한 프로젝트입니다.

## 구조
- `index.html` : 기존 홈페이지
- `netlify/functions/bookings.mjs` : 예약 저장/전화번호 조회/관리자 예약관리
- `netlify/functions/payments-verify.mjs` : PortOne 결제 서버 검증 후 예약 저장
- `netlify/functions/admin-login.mjs` : 관리자 로그인
- Netlify Blobs `chunilho-bookings` : 서버 영구 저장소

## 필수 환경변수
Netlify 사이트의 Environment variables에 아래 값을 설정해야 합니다.

- `ADMIN_ID` : 관리자 아이디
- `ADMIN_PASSWORD` : 관리자 비밀번호
- `ADMIN_TOKEN_SECRET` : 긴 랜덤 문자열
- `IMP_KEY` : PortOne REST API Key
- `IMP_SECRET` : PortOne REST API Secret

기존 홈페이지에 들어있던 관리자 비밀번호는 프론트에서 제거했습니다.

## 동작
1. 고객이 모바일/PC에서 결제
2. PortOne 결제 성공
3. 서버가 PortOne에 실제 결제 상태/주문번호/금액을 재확인
4. 검증 성공 시 Netlify Blobs에 예약 저장
5. 어떤 기기에서든 전화번호로 `/api/bookings?tel=...` 조회
6. 관리자는 로그인 후 전체 예약을 서버에서 조회

## 주의
- Netlify Blobs는 관계형 SQL DB는 아니지만 서버 측 영구 저장소입니다. 예약 규모가 커지거나 날짜별 좌석/잔여석, 통계, 복잡한 검색이 필요해지면 Supabase/PostgreSQL로 교체하는 것을 권장합니다.
- 결제 취소/환불 버튼은 현재 예약 상태 변경까지이며 실제 PortOne 환불 API 호출은 별도 구현이 필요합니다.
- 반드시 HTTPS로 운영하세요.
