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
  "affiliateMode": "passthrough"
}
```

## 변환 상태

- `already-affiliate`: 판매처의 제휴/단축 호스트 형식을 인식해 그대로 보존. 링크 소유 계정이나 수익 귀속을 보증하는 값은 아닙니다.
- `passthrough`: 판매처는 지원하지만 제휴 설정이 없어 원주소 사용

실제 귀속은 공식 계정에서 발급한 링크로 이동하는지와 제휴처 클릭·실적 리포트를 확인해야 합니다. 일반 상품 URL에 태그를 임의로 추가하는 변환은 제공하지 않습니다. 링크프라이스 중간 도메인은 실제 발급 링크의 목적지·형식을 확인한 뒤 지원합니다.

## 보안 원칙

- `OUTBOUND_INGEST_SECRET`은 최소 24자 이상의 무작위 값으로 설정합니다.
- 비밀값은 Git에 저장하지 않고 PC와 Vercel 환경변수에만 둡니다.
- 임의 사이트로 보내는 오픈 리다이렉트를 막기 위해 등록 가능한 판매처를 제한합니다.
- 제휴처에서 발급·확인하지 않은 파라미터는 임의로 붙이지 않습니다.
