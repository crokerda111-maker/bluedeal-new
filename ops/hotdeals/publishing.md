# 블루딜 핫딜 게시

Windows 로그인 세션에서 링크프라이스 공식 후보를 매일 09:00, 17:00 KST에 받습니다. 응답은 `ops/private/linkprice-review`에서 검토합니다. 커뮤니티 게시물과 제휴 피드의 표시 가격은 상품 검토에만 사용합니다.

동일한 판매 옵션, 판매 가능 상태, 실제 배송비와 할인 조건을 확인한 상품은 `ops/private/hotdeal-publisher/reviewed`에 JSON 하나로 저장합니다. 필드는 `reviewed: true`, `availability: "in-stock"`, `productUrl`, `category`, `title`, `option`, `price`, `shipping`, `conditions`, `review`, `issue`, `notesSource`, `checkedAt`, `validUntil`입니다. 금액은 정수 원화이며 시간은 시간대가 명시된 ISO 8601을 사용합니다. 제휴 링크는 기존 공식 등록 경로에서 동일한 원본 주소로 연결합니다. 조건과 후기에는 출처에서 확인한 내용과 적용 범위를 넣습니다.

`priceHistory` 배열에는 실제 판매 페이지에서 확인한 `productUrl`, `option`, `conditions`, `at`, `price`, `shipping`, `availability: "in-stock"`을 기록합니다. 모델·색상·수량·보증과 할인 적용 조건이 일치해야 합니다. 같은 판매 페이지에서 최근 30일간 다른 날짜 3일 이상 확인했거나, 최근 6시간에 다른 판매처 두 곳 이상의 같은 옵션 공개가를 확인해야 합니다. 판매처를 넘겨 비교하는 경우 후보와 관측값에 `publicPrice: true`를 넣습니다. 회원·카드·개인 쿠폰 조건은 동일 판매 페이지에서 동일 조건의 이력만 비교합니다. 확인된 최저 배송비 포함 가격보다 3% 넘게 비싸면 게시를 거절합니다.

`node ops/hotdeals/publish-reviewed.mjs`는 현재 게시 대상만 세어 봅니다. `--publish`는 생산 게시 엔드포인트에서 최신성·제휴 등록을 다시 검사하고 동일 상품·옵션·가격·일자 중복을 방지합니다. 발행 여부는 `results`와 `last-run.local.json`에서 확인합니다. `register_publisher.ps1 -Install`은 30분 간격 게시 작업과 공식 피드 후보 수집 작업을 등록합니다. 쿠팡 후보의 무인 가격 확인은 공식 API 승인 후 연결할 수 있습니다.
