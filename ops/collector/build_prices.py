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
import math
import os
import re
import sys
import uuid
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
    if re.search(r"[\x00-\x1f\x7f]", value):
        raise ValueError("제어 문자가 포함된 주소는 허용하지 않습니다.")
    parsed = urlsplit(value)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValueError(f"올바른 http(s) 상품 주소가 아닙니다: {value}")
    if parsed.username or parsed.password:
        raise ValueError(f"사용자 정보가 포함된 주소는 허용하지 않습니다: {value}")

    host = parsed.hostname.lower().rstrip(".")
    merchant = detect_merchant(host)
    if not merchant:
        raise ValueError(f"지원하지 않는 판매처 주소입니다: {value}")

    default_port = 443 if parsed.scheme.lower() == "https" else 80
    if parsed.port is not None and parsed.port != default_port:
        raise ValueError("판매처 주소에 비표준 포트를 사용할 수 없습니다.")
    # 제휴 실적에 필요한 쿼리값과 순서를 훼손하지 않습니다.
    normalized = urlunsplit(("https", host, parsed.path or "/", parsed.query, ""))
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


def parse_price(raw: Any, *, allow_zero: bool = False) -> int:
    if isinstance(raw, bool):
        raise ValueError("가격이 숫자가 아닙니다.")
    if isinstance(raw, (int, float)):
        if not math.isfinite(raw) or raw != int(raw):
            raise ValueError("원화 금액은 정수여야 합니다.")
        value = int(raw)
    else:
        text = str(raw if raw is not None else "").strip()
        if not re.fullmatch(r"(?:₩\s*)?(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)\s*원?", text):
            raise ValueError("원화 금액 형식을 확인하세요.")
        value = int(re.sub(r"[^0-9]", "", text))
    if value < (0 if allow_zero else 1) or value > 1_000_000_000:
        raise ValueError(f"가격 범위를 확인하세요: {raw}")
    return value


def parse_checked_at(raw: Any, now: datetime) -> datetime:
    value = str(raw or "").strip()
    if not value:
        raise ValueError("실제 가격을 확인한 checkedAt이 필요합니다.")
    checked = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if checked.tzinfo is None:
        raise ValueError("checkedAt에는 시간대(Z 또는 +09:00)가 필요합니다.")
    checked = checked.astimezone(timezone.utc)
    if checked > now:
        raise ValueError("checkedAt은 미래 시각일 수 없습니다.")
    return checked


def reference_url(raw: Any) -> str | None:
    value = str(raw or "").strip()
    if not value:
        return None
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("공식 사양 출처는 올바른 https 주소여야 합니다.")
    return value


def product_attributes(raw: dict[str, Any], category: str) -> dict[str, Any]:
    attributes: dict[str, Any] = {}
    for key in ("capacityGB", "moduleCapacityGB", "moduleCount"):
        value = raw.get(key)
        if value is not None and str(value).strip():
            attributes[key] = parse_price(value)
    memory = str(raw.get("memoryType") or "").strip().upper()
    if memory:
        if category != "ram" or memory not in {"DDR4", "DDR5"}:
            raise ValueError("memoryType은 RAM의 DDR4/DDR5만 지원합니다.")
        attributes["memoryType"] = memory
    if category == "ram" and any(key in attributes for key in ("moduleCount", "moduleCapacityGB")):
        if not all(key in attributes for key in ("capacityGB", "moduleCount", "moduleCapacityGB")):
            raise ValueError("RAM은 총용량·모듈 용량·개수를 함께 입력하세요.")
        if attributes["capacityGB"] != attributes["moduleCount"] * attributes["moduleCapacityGB"]:
            raise ValueError("RAM 총용량이 모듈 용량 × 개수와 다릅니다.")
    dram = str(raw.get("ssdDram") or "").strip()
    if dram:
        if category != "ssd" or dram not in {"present", "absent", "unknown"}:
            raise ValueError("ssdDram은 SSD의 present/absent/unknown만 지원합니다.")
        attributes["ssdDram"] = dram
    elif category == "ssd":
        attributes["ssdDram"] = "unknown"
    availability = str(raw.get("availability") or "unknown").strip()
    if availability not in {"in-stock", "out-of-stock", "unknown"}:
        raise ValueError("availability는 in-stock/out-of-stock/unknown 중 하나여야 합니다.")
    attributes["availability"] = availability
    return attributes


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
        if not all(isinstance(row, dict) for row in rows):
            raise ValueError("JSON의 모든 상품은 객체여야 합니다.")
        return [dict(row) for row in rows]
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


def atomic_write_batch(outputs: dict[Path, Any]) -> None:
    """Stage every file first and restore replaced files after a write failure."""
    suffix = uuid.uuid4().hex
    staged: dict[Path, Path] = {}
    previous: dict[Path, bytes | None] = {}
    replaced: list[Path] = []
    try:
        for path, data in outputs.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            previous[path] = path.read_bytes() if path.exists() else None
            temp = path.with_name(f".{path.name}.{suffix}.tmp")
            staged[path] = temp
            temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for path, temp in staged.items():
            temp.replace(path)
            replaced.append(path)
    except BaseException:
        for path in reversed(replaced):
            old = previous[path]
            if old is None:
                path.unlink(missing_ok=True)
            else:
                temp = staged[path]
                temp.write_bytes(old)
                temp.replace(path)
        raise
    finally:
        for temp in staged.values():
            temp.unlink(missing_ok=True)


def history_values(points: list[dict[str, Any]], now: datetime) -> tuple[int | None, int | None, float | None]:
    parsed: list[tuple[datetime, int]] = []
    for point in points:
        try:
            timestamp = parse_now(str(point["at"]))
            price = int(point["price"])
        except (KeyError, TypeError, ValueError):
            continue
        if timestamp <= now and price > 0:
            parsed.append((timestamp, price))
    if not parsed:
        return None, None, None

    parsed.sort()
    # 이력이 하루도 없는데 0% 또는 7/30일 최저가로 표시하지 않습니다.
    low_7d = min((price for at, price in parsed if at >= now - timedelta(days=7)), default=None) if parsed[0][0] <= now - timedelta(days=7) else None
    low_30d = min((price for at, price in parsed if at >= now - timedelta(days=30)), default=None) if parsed[0][0] <= now - timedelta(days=30) else None
    previous = max((point for point in parsed if now - timedelta(hours=26) <= point[0] <= now - timedelta(hours=24)), default=None)
    latest_price = parsed[-1][1]
    change = ((latest_price - previous[1]) / previous[1] * 100) if previous else None
    return low_7d, low_30d, round(change, 1) if change is not None else None


def _build(input_path: Path, root: Path, now: datetime, dry_run: bool, schedule: str | None = None) -> int:
    rows = read_rows(input_path)
    if not rows:
        raise ValueError("빈 입력으로 기존 가격표를 비울 수 없습니다.")
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
            if str(raw.get("currency") or "KRW").strip().upper() != "KRW":
                raise ValueError("현재 가격표는 원화(KRW)만 지원합니다.")
            checked = parse_checked_at(raw.get("checkedAt"), now)
            checked_iso = checked.isoformat().replace("+00:00", "Z")
            shipping_raw = raw.get("shippingFee")
            shipping_fee = parse_price(shipping_raw, allow_zero=True) if shipping_raw is not None and str(shipping_raw).strip() else None
            official_url = reference_url(raw.get("officialUrl"))
            attributes = product_attributes(raw, category)
            normalized_url, merchant = normalize_url(raw.get("url"))
            code = make_code(normalized_url, outbound)
            outbound[code] = {"code": code, "merchant": merchant, "originalUrl": normalized_url}

            offer = hashlib.sha256(json.dumps([normalized_url, raw.get("seller"), raw.get("priceNote"), attributes.get("capacityGB"), attributes.get("memoryType")], ensure_ascii=False).encode()).hexdigest()[:20]
            points = list(new_history.get(key, [])) if isinstance(new_history.get(key), list) else []
            points = [point for point in points if isinstance(point, dict) and point.get("offer") == offer]
            # 같은 확인 CSV의 재생성에서는 관측 횟수·확인 시각을 늘리지 않습니다.
            points = [point for point in points if point.get("at") != checked_iso]
            points.append({"at": checked_iso, "price": price, "offer": offer})
            cutoff = now - timedelta(days=31)
            points = [point for point in points if parse_now(str(point.get("at"))) >= cutoff]
            points.sort(key=lambda point: str(point.get("at")))
            new_history[key] = points
            low_7d, low_30d, change_24h = history_values(points, checked)

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
                "seller": str(raw.get("seller") or "").strip()[:100],
                "shippingFee": shipping_fee,
                "shippingNote": str(raw.get("shippingNote") or "").strip()[:200],
                "priceNote": str(raw.get("priceNote") or "").strip()[:300],
                "officialUrl": official_url,
                "checkedAt": checked_iso,
                "updatedAt": checked_iso,
                **attributes,
            }
            grouped[category].append(item)
        except (TypeError, ValueError) as error:
            raise ValueError(f"입력 {line_number}행 오류: {error}") from error

    for items in grouped.values():
        items.sort(key=lambda item: (item["shippingFee"] is None, item["price"] + (item["shippingFee"] or 0), item["name"]))

    if dry_run:
        print(f"[OK] 검증 완료: {len(rows)}개 상품, {len(outbound)}개 이동주소")
        return 0

    latest_checked = max((item["checkedAt"] for items in grouped.values() for item in items), default="")
    meta = {
        "updatedAt": latest_checked,
        "generatedAt": now_iso,
        "schedule": schedule or "수동 확인 후 갱신 · 자동 수집 준비 중",
        "note": f"확인한 상품 {len(rows)}개 · 가격은 상품별 확인 시각 기준입니다.",
    }
    outputs: dict[Path, Any] = {output_dir / "meta.json": meta}
    for category in CATEGORIES:
        outputs[output_dir / f"{category}.json"] = {"category": category, "updatedAt": max((item["checkedAt"] for item in grouped[category]), default=""), "generatedAt": now_iso, "items": grouped[category]}
    outputs[outbound_path] = dict(sorted(outbound.items()))
    outputs[state_path] = new_history
    def comparable(path: Path, value: Any) -> Any:
        if path.parent == output_dir and isinstance(value, dict):
            return {key: item for key, item in value.items() if key != "generatedAt"}
        return value
    if all(path.exists() and comparable(path, load_json(path, None)) == comparable(path, value) for path, value in outputs.items()):
        print("[OK] 확인 데이터 변경 없음: 파일과 생성 시각을 유지합니다.")
        return 0
    atomic_write_batch(outputs)
    print(f"[OK] 생성 완료: {len(rows)}개 상품, {len(outbound)}개 이동주소")
    print(f"[OK] 출력 위치: {output_dir}")
    return 0


def build(input_path: Path, root: Path, now: datetime, dry_run: bool, schedule: str | None = None) -> int:
    if dry_run:
        return _build(input_path, root, now, True, schedule)
    lock_path = root / "ops" / "collector" / "state" / "build.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        lock = lock_path.open("x", encoding="utf-8")
    except FileExistsError as error:
        raise ValueError("다른 가격 생성 작업이 실행 중입니다. 종료 여부를 확인하세요.") from error
    try:
        with lock:
            lock.write(str(os.getpid()))
        return _build(input_path, root, now, False, schedule)
    finally:
        lock_path.unlink(missing_ok=True)


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
