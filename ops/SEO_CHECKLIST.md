# 검색 노출 운영 안내

- 운영 주소는 https://bluedeal.co.kr 입니다. canonical과 공유 메타데이터의 기준 주소로 사용합니다.
- 사이트맵: https://bluedeal.co.kr/sitemap.xml
- 로봇 안내: https://bluedeal.co.kr/robots.txt
- 공유 이미지: https://bluedeal.co.kr/opengraph-image (1200×630 PNG)
- RAM 등 상품이 등록된 가격 카테고리만 사이트맵에 포함합니다. 비어 있는 가격 카테고리와 검색·필터 쿼리는 noindex로 처리합니다.
- 관리자, 문의, 글쓰기 화면은 noindex입니다. robots.txt의 제외는 접근 통제가 아니며 실제 비공개 글은 기존 비밀번호·관리자 권한 검사로 보호합니다.
- 비공개 문의 ID, 내용, 암호, 관리자 경로는 사이트맵에 넣지 않습니다.
- Preview 배포는 검색 제외로 설정합니다.
- WebSite 구조화 데이터에는 사이트 이름과 운영 URL만 제공합니다. 검증하지 않은 평점·가격·재고를 검색용 데이터로 만들지 않습니다.
- Search Console/네이버 서치어드바이저의 소유 확인과 사이트맵 제출은 계정에서 별도 확인해야 합니다. 기술 설정이나 제출만으로 검색 수집·순위를 보장하지 않습니다.

수정 후에는 npm run build와 npm run test:boards를 실행합니다. 실제 HTML의 제목·canonical·robots, 사이트맵의 제외 경로, 공유 이미지의 PNG 형식과 크기를 함께 검사합니다. robots.txt는 Next.js 공식 메타데이터 파일 규칙을 사용합니다.

참고한 공식 문서 (2026-11-16 확인)
- https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
- https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
- https://nextjs.org/docs/app/api-reference/functions/image-response
