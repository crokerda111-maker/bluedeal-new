#!/usr/bin/env python3
"""Build BLUEDEAL price data and stable /go mappings on a local PC.

The input is a CSV or JSON export produced by a browser scraper or a manual
spreadsheet. Only allowlisted merchant URLs are accepted. Raw product URLs are
stored in the server-side outbound mapping; public price JSON contains goCode.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

CATEGORIES = ("ram", "cpu", "ssd", "motherboard", "gpu", "cooler", "halfpc", "fullpc")
MERCHANT_HOSTS = {
    "coupang": ("coupang.com", "link.coupang.com"),
    "aliexpress": ("aliexpress.com", "aliexpress.us", "a.aliexpress.com", "s.click.aliexpress.com"),
    "11st": ("11st.co.kr",),
    "gmarket": ("gmarket.co.kr",),
    "naver": ("smartstore.naver.com", "brand.naver.com", "shopping.naver.com"),
}
SLUG_RE = re.compile(r"^[A-Za-z0-9_-]{2,100}$")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def parse_now(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def host_matches(host: str, allowed: str) -> bool:
    return host == allowed or host.endswith("." + allowed)


def detect_merchant(host: str) -> str | None:
    host = host.lower().rstrip(".")
    for merchant, allowed_hosts in MERCHANT_HOSTS.items():
        if any(host_matches(host, allowed) for allowed in allowed_hosts):
            return merchant
    return None


def normalize_url(raw: Any) -> tuple[str, str]:
    value = str(raw or "").strip()
    parsed = urlsplit(value)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValueError(f"올바른 http(s) 상품 주소가 아닙니다: {value}")
    if parsed.username or parsed.password:
        raise ValueError(f"사용자 정보가 포함된 주소는 허용하지 않습니다: {value}")

    host = parsed.hostname.lower().rstrip(".")
    merchant = detect_merchant(host)
    if not merchant:
        raise ValueError(f"지원하지 않는 판매처 주소입니다: {value}")

    port = f":{parsed.port}" if parsed.port and parsed.port != 443 else ""
    # 제휴 실적에 필요한 쿼리값과 순서를 훼손하지 않습니다.
    normalized = urlunsplit(("https", host + port, parsed.path or "/", parsed.query, ""))
    return normalized, merchant


def make_code(url: str, existing: dict[str, Any]) -> str:
    digest = hashlib.sha256(url.encode("utf-8")).digest()
    base = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    for length in (16, 20, 24, 32):
        code = base[:length]
        old = existing.get(code)
        if not old or old.get("originalUrl") == url:
            return code
    raise ValueError("이동주소 코드 충돌을 해결하지 못했습니다.")


def parse_price(raw: Any) -> int:
    if isinstance(raw, bool):
        raise ValueError("가격이 숫자가 아닙니다.")
    if isinstance(raw, (int, float)):
        value = int(raw)
    else:
        digits = re.sub(r"[^0-9.-]", "", str(raw or ""))
        if not digits:
            raise ValueError("가격이 비어 있습니다.")
        value = int(float(digits))
    if value <= 0 or value > 1_000_000_000:
        raise ValueError(f"가격 범위를 확인하세요: {raw}")
    return value


def read_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"입력 파일이 없습니다: {path}")
    if path.suffix.lower() == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            return [dict(row) for row in csv.DictReader(handle)]
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = data.get("items") if isinstance(data, dict) else data
        if not isinstance(rows, list):
            raise ValueError("JSON은 배열 또는 {\"items\": [...]} 구조여야 합니다.")
        return [dict(row) for row in rows if isinstance(row, dict)]
    raise ValueError("입력 파일은 .csv 또는 .json이어야 합니다.")


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return fallback


def atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def history_values(points: list[dict[str, Any]], now: datetime) -> tuple[int | None, int | None, float | None]:
    parsed: list[tuple[datetime, int]] = []
    for point in points:
        try:
            timestamp = parse_now(str(point["at"]))
            price = int(point["price"])
        except (KeyError, TypeError, ValueError):
            continue
        parsed.append((timestamp, price))
    if not parsed:
        return None, None, None

    low_7d = min((price for at, price in parsed if at >= now - timedelta(days=7)), default=None)
    low_30d = min((price for at, price in parsed if at >= now - timedelta(days=30)), default=None)
    previous = min(parsed, key=lambda item: abs((item[0] - (now - timedelta(hours=24))).total_seconds()))
    latest_price = parsed[-1][1]
    change = ((latest_price - previous[1]) / previous[1] * 100) if previous[1] else None
    return low_7d, low_30d, round(change, 1) if change is not None else None


def build(input_path: Path, root: Path, now: datetime, dry_run: bool) -> int:
    rows = read_rows(input_path)
    output_dir = root / "src" / "content" / "prices"
    outbound_path = root / "src" / "content" / "outbound.generated.json"
    state_path = root / "ops" / "collector" / "state" / "history.json"
    outbound = load_json(outbound_path, {})
    history = load_json(state_path, {})
    if not isinstance(outbound, dict):
        outbound = {}
    if not isinstance(history, dict):
        history = {}

    now_iso = now.isoformat().replace("+00:00", "Z")
    grouped: dict[str, list[dict[str, Any]]] = {category: [] for category in CATEGORIES}
    seen: set[str] = set()
    new_history: dict[str, list[dict[str, Any]]] = dict(history)

    for line_number, raw in enumerate(rows, start=2):
        try:
            category = str(raw.get("category") or "").strip().lower()
            if category not in CATEGORIES:
                raise ValueError(f"category는 {', '.join(CATEGORIES)} 중 하나여야 합니다.")
            item_id = str(raw.get("id") or "").strip()
            if not SLUG_RE.fullmatch(item_id):
                raise ValueError("id는 영문, 숫자, 밑줄, 하이픈 2~100자여야 합니다.")
            key = f"{category}:{item_id}"
            if key in seen:
                raise ValueError(f"중복 id입니다: {key}")
            seen.add(key)

            name = str(raw.get("name") or "").strip()
            if not name:
                raise ValueError("name이 비어 있습니다.")
            price = parse_price(raw.get("price"))
            normalized_url, merchant = normalize_url(raw.get("url"))
            code = make_code(normalized_url, outbound)
            outbound[code] = {"code": code, "merchant": merchant, "originalUrl": normalized_url}

            points = list(new_history.get(key, [])) if isinstance(new_history.get(key), list) else []
            points.append({"at": now_iso, "price": price})
            cutoff = now - timedelta(days=31)
            points = [point for point in points if parse_now(str(point.get("at"))) >= cutoff]
            points.sort(key=lambda point: str(point.get("at")))
            new_history[key] = points
            low_7d, low_30d, change_24h = history_values(points, now)

            item: dict[str, Any] = {
                "id": item_id,
                "name": name[:200],
                "spec": str(raw.get("spec") or "").strip()[:500],
                "price": price,
                "low7d": low_7d,
                "low30d": low_30d,
                "change24hPct": change_24h,
                "goCode": code,
                "source": str(raw.get("source") or merchant).strip()[:80],
                "updatedAt": now_iso,
            }
            grouped[category].append(item)
        except (TypeError, ValueError) as error:
            raise ValueError(f"입력 {line_number}행 오류: {error}") from error

    for items in grouped.values():
        items.sort(key=lambda item: (item["price"], item["name"]))

    if dry_run:
        print(f"[OK] 검증 완료: {len(rows)}개 상품, {len(outbound)}개 이동주소")
        return 0

    meta = {
        "updatedAt": now_iso,
        "schedule": "PC 수집기 실행 시 갱신",
        "note": f"등록 상품 {len(rows)}개 · 판매처 이동주소는 /go 코드로 보호됩니다.",
    }
    atomic_write_json(output_dir / "meta.json", meta)
    for category in CATEGORIES:
        atomic_write_json(output_dir / f"{category}.json", {"category": category, "updatedAt": now_iso, "items": grouped[category]})
    atomic_write_json(outbound_path, dict(sorted(outbound.items())))
    atomic_write_json(state_path, new_history)
    print(f"[OK] 생성 완료: {len(rows)}개 상품, {len(outbound)}개 이동주소")
    print(f"[OK] 출력 위치: {output_dir}")
    return 0


def main() -> int:
    root = repo_root()
    parser = argparse.ArgumentParser(description="BLUEDEAL PC 가격 데이터 빌더")
    parser.add_argument("--input", default=str(root / "ops" / "collector" / "input" / "products.csv"))
    parser.add_argument("--root", default=str(root), help="bluedeal-new 저장소 경로")
    parser.add_argument("--now", help="테스트용 ISO 시각")
    parser.add_argument("--dry-run", action="store_true", help="검증만 하고 파일은 변경하지 않음")
    args = parser.parse_args()
    try:
        return build(Path(args.input).resolve(), Path(args.root).resolve(), parse_now(args.now), args.dry_run)
    except (FileNotFoundError, OSError, ValueError) as error:
        print(f"[ERROR] {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
