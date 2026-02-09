# BLUEDEAL 업데이트 가이드 (v8)

> 이 ZIP은 **전체버전(full project)** 입니다. (일부 패치 파일이 아니라, 프로젝트 전체가 들어있습니다.)

## 0) 가장 중요한 원칙

- **ZIP 파일 자체를 Git에 올리지 마세요.** (Vercel은 ZIP을 풀어 빌드하지 않습니다)
- ZIP을 풀어서 **`src/`, `package.json` 같은 실제 소스파일이 변경**되어야 배포 화면이 바뀝니다.
- 덮어쓰기 방식은 **파일/폴더 삭제를 자동으로 처리하지 못합니다.**
  - 예: `src/app/contact/[visibility]` 같은 폴더가 예전에 생겼다면 **수동으로 삭제**해야 합니다.

추가로, "운영자가 꼭 만져야 하는 지점"은 아래 문서에 따로 정리했습니다.
- `OWNER_EDIT_ME.md`
- `DEPLOY_CHECKLIST.md`

---

## 1) GitHub Desktop로 업데이트 (권장)

### 1-1. 새 ZIP을 프로젝트에 반영

1. GitHub Desktop에서 해당 레포 선택
2. 메뉴에서 `Repository` → **Show in Explorer** (폴더 열기)
3. 이번 ZIP을 **다른 폴더에 먼저 압축 해제**
4. 압축 해제한 폴더 안의 내용(예: `src`, `package.json`, `tailwind.config.ts` …)을
   **레포 루트(= package.json이 있는 폴더)** 에 복사 → **덮어쓰기**

### 1-2. 덮어쓰기 후 “삭제가 필요한 폴더” 체크

- 덮어쓰기는 “삭제”를 못합니다.
- 아래 폴더가 남아 있으면 Vercel 빌드가 실패할 수 있습니다.

**꼭 확인:**
- `src/app/contact/[visibility]` ← 있으면 **삭제**

### 1-3. Commit → Push

1. GitHub Desktop `Changes` 탭에서 **`.zip` 파일이 아니라** `src/...` 같은 코드 변경이 보이는지 확인
2. Summary 입력
3. **Commit to main**
4. 오른쪽 상단 **Push origin**

---

## 2) Vercel 배포 확인

- GitHub에 `Push` 되면 Vercel이 자동으로 빌드/배포합니다.
- Vercel 프로젝트 → **Deployments**에서 최신 배포 상태 확인
  - `Ready` = 성공
  - `Failed` = 로그 확인 필요

---

## 3) 자주 나는 빌드 에러와 해결

### A) 라우트 충돌: `('id' == 'visibility')`

원인:
- 같은 위치에 동적 라우트가 2개 존재
  - 예: `src/app/contact/[id]` 와 `src/app/contact/[visibility]` 동시 존재

해결:
- 하나만 남기고 나머지 삭제(문의 통합 구조에서는 `[visibility]` 제거)

### B) `useSearchParams()` prerender 오류

원인:
- 서버 사전 렌더링 중에 `useSearchParams()` 같은 클라이언트 훅 사용

해결:
- Client 컴포넌트로 분리 + `Suspense` wrapper 사용

---

## 4) 카페24 VPS 관련

권장 구조:
- **VPS = 크롤링/스케줄링/DB**
- **Vercel(Next.js) = 화면 렌더링/게시판 UI**

운영 단계에서는 VPS가 수집한 JSON/DB를 API로 제공하고, Next는 그걸 읽어서 보여주면 안전합니다.

---

## 변경 요약 (v5)

- 홈 레이아웃 순서 조정: **가격현황/오늘의 현황(히어로)** 를 상단에 두고, **실시간 게시글(상위 3개)** 은 한 섹션 아래로 이동

---

## 변경 요약 (v8)

- `/prices*` 화면의 문의 링크를 **`/contact/write?vis=public`**(공개 문의 작성)으로 정리
- 운영자용 문서 추가: `OWNER_EDIT_ME.md`, `DEPLOY_CHECKLIST.md`
