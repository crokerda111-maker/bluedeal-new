# BLUEDEAL Price API (카페24 VPS) 가이드

목표:
- Vercel(Next.js)은 **화면/라우팅** 담당
- 카페24 VPS는 **가격 JSON 생성/서빙(API)** 담당
- 사이트는 `PRICE_API_BASE`에서 JSON을 읽어 `/prices/*`에 표시

이번 기준 갱신 주기:
- **매일 09:00 / 17:00** (2회)

---
## 1) DNS (카페24)

카페24 DNS에 A 레코드 추가(최소 구성):
- `@` → VPS 공인 IP (즉, `blusedeal.co.kr`)
- `www` → VPS 공인 IP (즉, `www.blusedeal.co.kr`, 선택)

그러면 아래처럼 역할이 분리됩니다:
- 사이트(홈페이지): `https://bluedeal.co.kr` (Vercel)
- 가격 JSON 원본: `https://blusedeal.co.kr` (VPS)

> 참고: `api.blusedeal.co.kr` 같은 전용 서브도메인 분리는 “가능하면” 좋지만,
> 카페24 관리형/워드프레스 VPS 환경에서는 vhost 제약으로 403이 나는 경우가 있어
> **현재는 `blusedeal.co.kr` 하나로 `/meta.json`, `/prices/*.json`을 서빙하는 구성이 가장 안정적**입니다.

---
## 2) VPS에 정적 JSON 서빙 (nginx 예시)

### 2.1) 카페24 관리형/워드프레스 VPS 빠른 방법 (권장)

카페24 **워드프레스 관리형 VPS**에서는 nginx/openresty 설정을 직접 만지기 어려운 경우가 많습니다.
이때는 가장 단순하게 **웹루트에 파일만 두고** 끝내는 게 안정적입니다.

대화 로그 기준 웹루트 예시:
- `/crokerda1/www`

해야 할 것:
- `/crokerda1/www/meta.json`
- `/crokerda1/www/prices/{category}.json`

예시:
```bash
mkdir -p /crokerda1/www/prices

# 샘플 생성(레포에 포함된 스크립트 사용)
python3 ops/vps/bin/update_prices.py --out /crokerda1/www
```

✅ 체크:
- `https://blusedeal.co.kr/meta.json` 이 200
- `https://blusedeal.co.kr/prices/ram.json` 이 200

### (1) 폴더 준비
```bash
sudo mkdir -p /srv/bluedeal-api/public/prices
sudo chown -R $USER:$USER /srv/bluedeal-api
```

### (2) nginx server block 예시
`/etc/nginx/sites-available/blusedeal.co.kr` 같은 파일에:

```nginx
server {
  server_name blusedeal.co.kr www.blusedeal.co.kr;

  root /srv/bluedeal-api/public;

  location / {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=60";
  }
}
```

활성화 후:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### (3) HTTPS (certbot)
환경에 따라 설치 여부가 다릅니다.

nginx + certbot이 가능하면(권장):

```bash
# 가격 JSON 도메인을 한 번에 발급
sudo certbot --nginx -d blusedeal.co.kr -d www.blusedeal.co.kr
```

✅ 체크:
- `https://blusedeal.co.kr/meta.json` 이 200인지
- `https://blusedeal.co.kr/prices/ram.json` 이 200인지

---
## 3) JSON 파일 스키마

필수 파일:
- `/meta.json`
- `/prices/ram.json`
- `/prices/cpu.json`
- `/prices/ssd.json`
- `/prices/motherboard.json`
- `/prices/gpu.json`
- `/prices/cooler.json`
- `/prices/halfpc.json`
- `/prices/fullpc.json`

예시(`prices/ram.json`):
```json
{
  "category": "ram",
  "updatedAt": "2026-02-06T09:00:00+09:00",
  "items": [
    {
      "id": "ram-1",
      "name": "제품명",
      "spec": "스펙 요약",
      "price": 129000,
      "low7d": 125000,
      "low30d": 119000,
      "change24hPct": -0.8,
      "url": "https://example.com",
      "goCode": "d1",
      "source": "sample"
    }
  ]
}
```

---
## 4) 갱신(업데이트) 방법

### 방법 A) 수동 업데이트 (가장 단순)
`/srv/bluedeal-api/public/` 아래 JSON을 직접 수정/업로드하고
`meta.json.updatedAt`만 최신으로 바꾸면 됩니다.

### 방법 B) 스크립트 + cron (추천)
이 레포의 `ops/vps/bin/update_prices.py`는
샘플 데이터를 기준으로 JSON을 생성합니다.

VPS에서 실행 예시:
```bash
python3 /path/to/repo/ops/vps/bin/update_prices.py --out /srv/bluedeal-api/public
```

크론(매일 09:00/17:00):
```bash
crontab -e
```

```cron
0 9,17 * * * /usr/bin/python3 /srv/bluedeal-api/bin/update_prices.py --out /srv/bluedeal-api/public >> /var/log/bluedeal-prices.log 2>&1
```

※ 위 경로는 예시입니다. 실제로는 `update_prices.py`를 `/srv/bluedeal-api/bin/`로 복사해 두는 편이 관리가 쉽습니다.

---
## 5) Vercel 설정

Vercel 프로젝트 → Environment Variables에 추가:
- `PRICE_API_BASE=https://blusedeal.co.kr`

그러면 사이트는 자동으로 VPS의 JSON을 읽어와 가격현황을 표시합니다.
