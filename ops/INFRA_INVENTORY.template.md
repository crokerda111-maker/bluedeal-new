# BLUEDEAL 운영 정보 인벤토리

실제 토큰과 비밀번호는 이 문서에 적지 말고 Vercel 환경변수 또는 비밀번호 관리자에 보관하세요.

## 서비스

| 항목 | 실제 값 |
|---|---|
| GitHub 저장소 | `crokerda111-maker/bluedeal-new` |
| Vercel 프로젝트 | `bluedeal123-hjio` |
| 기본 도메인 | `bluedeal.co.kr` |
| 가격 갱신 PC |  |
| KV 제공자 |  |

## 구성

- Next.js 홈페이지·API: Vercel
- 가격 수집: 운영자 Windows PC
- 가격 배포: GitHub push → Vercel 자동 배포
- 동적 게시판·관리자 글: Vercel KV 또는 Upstash REST
- 카페24 VPS: 사용하지 않음

## 점검표

- [ ] Vercel Production 브랜치가 `main`인지 확인
- [ ] `bluedeal.co.kr`, `www.bluedeal.co.kr` 도메인 상태가 Valid인지 확인
- [ ] `ADMIN_PASSWORD`를 강한 값으로 설정
- [ ] KV REST 환경변수 연결 및 `/admin/blog` 저장 확인
- [ ] 필요한 제휴사 값만 환경변수에 설정
- [ ] PC에서 가격 CSV 생성 후 `publish_prices.ps1 -Publish` 시험
- [ ] Vercel 배포 후 가격표와 `/go` 이동 확인

## 장애 확인

가격이 갱신되지 않으면 PC 입력 CSV, 수집기 실행 결과, Git push 여부, Vercel 배포 순서로 확인합니다. 게시판이나 관리자 글만 저장되지 않으면 KV 연결과 Vercel Functions 로그를 확인합니다.
