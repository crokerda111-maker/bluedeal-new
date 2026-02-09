# VPS 리다이렉트 점검 가이드 (선택)

이 문서는 `blusedeal.co.kr`이 **가격 JSON 원본**으로 쓰이는 현재 구성에서,
리다이렉트를 걸고 싶을 때(또는 이미 걸려 있을 때) **가격 API가 안 깨지게** 점검하기 위한 체크리스트입니다.

> 핵심 결론
> - `blusedeal.co.kr`을 가격 JSON 원본으로 쓰는 동안에는
>   **`/meta.json`, `/prices/*.json`은 무조건 200으로 남아야 합니다.**
> - 도메인 전체를 `bluedeal.co.kr`로 301 리다이렉트하면 가격현황이 바로 깨집니다.

---

## 1) 기대 동작(정답 기준)

### A) 반드시 200이어야 하는 엔드포인트
- `https://blusedeal.co.kr/meta.json` → **200**
- `https://blusedeal.co.kr/prices/ram.json` → **200** (카테고리 전부 동일)

### B) (선택) 사람이 들어오는 루트만 301로 보내고 싶다면
- `https://blusedeal.co.kr/` → `https://bluedeal.co.kr/` (301)

✅ **중요**
- `/prices/*`는 절대 301이 되면 안 됩니다.
- `/meta.json`도 절대 301이 되면 안 됩니다.

---

## 2) DNS 점검

아래 호스트가 **VPS 공인 IP**로 가야 합니다.

- `blusedeal.co.kr`
- (선택) `www.blusedeal.co.kr`

명령 예시:
```bash
nslookup blusedeal.co.kr
nslookup www.blusedeal.co.kr
```

✅ 기대값
- Address가 VPS 공인 IP로 나옴

---

## 3) nginx 리다이렉트 설정 예시(가능한 환경에서만)

카페24 **관리형/워드프레스 VPS**는 nginx/openresty 설정 접근이 제한될 수 있습니다.
그런 환경이면 이 섹션은 건너뛰고, **웹루트에 파일만 두고 200이 뜨는지**만 확인하세요.

### 예시: `/meta.json`과 `/prices/`는 예외로 두고 나머지만 301

```nginx
server {
  listen 443 ssl http2;
  server_name blusedeal.co.kr www.blusedeal.co.kr;

  root /srv/bluedeal-api/public;

  # 1) 가격 JSON은 200 유지
  location = /meta.json { try_files $uri =404; }
  location ^~ /prices/ { try_files $uri =404; }

  # 2) 그 외는 메인 사이트로 301
  location / {
    return 301 https://bluedeal.co.kr$request_uri;
  }
}
```

---

## 4) curl로 1분 점검(가장 중요)

```bash
# 1) 가격 JSON은 200
curl -I https://blusedeal.co.kr/meta.json
curl -I https://blusedeal.co.kr/prices/ram.json

# 2) (선택) 루트만 301인지 확인
curl -I https://blusedeal.co.kr/

# 3) (선택) www도 동일
curl -I https://www.blusedeal.co.kr/prices/ram.json
```

✅ 기대값
- `meta.json`, `/prices/*.json` → **200**
- (선택) `/` → **301**

---

## 5) 자주 나는 오류

- **/prices가 301로 리다이렉트 됨(치명적)**
  - 도메인 전체 리다이렉트 설정이 `/prices/`까지 잡아먹은 경우
  - 해결: `/meta.json`, `/prices/` 예외 규칙을 먼저 둔 뒤 나머지를 301 처리

- **/meta.json이 404**
  - VPS 웹루트에 `meta.json` 파일이 없음
  - 해결: 가격 생성 스크립트가 `meta.json`까지 쓰도록 확인
