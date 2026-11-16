# 로컬 운영 점검

## 운영 배포 읽기 전용 점검

```powershell
node ops/tests/live-readonly.mjs --commit 실제_40자리_배포_커밋 --report ops/private/live-check.json
```

기본 대상은 `https://bluedeal.co.kr`입니다. 공개 페이지·정확한 404 응답·배포 커밋·검색 노출 규칙·익명 게시판 응답의 마스킹과 캐시 정책을 확인합니다. 로그인, 글 작성·수정·삭제, 판매처 이동 링크 클릭을 수행하지 않으며 원격 본문이나 문의 내용을 출력하지 않습니다. 운영 DB 쓰기 검증과 실제 제휴 귀속 검증을 대체하지 않습니다.

페이지·관리자·API·정적 이미지·404 응답에서 기본 브라우저 보호 헤더도 확인합니다. [CSP `frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)와 X-Frame-Options는 외부 프레임 삽입을 차단합니다. [nosniff](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options)는 선언된 응답 형식을 사용하게 하며, [Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy)는 다른 출처로 전체 경로·검색어를 보내지 않도록 설정합니다. CSP는 프레임·기준 주소·플러그인·폼 대상에 한정한 기본 보호이며 전체 XSS 방어나 접근 권한 검증을 대체하지 않습니다.

## 로컬 회귀 검사

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
npm run test:profile
npm run test:snapshot
npm run test:ops
```

`test:boards`는 관리자 비밀번호/KV 미설정, 일반 글 작성·목록·상세, 비공개 문의 마스킹과 잠금, 관리자 수정·삭제·로그인·로그아웃을 검사합니다. 빈 비밀번호 해시, 비밀번호 없는 비공개 전환, 빈 비밀번호로 잠금 제거는 회귀 검사에 포함됩니다. 운영 Upstash의 실제 연결 상태를 증명하는 테스트는 아닙니다.

비공개 열람은 `POST /api/posts/{id}/unlock`의 JSON 본문으로 암호를 받습니다. 기존 GET 쿼리의 `pw`는 무시합니다. 응답은 `private, no-store`이며 암호 해시는 반환하지 않습니다. 브라우저와 같은 출처의 요청 허용, 다른 출처 거부, 8 KiB 초과 본문 거부를 함께 검사합니다. `test:post-client`는 클라이언트가 암호를 URL에 넣지 않는지 확인합니다.

클라이언트 검사는 HTTP 200의 잘못된 JSON·HTML·문자열 관리자 플래그·다른 글 ID·암호 해시 포함 응답을 성공으로 취급하지 않는지도 확인합니다. 빈 목록은 실제 `posts: []`일 때만 인정하고 로그인·로그아웃·삭제는 `ok: true`가 필요합니다. 5xx 응답의 임의 진단 문자열을 방문자에게 보여주지 않습니다. 상세 경로의 저장소 장애는 HTTP 500으로 처리하며 404로 바꾸지 않습니다.

Next.js 16 업데이트 회귀 검사에는 동적 페이지·없는 가격 카테고리의 404, `/go`의 허용 판매처 리다이렉트와 허용되지 않은 호스트 차단, 블로그 API의 초안 비공개·관리자 수정·삭제도 포함합니다. 외부 구매 링크는 실제로 따라가지 않습니다.

게시판 입력 검사는 다른 출처의 쓰기 요청·JSON 외 본문·잘못된 UTF-8·배열 및 중첩 추가정보·문자열 공개 플래그·크기 초과를 저장 전에 거부하는지 확인합니다. `Content-Length`가 없는 청크 요청도 실제 바이트로 제한합니다. 유효한 한글 25,000자 작성·30,000자 수정은 내용 손상 없이 저장되어야 합니다. 저장소 요청은 명령 전체를 POST JSON 본문에 넣으며 글·문의·암호 해시를 URL 경로에 넣지 않습니다([Upstash REST API](https://upstash.com/docs/redis/features/restapi)).

새 글의 제목은 200자, 내용은 30,000자, 닉네임은 20자입니다. 게시판 본문은 128 KiB, 로그인·비공개 열람·내부 이동주소 등록은 8 KiB, 블로그 작성·수정은 512 KiB까지 받습니다. 추가정보는 평면 값 32개, 항목 이름 64자, 각 문자열 4,000자입니다. 기존 글의 변경 없는 긴 제목·본문·작성자는 자르지 않습니다. 링크 변환은 본문·추가정보를 합해 20개까지 처리하고 나머지 원본 주소를 보존합니다. 잘못된 수정은 기존 글과 비공개 잠금을 바꾸지 않아야 하며, 저장소 장애나 잘못된 성공 응답은 빈 목록으로 위장하거나 원격 오류 본문을 노출하지 않습니다. 블로그의 관리자 열람 응답도 `private, no-store`와 `Vary: Cookie`로 보호합니다.

`test:collector`는 RAM 3개 생성, 안정적인 이동 코드와 추적값 보존, 잘못된 입력·누락 파일의 기존 결과 보존, dry-run의 무변경 동작을 검사합니다. 실제 상품 가격 확인과 판매처 제휴 귀속 검증은 별도입니다.

`test:profile`은 브라우저 저장소의 접근·읽기·쓰기 차단, 잘못된 저장값, 다른 탭의 변경·전체 삭제, 구독 해제와 서버 렌더링을 확인합니다. 저장할 수 없을 때도 현재 페이지의 닉네임과 글쓰기는 유지하지만, 새로고침 후까지 저장되지는 않습니다. 게시판 목록 검사는 소수·음수·유효하지 않은 조회 개수가 Redis에 정수 범위로 전달되는지도 확인합니다.

`test:snapshot`은 Python/Node 가격 지문의 일치와 상품 옵션·가격·링크 변경 감지를 확인합니다. `test:ops`는 수집기와 원본 검증에 더해, 가상 응답을 이용한 배포 전환·가격 불일치·인증 보호 검사, 임시 로컬 Git 저장소에서 사용자 편집·브랜치·커밋 보존, 가격 전용 업로드와 업로드 후 검증 실패 기록을 확인합니다. 예약 실행 검사는 임시 폴더 안의 가상 게시 도구만 실행하며 실제 작업 스케줄러를 등록하거나 활성화하지 않습니다.

예약 실행용 Windows 기본 PowerShell 5.1을 별도로 검사하려면 해당 테스트 프로세스에서 `BLUEDEAL_TEST_POWERSHELL`을 `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`의 실제 경로로 지정해 `test_publish.py`와 `test_price_task.py`를 실행합니다. 기본 검사는 설치된 `pwsh`를 사용합니다.

화면을 확인하려면 대화형 PowerShell에서 다음 명령을 실행하고 출력된 `LOCAL_PREVIEW` 주소를 여세요.

```powershell
node .\ops\tests\board-smoke.mjs --preview
```

미리보기는 가상 글만 포함하며, `stop` 입력 후 Enter 또는 Ctrl+C로 종료합니다. 임시 KV는 메모리에서만 유지합니다. 자동 실행 도구에서 미리보기를 쓰는 경우 표준 입력이 열린 대화형 세션을 사용하세요.

미리보기 터미널에 `offline`, `partial`, `online`을 입력하면 가상 KV 전체 장애·리뷰 게시판 장애·정상 상태로 전환합니다. 브라우저에서 홈을 새로고침하거나 최신 게시글의 `다시 불러오기`를 눌러 장애 안내와 복구를 확인할 수 있습니다. 운영 KV에 영향을 주지 않습니다.

미리보기의 `logout-fail` / `logout-ok`는 로컬 프록시에서 로그아웃만 실패시키거나 복구합니다. 실제 앱의 인증 쿠키와 같은 출처 검증을 유지한 채, 실패했는데 로그인 화면으로 바뀌는 오작동을 확인합니다. `slow-hardware` / `normal-speed`는 가상 하드웨어 목록 응답에만 2초 지연을 주거나 해제합니다. 새로고침 직후 다른 게시판으로 바꿔도 늦은 이전 응답이 현재 목록을 덮어쓰지 않아야 합니다. 이 동작은 검사 도구에만 있으며 운영 애플리케이션에는 장애 스위치를 추가하지 않습니다.

`malformed-api` / `normal-api`는 로컬 브라우저의 게시글 GET 응답만 잘못된 성공 JSON으로 바꾸거나 복원합니다. 서버의 경로 존재 검사는 정상 가상 KV를 사용하므로 상세 화면의 오류·재시도를 확인할 수 있습니다. `offline` 상태에서 상세 페이지를 열면 Next.js 오류 화면이 나오며, `online` 복원 후 다시 불러오기로 회복되어야 합니다.
