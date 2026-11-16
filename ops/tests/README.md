# 로컬 운영 점검

실제 운영 DB나 Vercel 환경변수 없이 검증합니다. 게시판 검사는 프로덕션 빌드의 HTTP API를 임시 로컬 KV 서버에 연결합니다. 테스트용 비밀번호는 실행할 때 생성하며 외부 서비스로 보내지 않습니다. 가격 생성기 검사는 `.test-tmp/` 아래의 임시 폴더만 사용하고, 검사 후 그 폴더를 정리합니다. 테스트 상품과 가격은 모두 가상 데이터입니다.

실행 위치: **Windows PowerShell**, 이 저장소 폴더.

```powershell
npm ci --ignore-scripts
npm run build
npm run typecheck
npm run lint
npm run test:boards
npm run test:collector
npm run test:post-client
```

`test:boards`는 관리자 비밀번호/KV 미설정, 일반 글 작성·목록·상세, 비공개 문의 마스킹과 잠금, 관리자 수정·삭제·로그인·로그아웃을 검사합니다. 빈 비밀번호 해시, 비밀번호 없는 비공개 전환, 빈 비밀번호로 잠금 제거는 회귀 검사에 포함됩니다. 운영 Upstash의 실제 연결 상태를 증명하는 테스트는 아닙니다.

비공개 열람은 `POST /api/posts/{id}/unlock`의 JSON 본문으로 암호를 받습니다. 기존 GET 쿼리의 `pw`는 무시합니다. 응답은 `private, no-store`이며 암호 해시는 반환하지 않습니다. 브라우저와 같은 출처의 요청 허용, 다른 출처 거부, 8 KiB 초과 본문 거부를 함께 검사합니다. `test:post-client`는 클라이언트가 암호를 URL에 넣지 않는지 확인합니다.

Next.js 16 업데이트 회귀 검사에는 동적 페이지·없는 가격 카테고리의 404, `/go`의 허용 판매처 리다이렉트와 허용되지 않은 호스트 차단, 블로그 API의 초안 비공개·관리자 수정·삭제도 포함합니다. 외부 구매 링크는 실제로 따라가지 않습니다.

`test:collector`는 RAM 3개 생성, 안정적인 이동 코드와 추적값 보존, 잘못된 입력·누락 파일의 기존 결과 보존, dry-run의 무변경 동작을 검사합니다. 실제 상품 가격 확인과 판매처 제휴 귀속 검증은 별도입니다.

화면을 확인하려면 대화형 PowerShell에서 다음 명령을 실행하고 출력된 `LOCAL_PREVIEW` 주소를 여세요.

```powershell
node .\ops\tests\board-smoke.mjs --preview
```

미리보기는 가상 글만 포함하며, `stop` 입력 후 Enter 또는 Ctrl+C로 종료합니다. 임시 KV는 메모리에서만 유지합니다. 자동 실행 도구에서 미리보기를 쓰는 경우 표준 입력이 열린 대화형 세션을 사용하세요.

미리보기 터미널에 `offline`, `partial`, `online`을 입력하면 가상 KV 전체 장애·리뷰 게시판 장애·정상 상태로 전환합니다. 브라우저에서 홈을 새로고침하거나 최신 게시글의 `다시 불러오기`를 눌러 장애 안내와 복구를 확인할 수 있습니다. 운영 KV에 영향을 주지 않습니다.
