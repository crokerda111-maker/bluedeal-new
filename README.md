# BLUEDEAL
PC 부품 가격현황, IT 소식, 하드웨어 커뮤니티와 핫딜을 제공하는 Next.js 사이트입니다.

- 운영: https://bluedeal.co.kr
- Node.js 24.x / Next.js 16 / React 19 / TypeScript / Tailwind CSS
- 저장소: crokerda111-maker/bluedeal-new
- GitHub main 변경을 Vercel Production으로 자동 배포합니다.

## 로컬 실행

```powershell
npm ci
npm run dev
```

개발 환경의 비밀값은 `.env.local`에 보관합니다. 운영 값을 소스에 복사하지 마세요. 필요한 키와 사용 범위는 [환경변수 안내](ops/ENV_MAP.md)를 참고하세요.

## 변경 검증

```powershell
npm run lint
npm run typecheck
npm run test:prices
npm run test:affiliate
npm run test:collector
npm run build
npm run test:boards
```

게시판 검사는 로컬 임시 KV와 테스트 데이터만 사용합니다. `node ops/tests/board-smoke.mjs --preview`로 검사를 통과한 임시 앱을 계속 열어 볼 수 있습니다. 종료는 터미널에 `stop`을 입력합니다.

## 가격과 판매처 링크

- 실제 확인한 상품과 조건을 `ops/collector/input/products.csv`에 입력합니다. 이 파일은 Git에 포함하지 않습니다.
- `python ops/collector/build_prices.py --dry-run`으로 검증하고, 옵션 없이 실행해 공개 JSON과 안정적인 `/go/{code}` 매핑을 생성합니다.
- 실제 확인 시각 `checkedAt`과 파일 생성 시각 `generatedAt`을 구분합니다. CSV를 재생성해도 확인 시각을 갱신하지 않습니다.
- RAM 총용량·DDR 규격과 SSD 용량·DRAM 여부는 확인한 구조화 필드로 검색합니다. 배송비 미확인은 무료로 계산하지 않습니다.
- 가격표 링크는 배포된 매핑을 우선 사용하므로 온라인 KV 장애 중에도 작동합니다. 클릭 통계는 응답 뒤에 저장합니다.
- 제휴 링크는 공식 계정에서 발급한 완성된 주소를 사용합니다. 임의의 태그 추가로 실적 귀속을 주장하지 않습니다. 실제 클릭·실적은 제휴처 리포트에서 확인해야 합니다.
- 현재 실상품 가격은 수동 확인 단계입니다. 자동 수집과 정시 배포의 활성화 여부는 운영 기록에서 확인하세요.

자세한 입력 규칙은 [가격 생성기 안내](ops/collector/README.md), 내부 등록 인증은 [링크 등록 API 안내](ops/OUTBOUND_INGEST.md)에 있습니다.

## 운영 원칙

`/api/version`에서 서비스 버전과 배포된 공개 Git 커밋을 확인할 수 있습니다. 비밀값은 반환하지 않습니다. 게시판의 관리자 로그인과 동적 데이터 저장에는 Vercel의 ADMIN_PASSWORD 및 KV 환경변수가 필요합니다.

Cafe24/DNS/VPS 설정은 의존 관계를 확인하기 전 변경하지 않습니다. 배포 확인은 Vercel READY 상태뿐 아니라 운영 도메인의 커밋·실제 화면·핵심 API까지 확인합니다.

보안 패치를 위해 `@typescript-eslint/typescript-estree`의 minimatch를 11.0.8로 제한했습니다. 상위 의존성이 해결되면 override 필요성을 다시 확인하세요. 설치 시 ESLint 플러그인의 peer 지원 표기 경고가 발생할 수 있으므로 실제 린트 결과도 함께 확인합니다.
