# DNS 연결 런북 (도메인 ↔ Vercel / VPS)

이 문서는 **도메인/DNS를 어디에 어떻게 연결해야 하는지**를 실수 없이 반복하기 위한 체크리스트입니다.

> 원칙
> - 프론트(Next.js)는 **Vercel**이 안내하는 레코드 값을 그대로 따라간다.
> - 가격 API는 `api.<domain>`을 **VPS 공인 IP(A 레코드)** 로 연결한다.
> - DNS 값(특히 apex A/CNAME)은 공급사/시점에 따라 변동될 수 있으니, **Vercel Domains 화면의 안내가 최우선**.

---

## 1) 목표 라우팅

| 호스트 | 목적지 | 비고 |
|---|---|---|
| `bluedeal.co.kr` | Vercel | 사이트(프론트) — Primary 추천 |
| `www.bluedeal.co.kr` | Vercel | 선택(리다이렉트 정책 통일) |
| `api.blusedeal.co.kr` | VPS | 가격 JSON API(정적 JSON) |
| `blusedeal.co.kr` | VPS | 사람이 치면 `bluedeal.co.kr`로 301 리다이렉트(혼동 방지) |
| `www.blusedeal.co.kr` | VPS | 동일(301 리다이렉트) |
| (선택) `api.bluedeal.co.kr` | VPS | 필요 시 가격 API 별칭(같은 IP). 없으면 생략 |

---

## 2) Vercel에 도메인 추가

1. Vercel 프로젝트 → **Settings → Domains**
2. `bluedeal.co.kr` 입력 → Add
3. Vercel이 제시하는 DNS 레코드(A/CNAME 등)를 **DNS 관리 콘솔에 그대로 추가**

✅ 체크
- Vercel Domains 화면에서 “Valid Configuration” 상태가 되는지
- DNS 전파는 시간이 걸릴 수 있음

---


## 2.1) VPS 도메인(apex) 리다이렉트 (권장)

`blusedeal.co.kr`은 **카페24 VPS 인프라 도메인**으로 두고,
사람이 브라우저에서 치면 `bluedeal.co.kr`로 **301 리다이렉트**만 하게 두는 것을 권장합니다.

> 중요: `api.blusedeal.co.kr`은 가격 JSON 원본입니다. 여기는 리다이렉트하면 안 됩니다.

## 3) VPS(A 레코드) 연결

DNS 관리 콘솔에서 A 레코드 추가:

- Host/Name: `api` (즉, `api.blusedeal.co.kr`)
  - Type: `A`
  - Value: `<VPS 공인 IP>`
- Host/Name: `@` (즉, `blusedeal.co.kr`)
  - Type: `A`
  - Value: `<VPS 공인 IP>`
- Host/Name: `www` (즉, `www.blusedeal.co.kr`)
  - Type: `A`
  - Value: `<VPS 공인 IP>`

✅ 체크
- `nslookup api.blusedeal.co.kr`로 IP가 VPS로 나오는지
- `https://api.blusedeal.co.kr/meta.json`이 200으로 열리는지
- `https://blusedeal.co.kr`가 301로 `https://bluedeal.co.kr`로 이동하는지

---

## 4) SSL(HTTPS) 체크

### Vercel
- Vercel은 기본적으로 HTTPS를 처리합니다.

### VPS
- nginx + certbot 환경이면:
  - (가격 API + 리다이렉트 도메인 한번에)
    - `sudo certbot --nginx -d api.blusedeal.co.kr -d blusedeal.co.kr -d www.blusedeal.co.kr`

✅ 체크
- 인증서 만료 전 갱신 자동화(보통 certbot timer/cron)

---

## 5) 자주 나는 실수

- (1) **Preview 환경**에서만 테스트했는데 Production env에 변수/DNS가 없음
- (2) `api`를 CNAME으로 걸어버려 VPS로 안 감
- (3) nginx는 떠있는데 `root` 경로에 `meta.json`이 없음
- (4) `PRICE_API_BASE`가 `http://`로 되어 Mixed Content로 막힘(반드시 https)

---

## 6) 빠른 점검(curl)

> 아래 명령은 로컬/어디서든 실행 가능합니다.

```bash
# 1) 가격 API는 200이어야 함
curl -I https://api.blusedeal.co.kr/meta.json

# 2) blusedeal(apex)은 301이고, Location이 bluedeal이어야 함
curl -I https://blusedeal.co.kr/

# 3) www도 동일하게 301
curl -I https://www.blusedeal.co.kr/

# 4) (중요) api는 리다이렉트가 아니어야 함
curl -I https://api.blusedeal.co.kr/prices/ram.json
```
