# 제휴링크 등록 API

PC 가격 수집기와 신뢰된 내부 작업은 상품 원주소를 아래 API에 등록합니다.

- `POST /api/internal/outbound/register`
- 인증: `Authorization: Bearer <OUTBOUND_INGEST_SECRET>`
- 본문: `{"url":"https://판매처/상품주소"}`

성공 응답에는 공개용 `/go/{code}` 주소와 판매처, 제휴 변환 상태가 포함됩니다.

```json
{
  "code": "example-code",
  "goUrl": "https://bluedeal.co.kr/go/example-code",
  "merchant": "coupang",
  "normalizedUrl": "https://www.coupang.com/vp/products/123",
  "affiliateMode": "converted"
}
```

## 변환 상태

- `converted`: 블루딜의 검증된 제휴 설정이 적용됨
- `already-affiliate`: 판매처의 공식 제휴/단축 주소라서 그대로 보존
- `passthrough`: 판매처는 지원하지만 제휴 설정이 없어 원주소 사용

## 보안 원칙

- `OUTBOUND_INGEST_SECRET`은 최소 24자 이상의 무작위 값으로 설정합니다.
- 비밀값은 Git에 저장하지 않고 PC와 Vercel 환경변수에만 둡니다.
- 임의 사이트로 보내는 오픈 리다이렉트를 막기 위해 등록 가능한 판매처를 제한합니다.
- 제휴처에서 발급·확인하지 않은 파라미터는 임의로 붙이지 않습니다.
