# 배포 체크리스트 (MVP)

## A. 로컬에서 1회 확인
- [ ] Node 18.17+ (권장 Node 20)
- [ ] `npm install`
- [ ] `npm run dev`로 페이지 로딩 확인
  - [ ] `/` (홈)
  - [ ] `/hot`, `/deals/d1` (핫딜)
  - [ ] `/go/d1` (리다이렉트)
  - [ ] `/prices` (가격현황)
  - [ ] `/it`, `/community`, `/contact` (게시판)

## B. Vercel 환경변수
- [ ] `PRICE_API_BASE` 설정 (VPS 가격 JSON 주소)
- [ ] (선택) `COUPANG_LPTAG` 설정

## C. VPS(카페24) Price API
- [ ] `api.<도메인>` A 레코드 → VPS IP
- [ ] nginx로 정적 JSON 서빙
  - [ ] `/meta.json`
  - [ ] `/prices/*.json`
- [ ] HTTPS(certbot) 적용
- [ ] 크론 등록 (09:00 / 17:00)
  - [ ] 실패 로그(`/var/log/...`) 확인 가능

## D. /go 리다이렉트 운영값
- [ ] `src/lib/outbound.ts`의 `originalUrl`을 실제 상품 URL로 교체
- [ ] 사용 쇼핑몰 도메인이 whitelist(`src/lib/affiliate.ts`)에 있는지 확인

## E. 배포 후 확인
- [ ] `/prices`에서 마지막 업데이트 시간이 실제로 갱신되는지 확인
- [ ] `/go/{code}`가 정상 리다이렉트 되는지 확인
- [ ] 문의 작성(`/contact/write`)이 정상 저장되는지 확인 (MVP: localStorage)
