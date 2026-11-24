# 블루딜 핫딜 게시

Windows 로그인 세션에서 링크프라이스 공식 후보를 매일 09:00, 17:00 KST에 받습니다. 응답은 `ops/private/linkprice-review`에서 검토합니다. 공개 커뮤니티와 핫딜모음에서도 후보를 찾을 수 있습니다.

동일한 판매 옵션, 판매 가능 상태, 실제 배송비와 할인 조건을 확인한 상품은 `ops/private/hotdeal-publisher/reviewed`에 JSON 하나로 저장합니다. 필드는 `reviewed: true`, `availability: "in-stock"`, `productUrl`, `category`, `title`, `option`, `price`, `shipping`, `conditions`, `review`, `issue`, `notesSource`, `checkedAt`, `validUntil`입니다. 금액은 정수 원화이며 시간은 시간대가 명시된 ISO 8601을 사용합니다. 제휴 링크는 기존 공식 등록 경로에서 동일한 원본 주소로 연결합니다. 조건과 후기에는 출처에서 확인한 내용과 적용 범위를 넣습니다.

`priceHistory` 배열에는 실제 판매 페이지에서 확인한 `productUrl`, `option`, `conditions`, `at`, `price`, `shipping`, `availability: "in-stock"`을 기록합니다. 모델·색상·수량·보증과 할인 적용 조건이 일치해야 합니다. 같은 판매 페이지에서 최근 30일간 다른 날짜 3일 이상 확인했거나, 최근 6시간에 다른 판매처 두 곳 이상의 같은 옵션 공개가를 확인해야 합니다. 판매처를 넘겨 비교하는 경우 후보와 관측값에 `publicPrice: true`를 넣습니다. 회원·카드·개인 쿠폰 조건은 동일 판매 페이지에서 동일 조건의 이력만 비교합니다. 확인된 최저 배송비 포함 가격보다 3% 넘게 비싸면 게시를 거절합니다.

로우차트 상품 상세에 표시된 관측 최저 상품가를 사용하려면 쿠팡의 동일 상품·옵션·판매자 구매 페이지에서 회원·쿠폰 없이 적용되는 상품가와 배송비를 따로 확인합니다. 관측 최저 상품가와 실제 일반 상품가가 일치할 때 `publicPrice: true`와 `coupangTrackedLow: { url, checkedAt, observedLow }`를 넣습니다. `url`은 로우차트 상품 상세, 내부 `checkedAt`은 이력 확인 시각, `observedLow`는 관측 상품가입니다. 이력 확인 후 두 시간 이내 확인한 쿠팡 가격을 쓸 수 있으며 유효 범위는 판매 확인 후 최대 여섯 시간입니다. 로우차트 상품가 이력과 현재 배송 조건을 공개 상세에서 확인할 수 있습니다.

외부 소개 딜은 `availability: "source-listed"`과 `sourceReview: { url, publishedAt, status: "listed", basis }`를 넣습니다. `basis`는 원글의 가격 비교가 있으면 `"price-comparison"`, 구체적인 쿠폰·행사 근거가 있으면 `"published-discount"`입니다. 인기 순위만으로 발행하지 않습니다. 원글에서 같은 모델·옵션의 가격, 배송 조건과 종료 표기를 확인하고, 판매처 개별 상품 주소를 `productUrl`에 입력합니다. `checkedAt`에는 원글을 마지막으로 확인한 시각을 넣습니다. 종료가 먼저 확인되면 그 시각까지, 그 외에는 원글 게시 후 최대 24시간까지만 홈과 진행 목록에 표시합니다. 제목·본문은 가격·수량·조건 등 사실을 바탕으로 새로 작성합니다. 외부 게시물의 사진이나 본문은 복제하지 않습니다.

`node ops/hotdeals/publish-reviewed.mjs`는 현재 게시 대상만 세어 봅니다. `--publish`는 운영 게시 엔드포인트에서 가격 근거·최신성을 확인하고 동일 상품·옵션·가격·일자 중복을 방지합니다. 일치하는 블루딜 제휴 링크가 등록돼 있으면 해당 링크로 연결하며, 일반 상품도 판매처 주소로 연결합니다. 발행 여부는 `results`와 `last-run.local.json`에서 확인합니다. `register_publisher.ps1 -Install`은 30분 간격 게시 작업과 공식 피드 후보 수집 작업을 등록합니다.

30분 간격 게시 작업은 마감이 가까운 핫딜부터 게시하고, 같은 실행에서 `news-publisher/reviewed`에 들어온 기사도 게시합니다. 기사 원고는 번역·문장 수정·오탈자·민감 표현 검토를 모두 거쳐야 합니다. 서버에서 거절된 항목은 내용을 수정하면 다시 평가합니다. 각 게시 결과는 핫딜과 뉴스 폴더의 `last-run.local.json`에서 확인할 수 있습니다.
