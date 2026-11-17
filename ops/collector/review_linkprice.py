#!/usr/bin/env python3
"""Inspect a saved LinkPrice response offline; never produce a publishable feed."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from build_prices import normalize_url, parse_price, repo_root

MAX_BYTES = 5 * 1024 * 1024
MAX_RECORDS = 10000
REQUIRED_REVIEW = ["selectedOptions", "seller", "numericShippingFee", "unconditionalPrice", "verifiedCheckedAt"]


class ReviewError(ValueError):
    """Generic errors deliberately exclude response values and private URLs."""


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ReviewError("API JSON의 중복 키를 확인하세요.")
        result[key] = value
    return result


def read_response(path: Path):
    with path.open("rb") as stream:
        body = stream.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ReviewError("API 응답이 허용 크기를 초과했습니다.")
    try:
        def reject_constant(_):
            raise ReviewError("API JSON의 숫자 형식을 확인하세요.")
        return json.loads(body.decode("utf-8-sig"), object_pairs_hook=unique_object, parse_constant=reject_constant)
    except (UnicodeError, json.JSONDecodeError, RecursionError):
        raise ReviewError("저장한 API 응답은 UTF-8 JSON이어야 합니다. HTML·문서 예시는 처리하지 않습니다.") from None


def records(payload, kind):
    result = []
    if kind == "realhotdeal":
        if not isinstance(payload, list):
            raise ReviewError("리얼핫딜 응답의 상품 배열을 확인하세요.")
        result = [(row.get("merchant_id") if isinstance(row, dict) else None, f"[{index}]", row)
                  for index, row in enumerate(payload)]
    elif kind == "hotdeal":
        if not isinstance(payload, dict) or payload.get("success") is not True:
            raise ReviewError("일반 핫딜 응답의 성공 여부와 실제 응답 구조를 확인하세요.")
        lists = [key for key in payload if re.fullmatch(r"list_[a-z][a-z0-9_]{0,31}", key)]
        if not lists:
            raise ReviewError("일반 핫딜 응답에 문서의 상품 목록이 없습니다.")
        for group in lists:
            if payload[group] == []:  # Actual responses use [] for an empty category.
                continue
            if not isinstance(payload[group], dict):
                raise ReviewError("일반 핫딜의 판매처별 배열을 확인하세요.")
            for merchant, rows in payload[group].items():
                if not isinstance(rows, list):
                    raise ReviewError("일반 핫딜의 판매처별 배열을 확인하세요.")
                result.extend((merchant, f"{group}.{merchant}[{index}]", row) for index, row in enumerate(rows))
    else:
        raise ReviewError("지원하는 API 종류를 선택하세요.")
    if len(result) > MAX_RECORDS:
        raise ReviewError("API 응답의 상품 수가 검토 한도를 초과했습니다.")
    if any(not isinstance(row, dict) or not isinstance(merchant, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", merchant)
           for merchant, _, row in result):
        raise ReviewError("API 상품과 판매처 식별자의 형식을 확인하세요.")
    return result


def catalog_target(value, merchant):
    """Unwrap a documented long URL locally, solely for exact catalog comparison."""
    if not isinstance(value, str) or len(value) > 8192 or re.search(r"[\x00-\x20\x7f]", value):
        return None
    try:
        parsed = urlsplit(value)
        if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
            return None
        if parsed.hostname == "click.linkprice.com":
            params = parse_qs(parsed.query, keep_blank_values=True)
            if parsed.path != "/click.php" or any(len(values) != 1 for values in params.values()) or params.get("m") != [merchant] or len(params.get("tu", [])) != 1:
                return None
            value = params["tu"][0]
            if urlsplit(value).scheme != "https":
                return None
        normalized, detected = normalize_url(value)
        return normalized if detected == merchant else None
    except (ValueError, TypeError):
        return None


def review(payload, kind, catalog):
    products = catalog.get("products") if isinstance(catalog, dict) else None
    if not isinstance(products, list) or not products or any(not isinstance(p, dict) or not isinstance(p.get("sourceUrl"), str)
                                             or not isinstance(p.get("id"), str) for p in products):
        raise ReviewError("검토 기준 카탈로그를 확인하세요.")
    expected = {p["id"] for p in products}
    if len(expected) != len(products):
        raise ReviewError("검토 기준 카탈로그의 중복을 확인하세요.")
    candidates = []
    matched = set()
    for merchant, location, row in records(payload, kind):
        real = kind == "realhotdeal"
        code = row.get("product_code" if real else "p_code")
        name = row.get("product_name" if real else "p_name")
        if real and type(code) is int and 0 <= code <= 2**53 - 1:
            code = str(code)
        if not isinstance(code, str) or not code or len(code) > 200 or not isinstance(name, str) or not name.strip() or len(name) > 2000:
            raise ReviewError("API의 상품 코드와 이름 형식을 확인하세요.")
        raw_price = row.get("discount_price") if real else row.get("p_price")
        if real and (raw_price is None or (type(raw_price) is int and raw_price == 0) or raw_price == "0"):
            raw_price = row.get("normal_price")
        try:
            price = parse_price(raw_price)
        except ValueError:
            price = None
        # The docs spell this curreny; actual responses also use currency.
        currencies = [row[key] for key in ("currency", "curreny") if key in row] if real else []
        currency = currencies[0] if currencies and all(isinstance(value, str) and len(value) <= 20 and value == currencies[0] for value in currencies) else None
        missing = list(REQUIRED_REVIEW)
        if currency != "KRW":
            missing.append("verifiedKrwCurrency")
        if price is None:
            missing.append("validIntegerPrice")
        target = catalog_target(row.get("click_url" if real else "target_url"), merchant)
        ids = sorted(p["id"] for p in products if target is not None and p["sourceUrl"] == target)
        if not ids:
            missing.append("exactCatalogProduct")
        matched.update(ids)
        candidates.append({"sourceLocation": location, "merchantId": merchant, "productCode": code,
                           "name": name.strip(), "priceCandidate": price, "currencyAsProvided": currency,
                           "catalogMatches": ids, "requiresVerification": missing, "readyForPublish": False})
    return {"purpose": "offline-review-only", "provider": "linkprice", "apiKind": kind,
            "recordCount": len(candidates), "catalogCount": len(expected), "matchedCatalogCount": len(matched),
            "unmatchedCatalogIds": sorted(expected - matched), "readyForPublish": False,
            "note": "API 상품 후보입니다. URL 일치만으로 선택 옵션·판매자·배송비·조건·가격 확인 시각을 검증할 수 없습니다. 기존 가격과 예약 설정은 변경하지 않습니다.",
            "candidates": candidates}


def write_report(report, output: Path, root: Path):
    destination = output.resolve()
    private = (root / "ops/private/linkprice-review").resolve()
    if not destination.is_relative_to(private) or destination.suffix != ".json":
        raise ReviewError("검토 결과는 ops/private/linkprice-review 폴더 안의 JSON에만 저장할 수 있습니다.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=destination.parent, suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(report, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        os.replace(temporary, destination)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def main(argv=None):
    parser = argparse.ArgumentParser(description="저장한 링크프라이스 응답을 오프라인 검토합니다. 운영 가격은 변경하지 않습니다.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--kind", required=True, choices=["hotdeal", "realhotdeal"])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    root = repo_root()
    output = args.output or root / "ops/private/linkprice-review/report.local.json"
    try:
        if args.input.resolve() == output.resolve():
            raise ReviewError("원본 응답과 검토 결과는 서로 다른 파일이어야 합니다.")
        payload = read_response(args.input)
        catalog = json.loads((root / "ops/collector/catalog.json").read_text(encoding="utf-8"))
        report = review(payload, args.kind, catalog)
        write_report(report, output, root)
    except ReviewError as error:
        print(f"[중단] {error}", file=sys.stderr)
        return 1
    except (OSError, ValueError, TypeError, RecursionError):
        print("[중단] 로컬 응답·카탈로그·출력 파일을 확인하세요. 원본 값과 경로는 출력하지 않습니다.", file=sys.stderr)
        return 1
    print(f"[검토 전용] 후보 {report['recordCount']}개 · 카탈로그 URL 일치 {report['matchedCatalogCount']}/{report['catalogCount']}개. 운영 가격·제휴 설정·예약 작업은 변경하지 않았습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
