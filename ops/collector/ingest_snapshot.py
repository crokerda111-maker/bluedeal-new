#!/usr/bin/env python3
"""Validate a complete, authorized price snapshot before changing any output.

This is a feed consumer, not a merchant scraper. A real approved provider must
produce the documented CSV/JSON fields. It never invents checkedAt timestamps.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from build_prices import atomic_write_json, build, load_json, normalize_url, parse_checked_at, parse_now, parse_price, read_rows, repo_root

MAX_BYTES = 5 * 1024 * 1024


class SnapshotError(ValueError):
    """A safe operator-facing validation message without raw feed values."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_feed() -> list[dict[str, Any]]:
    url = os.environ.get("BLUEDEAL_PRICE_FEED_URL", "").strip()
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("원본 피드의 HTTPS 주소 설정을 확인하세요.")
    headers = {"User-Agent": "BLUEDEALPriceFeed/1.0", "Accept": "application/json, text/csv"}
    token = os.environ.get("BLUEDEAL_PRICE_FEED_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        with build_opener(NoRedirect()).open(Request(url, headers=headers), timeout=20) as response:
            content_type = response.headers.get_content_type()
            body = response.read(MAX_BYTES + 1)
    except HTTPError as error:
        raise ValueError(f"원본 피드 조회 실패: HTTP {error.code}. 기존 가격을 유지합니다.") from None
    except (URLError, TimeoutError, OSError):
        raise ValueError("원본 피드에 연결하지 못했습니다. 기존 가격을 유지합니다.") from None
    if len(body) > MAX_BYTES:
        raise ValueError("원본 피드가 허용 크기를 초과했습니다.")
    text = body.decode("utf-8-sig")
    if content_type == "application/json":
        data = json.loads(text)
        rows = data.get("items") if isinstance(data, dict) else data
        if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
            raise ValueError("원본 피드의 상품 배열을 확인하세요.")
        return rows
    if content_type == "text/csv":
        return [dict(row) for row in csv.DictReader(io.StringIO(text))]
    raise ValueError("원본 피드는 JSON 또는 CSV여야 합니다. 로그인 HTML은 가격으로 처리하지 않습니다.")


def validate_snapshot(rows: list[dict[str, Any]], catalog: dict[str, Any], previous: list[dict[str, Any]], now: datetime, accept_price_change: bool = False) -> None:
    products = catalog.get("products")
    if not isinstance(products, list) or not products:
        raise SnapshotError("검증된 상품 카탈로그가 필요합니다.")
    expected = {(item["category"], item["id"]): item for item in products}
    if len(expected) != len(products):
        raise SnapshotError("카탈로그에 중복 상품이 있습니다.")
    keys = [(str(row.get("category", "")), str(row.get("id", ""))) for row in rows]
    if len(keys) != len(set(keys)) or set(keys) != set(expected):
        raise SnapshotError("원본이 전체 카탈로그와 일치하지 않습니다. 누락·중복·미등록 상품을 확인하세요.")
    old_items = {(item["category"], item["id"]): item for item in previous}
    for row, key in zip(rows, keys):
        registered = expected[key]
        if row.get("currency") != "KRW":
            raise SnapshotError(f"{key[1]}: 원화(KRW) 확인이 필요합니다.")
        try:
            checked = parse_checked_at(row.get("checkedAt"), now)
        except ValueError:
            raise SnapshotError(f"{key[1]}: 실제 확인 시각과 시간대를 확인하세요.") from None
        if now - checked > timedelta(hours=26):
            raise SnapshotError(f"{key[1]}: 원본 확인 시각이 26시간을 넘었습니다.")
        try:
            url_matches = normalize_url(row.get("url"))[0] == normalize_url(registered["sourceUrl"])[0]
        except ValueError:
            url_matches = False
        if not url_matches:
            raise SnapshotError(f"{key[1]}: 검증한 판매 상품 주소가 아닙니다.")
        for field in ("seller", "capacityGB", "memoryType", "moduleCapacityGB", "moduleCount", "ssdDram"):
            if field in registered and str(row.get(field, "")) != str(registered[field]):
                raise SnapshotError(f"{key[1]}: 검증한 {field}와 다릅니다.")
        try:
            price = parse_price(row.get("price"))
        except ValueError:
            raise SnapshotError(f"{key[1]}: 원화 정수 금액을 확인하세요.") from None
        old = old_items.get(key)
        if old:
            old_checked = parse_checked_at(old.get("checkedAt"), now)
            if checked < old_checked:
                raise SnapshotError(f"{key[1]}: 이전 확인 시각보다 오래된 원본입니다.")
            old_price = parse_price(old.get("price"))
            delta = abs(price - old_price) / old_price * 100
            if delta > 35 and not accept_price_change:
                raise SnapshotError(f"{key[1]}: 상품가가 35% 넘게 변했습니다. 실제 옵션·조건을 검토하세요.")


def main() -> int:
    parser = argparse.ArgumentParser(description="검증된 전체 가격 스냅샷 반영")
    parser.add_argument("--input", help="로컬 CSV/JSON 경로")
    parser.add_argument("--from-feed", action="store_true", help="환경변수에 등록한 승인된 원본 조회")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--accept-price-change", action="store_true", help="실제 가격 급변을 직접 검토한 경우에만 사용")
    args = parser.parse_args()
    root = repo_root()
    now = parse_now(None)
    temp_path: Path | None = None
    report = {"attemptedAt": now.isoformat(), "mode": "feed" if args.from_feed else "local", "status": "failed"}
    try:
        if args.from_feed and args.input:
            raise ValueError("--input과 --from-feed는 함께 사용할 수 없습니다.")
        rows = fetch_feed() if args.from_feed else read_rows(Path(args.input) if args.input else root / "ops/collector/input/products.csv")
        catalog = load_json(root / "ops/collector/catalog.json", {})
        previous = []
        for file in (root / "src/content/prices").glob("*.json"):
            data = load_json(file, {})
            if not isinstance(data, dict) or not isinstance(data.get("items", []), list):
                raise SnapshotError("기존 가격 파일 형식을 먼저 확인하세요.")
            previous.extend({**item, "category": data["category"]} for item in data.get("items", []))
        validate_snapshot(rows, catalog, previous, now, args.accept_price_change)
        state = root / "ops/collector/state"
        state.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", suffix=".json", dir=state, encoding="utf-8", delete=False) as handle:
            json.dump(rows, handle, ensure_ascii=False)
            temp_path = Path(handle.name)
        before = load_json(root / "src/content/prices/meta.json", {}).get("generatedAt")
        result = build(temp_path, root, now, args.dry_run, "승인된 원본 피드 확인 후 갱신" if args.from_feed else None)
        after = load_json(root / "src/content/prices/meta.json", {}).get("generatedAt")
        report.update(status="validated" if args.dry_run else "unchanged" if before == after else "generated", productCount=len(rows))
        return result
    except SnapshotError as error:
        print(f"[ERROR] {error} 기존 배포 가격을 유지합니다.", file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, TypeError):
        # Do not log a feed URL, bearer token, or HTTP response body.
        print("[ERROR] 원본 검증 또는 파일 생성에 실패했습니다. 기존 배포 가격을 유지합니다.", file=sys.stderr)
        return 1
    finally:
        if temp_path:
            temp_path.unlink(missing_ok=True)
        try:
            atomic_write_json(root / "ops/collector/state/last-run.json", report)
        except OSError:
            print("[ERROR] 실행 상태 기록을 저장하지 못했습니다.", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
