# BLUEDEAL DNS 운영

현재 홈페이지와 가격 데이터는 모두 Vercel 배포 하나에서 제공합니다. 카페24 VPS나 별도 가격 API 도메인은 사용하지 않습니다.

## 사용하는 도메인

| 호스트 | 대상 | 용도 |
|---|---|---|
| `bluedeal.co.kr` | Vercel | 기본 홈페이지 |
| `www.bluedeal.co.kr` | Vercel | 기본 도메인으로 리다이렉트 |

DNS 값은 Vercel 프로젝트의 Settings → Domains 화면에 표시되는 값을 그대로 사용하세요. 화면 안내와 다른 A/CNAME 값을 임의로 넣지 않습니다.

## 사용하지 않는 항목

- `blusedeal.co.kr`은 BLUEDEAL 코드와 가격 갱신에 필요하지 않습니다.
- `api.bluedeal.co.kr`도 현재 필요하지 않습니다.
- 만료된 카페24 VPS IP를 가리키는 A 레코드는 홈페이지 운영과 무관합니다.

오타 도메인을 별도 보유하고 있다면 나중에 브랜드 보호용 리다이렉트로 연결할 수 있지만, VPS를 결제할 이유는 없습니다.

## 확인

```powershell
nslookup bluedeal.co.kr
nslookup www.bluedeal.co.kr
```

브라우저에서는 다음을 확인합니다.

- `https://bluedeal.co.kr` 접속
- HTTPS 인증서 정상
- `www` 주소가 기본 도메인으로 이동
- Vercel 최신 Production 배포와 화면이 일치
