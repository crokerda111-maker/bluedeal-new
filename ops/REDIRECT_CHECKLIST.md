# VPS 리다이렉트 점검 가이드

목적:
- `blusedeal.co.kr` / `www.blusedeal.co.kr`로 들어오는 사용자를 **항상 `https://bluedeal.co.kr`로 301 리다이렉트**
- `api.blusedeal.co.kr`(가격 JSON 원본)은 **리다이렉트하지 않고 200으로 서빙**

> 이 가이드는 “한 번 설정하고 끝”이 아니라,
> DNS/SSL/nginx 설정이 바뀌었을 때 **바로 재점검**할 수 있도록 만든 체크리스트입니다.

---

## 1) 기대 동작(정답 기준)

### A) 리다이렉트 대상
- `http://blusedeal.co.kr/*` → `https://bluedeal.co.kr/*` (301)
- `https://blusedeal.co.kr/*` → `https://bluedeal.co.kr/*` (301)
- `http://www.blusedeal.co.kr/*` → `https://bluedeal.co.kr/*` (301)
- `https://www.blusedeal.co.kr/*` → `https://bluedeal.co.kr/*` (301)

✅ **요구 사항**
- **301(Moved Permanently)**
- **Path + Query 유지** (`$request_uri`)
- 리다이렉트가 2번 이상 연쇄로 걸리지 않도록(가능하면 한 번에)

### B) 리다이렉트하면 안 되는 대상
- `https://api.blusedeal.co.kr/meta.json` → **200**
- `https://api.blusedeal.co.kr/prices/*.json` → **200**

---

## 2) DNS 점검

아래 3개 호스트가 **VPS 공인 IP**로 가야 합니다.

- `api.blusedeal.co.kr`
- `blusedeal.co.kr`
- `www.blusedeal.co.kr`

명령 예시:
```bash
nslookup api.blusedeal.co.kr
nslookup blusedeal.co.kr
nslookup www.blusedeal.co.kr
```

✅ 기대값
- Address가 VPS 공인 IP로 나옴

---

## 3) nginx 리다이렉트 설정 예시(권장)

> 실제 파일명/경로는 환경마다 다릅니다.
> Debian/Ubuntu + nginx 기준으로 `/etc/nginx/sites-available/` 예시를 듭니다.

### A) 리다이렉트용 server block
예: `/etc/nginx/sites-available/blusedeal.redirect.conf`

```nginx
# 1) HTTP → HTTPS + 메인 도메인으로 301
server {
  listen 80;
  server_name blusedeal.co.kr www.blusedeal.co.kr;
  return 301 https://bluedeal.co.kr$request_uri;
}

# 2) HTTPS → 메인 도메인으로 301
server {
  listen 443 ssl http2;
  server_name blusedeal.co.kr www.blusedeal.co.kr;

  # certbot/nginx 환경이면 여기 ssl 설정은 자동으로 채워질 수 있습니다.
  # ssl_certificate /etc/letsencrypt/live/blusedeal.co.kr/fullchain.pem;
  # ssl_certificate_key /etc/letsencrypt/live/blusedeal.co.kr/privkey.pem;

  return 301 https://bluedeal.co.kr$request_uri;
}
```

✅ 핵심
- `return 301 https://bluedeal.co.kr$request_uri;` 이 한 줄이 **경로/쿼리 유지**의 포인트

### B) 가격 API(server block)는 분리
`api.blusedeal.co.kr`는 별도 server block으로 두고, `root /srv/bluedeal-api/public;`에서 JSON을 서빙해야 합니다.

---

## 4) SSL(certbot) 점검

VPS에서 아래 3개 도메인을 한 번에 발급(권장):
```bash
sudo certbot --nginx -d api.blusedeal.co.kr -d blusedeal.co.kr -d www.blusedeal.co.kr
```

✅ 체크
- `sudo certbot certificates`에서 만료일 확인
- 자동 갱신(timer/cron) 동작 확인

---

## 5) curl로 1분 점검(가장 중요)

### A) 리다이렉트가 정확한지
```bash
# 1) apex는 301
curl -I https://blusedeal.co.kr/

# 2) www도 301
curl -I https://www.blusedeal.co.kr/

# 3) 경로/쿼리 유지되는지
curl -I 'https://blusedeal.co.kr/prices?utm=check'
```

✅ 기대값
- Status: `HTTP/2 301` 또는 `HTTP/1.1 301`
- `Location: https://bluedeal.co.kr/...` 로 나와야 함

### B) 리다이렉트가 “한 번만” 걸리는지
```bash
curl -IL https://blusedeal.co.kr/ | head -n 20
```

✅ 기대값
- 301 → 200(최종) 형태로 끝
- 301이 반복되면(루프) nginx 설정 충돌 가능

### C) 가격 API는 리다이렉트가 아니어야 함
```bash
curl -I https://api.blusedeal.co.kr/meta.json
curl -I https://api.blusedeal.co.kr/prices/ram.json
```

✅ 기대값
- Status: 200
- `Location:` 헤더가 없어야 함

---

## 6) 자주 나는 오류와 원인

- **리다이렉트가 200으로 뜸**
  - DNS가 VPS가 아니라 다른 곳(Vercel/파킹/오타)으로 가는 중
  - nginx `server_name`이 매칭 안 되어 default server가 잡힘

- **리다이렉트가 302로 뜸**
  - 임시 설정/도구 설정(프록시/패널)이 302를 쓰는 경우
  - SEO 관점에서는 301로 고정 권장

- **api.blusedeal도 리다이렉트 됨(치명적)**
  - redirect server block이 `server_name _;` 같은 catch-all로 잡혀있는 경우
  - `api.blusedeal.co.kr` server block이 없거나 우선순위가 밀린 경우

- **https에서 인증서 에러**
  - certbot이 `blusedeal.co.kr` / `www.blusedeal.co.kr`를 포함해서 발급되지 않음
  - 만료/갱신 실패

---

## 7) 변경 후 필수 절차

nginx 설정 수정 후:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

그리고 위 **curl 1분 점검**을 다시 수행합니다.
