# BLUEDEAL Price API (카페24 VPS) 가이드

목표:
- Vercel(Next.js)은 **화면/라우팅** 담당
- 카페24 VPS는 **가격 JSON 생성/서빙(API)** 담당
- 사이트는 `PRICE_API_BASE`에서 JSON을 읽어 `/prices/*`에 표시

이번 기준 갱신 주기:
- **매일 09:00 / 17:00** (2회)

---
## 1) DNS (카페24)

카페24 DNS에 A 레코드 추가:
- `api` → VPS 공인 IP

그러면 아래처럼 분리됩니다:
- 사이트: `https://bluedeal.co.kr` (Vercel)
- API: `https://api.bluedeal.co.kr` (VPS)

---
## 2) VPS에 정적 JSON 서빙 (nginx 예시)

### (1) 폴더 준비
```bash
sudo mkdir -p /srv/bluedeal-api/public/prices
sudo chown -R $USER:$USER /srv/bluedeal-api
```

### (2) nginx server block 예시
`/etc/nginx/sites-available/api.bluedeal.co.kr` 같은 파일에:

```nginx
server {
  server_name api.bluedeal.co.kr;

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
nginx + certbot이 가능하면:
```bash
sudo certbot --nginx -d api.bluedeal.co.kr
```

---
## 3) JSON 파일 스키마

필수 파일:
- `/meta.json`
- `/prices/ram.json`
- `/prices/cpu.json`
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
- `PRICE_API_BASE=https://api.bluedeal.co.kr`

그러면 사이트는 자동으로 VPS의 JSON을 읽어와 가격현황을 표시합니다.
