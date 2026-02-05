# BLUEDEAL 업데이트 가이드 (v2)

## 1) ZIP로 덮어쓰기 업데이트(가장 쉬움)

1. 기존 프로젝트 폴더에서 **.next/**, **out/** 같은 빌드 산출물이 있으면 삭제(선택).
2. 이번 ZIP 파일을 기존 프로젝트 루트에 **덮어쓰기**로 풀기.
3. 터미널에서 아래 실행:

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속해서 동작 확인.

---

## 2) Git으로 업데이트(추천)

프로젝트가 git으로 관리되고 원격(origin)에 연결된 경우:

```bash
git status
# 변경사항 있으면 커밋하거나 stash
git stash -u

git pull origin main   # 브랜치가 main이 아니라면 해당 브랜치명
npm install
npm run dev
```

---

## 3) Vercel 배포 흐름

- GitHub 연결된 상태면: **commit → push** 하면 Vercel이 자동 빌드/배포
- 환경변수 필요시(Vercel Project Settings > Environment Variables):
  - `PRICE_API_BASE` : 가격현황 JSON API Base URL (예: https://api.example.com)

빌드 명령 기본:
- Build: `next build`
- Output: (Next.js 기본)

---

## 4) VPS(Cafe24) 배포 흐름(예시)

> 권장: **VPS에서 크롤링/스케줄링**, 프론트는 Vercel/Next로 렌더링

### A. 직접 실행(간단)
```bash
npm install
npm run build
npm run start
```

### B. PM2로 상시 실행(추천)
```bash
npm install
npm run build
pm2 start npm --name bluedeal -- start
pm2 save
```

---

## 5) 이번 v2 변경점 요약

- 상단 메뉴 순서: **IT 소식 → 커뮤니티(드롭다운) → 가격현황(드롭다운) → 핫딜(드롭다운) → 문의**
- 커뮤니티에 **이슈공유 게시판 추가**
- 문의는 **게시판 통합**: 글 작성 시 공개/비공개 선택 (비공개는 비밀번호로 잠금)
- 자료실 자료 종류: **드라이버 / 시스템 / 최적화 / 모니터링**
- 홈 화면:
  - 메인 리스트를 **실시간 게시글**로 변경
  - "오늘의 현황"에서 가격현황 바로가기 제공
  - 하단 "실시간 핫딜"은 **글 링크만 노출**(제품/제휴 링크는 상세에서만)
- 핫딜 리스트 페이지는 **/hot** 로 분리 (상세는 /deals/[id])

---

## 6) 닉네임(회원가입 전 MVP 방식)

- 상단 우측 **닉네임 설정** 버튼으로 닉네임 저장
- 글쓰기 폼에서 작성자는 자동으로 이 닉네임을 사용(읽기 전용)
- 실제 회원가입/메일 인증은 다음 단계에서 API/DB 연동으로 교체 가능
