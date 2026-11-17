#!/usr/bin/env python3
"""Fetch official LinkPrice candidates into private, non-publishable reviews."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from build_prices import repo_root
from review_linkprice import MAX_BYTES, ReviewError, read_response, review, write_report

ACCOUNT_RE = re.compile(r"A[0-9]{6,20}\Z")
ENDPOINTS = {"hotdeal": "product", "realhotdeal": "hotdeal"}


class FetchReviewError(ValueError):
    """Only safe, fixed diagnostic messages may reach the console."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def account_id(root: Path) -> str:
    configured = os.environ.get("LINKPRICE_AFFILIATE_ID")
    if configured is not None:
        if not ACCOUNT_RE.fullmatch(configured):
            raise FetchReviewError("링크프라이스 계정 식별자 설정을 확인하세요.")
        return configured
    path = root / "ops/private/affiliate-config.local.json"
    with path.open("rb") as stream:
        raw = stream.read(60001)
    if len(raw) > 60000:
        raise FetchReviewError("비공개 제휴 설정의 크기를 확인하세요.")
    rows = json.loads(raw.decode("utf-8-sig"))
    if not isinstance(rows, list) or len(rows) > 100:
        raise FetchReviewError("비공개 제휴 설정의 구조를 확인하세요.")
    identifiers = set()
    for row in rows:
        if not isinstance(row, dict) or row.get("provider") != "linkprice" or not isinstance(row.get("affiliateUrl"), str):
            continue
        try:
            parsed = urlsplit(row["affiliateUrl"])
            if parsed.scheme != "https" or parsed.hostname != "click.linkprice.com" or parsed.path != "/click.php" or parsed.username or parsed.password or parsed.port or parsed.fragment:
                continue
            values = parse_qs(parsed.query, keep_blank_values=True).get("a", [])
            if len(values) == 1 and ACCOUNT_RE.fullmatch(values[0]):
                identifiers.add(values[0])
        except ValueError:
            continue
    if len(identifiers) != 1:
        raise FetchReviewError("사용할 링크프라이스 계정 식별자를 하나로 확인할 수 없습니다.")
    return identifiers.pop()


def fetch_body(identifier: str, kind: str) -> tuple[bytes, str]:
    if not ACCOUNT_RE.fullmatch(identifier) or kind not in ENDPOINTS:
        raise FetchReviewError("API 요청 설정을 확인하세요.")
    request = Request(f"https://api.linkprice.com/ci/{ENDPOINTS[kind]}/data/{identifier}",
                      headers={"User-Agent": "BLUEDEALLinkPriceReview/1.0", "Accept": "application/json"})
    try:
        with build_opener(NoRedirect()).open(request, timeout=20) as response:
            body = response.read(MAX_BYTES + 1)
            supplied = response.headers.get_content_type()
    except HTTPError as error:
        raise FetchReviewError(f"공식 API 조회 실패: HTTP {error.code}.") from None
    except (URLError, TimeoutError, OSError):
        raise FetchReviewError("공식 API에 연결하지 못했습니다.") from None
    if len(body) > MAX_BYTES:
        raise FetchReviewError("공식 API 응답이 허용 크기를 초과했습니다.")
    # The real-hotdeal API can return JSON with a text/html Content-Type.
    return body, supplied if supplied in ("application/json", "text/html") else "other"


def collect_review(root: Path, kind: str, identifier: str) -> dict:
    root = root.resolve()
    folder = root / "ops/private/linkprice-review"
    if folder.resolve() != folder:
        raise FetchReviewError("비공개 검토 폴더의 실제 경로를 확인하세요.")
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    body, content_type = fetch_body(identifier, kind)
    source = folder / f"{stamp}-{kind}.response.local.json"
    with source.open("xb") as stream:
        stream.write(body)
    payload = read_response(source)
    catalog = json.loads((root / "ops/collector/catalog.json").read_text(encoding="utf-8-sig"))
    report = review(payload, kind, catalog)
    report.update({"retrievedAt": datetime.now(timezone.utc).isoformat(), "httpContentType": content_type})
    destination = folder / f"{stamp}-{kind}.review.local.json"
    write_report(report, destination, root)
    return {"kind": kind, "recordCount": report["recordCount"], "matchedCatalogCount": report["matchedCatalogCount"],
            "catalogCount": report["catalogCount"], "readyForPublish": False, "reportFile": destination.name}


def main(argv=None):
    parser = argparse.ArgumentParser(description="공식 API 후보를 비공개 검토 파일로 받습니다. 운영 가격·제휴·예약은 변경하지 않습니다.")
    parser.add_argument("--kind", choices=["hotdeal", "realhotdeal", "both"], default="both")
    args = parser.parse_args(argv)
    try:
        root = repo_root()
        identifier = account_id(root)
        for kind in ENDPOINTS if args.kind == "both" else [args.kind]:
            result = collect_review(root, kind, identifier)
            print(f"[검토 전용] {kind}: 후보 {result['recordCount']}개 · 카탈로그 {result['matchedCatalogCount']}/{result['catalogCount']}개 · 게시 준비 안 됨 · {result['reportFile']}")
        return 0
    except (FetchReviewError, ReviewError) as error:
        print(f"[중단] {error}", file=sys.stderr)
    except Exception:
        print("[중단] API 수신·검토 설정을 확인하세요. 계정값과 원문은 출력하지 않습니다.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
