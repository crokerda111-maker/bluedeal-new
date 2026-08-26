#!/usr/bin/env python3
"""Collect the BLUEDEAL watchlist from Danawa's public product lists.

The script uses the locally installed Chrome browser through Playwright. It
collects a small fixed watchlist and waits between searches to avoid excessive
traffic. Output is a private candidate list; Danawa URLs are never published as
purchase links.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

try:
    from playwright.sync_api import Browser, Page, TimeoutError as PlaywrightTimeoutError, sync_playwright
except ImportError:
    print("[ERROR] Playwright가 없습니다. python -m pip install -r ops/collector/requirements.txt", file=sys.stderr)
    raise SystemExit(1)

REPO_ROOT = Path(__file__).resolve().parents[2]
CATEGORY_URLS = {
    "cpu": "https://prod.danawa.com/list/?cate=21349942",
    "ram": "https://prod.danawa.com/list/?cate=21349943",
    "gpu": "https://prod.danawa.com/list/?cate=21349945",
}
COMMON_EXCLUDES = ("[해외]", "해외구매", "병행수입", "중고", "리퍼", "노트북", "완본체", "조립PC")
RAM_EXCLUDES = COMMON_EXCLUDES + ("SODIMM", "SO-DIMM", "CUDIMM", "단품")
GPU_EXCLUDES = COMMON_EXCLUDES + ("RTX PRO", "QUADRO", "쿼드로")


@dataclass(frozen=True)
class Product:
    name: str
    price: int
    url: str
    pcode: str
    rank: int


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_capacity(value: str) -> str:
    return re.sub(r"\s+", "", value).upper().replace("GB", "G").replace("×", "X")


def parse_price(value: str) -> int | None:
    digits = re.sub(r"[^0-9]", "", value)
    if not digits:
        return None
    price = int(digits)
    return price if 0 < price <= 100_000_000 else None


def excluded(name: str, words: tuple[str, ...]) -> bool:
    upper = name.upper()
    return any(word.upper() in upper for word in words)


def launch_browser(playwright: Any, headed: bool) -> Browser:
    try:
        return playwright.chromium.launch(channel="chrome", headless=not headed)
    except Exception:
        return playwright.chromium.launch(headless=not headed)


def open_category(page: Page, category: str) -> None:
    page.goto(CATEGORY_URLS[category], wait_until="domcontentloaded", timeout=45_000)
    page.wait_for_selector("#productListArea .prod_item", timeout=30_000)


def search_inside_list(page: Page, keyword: str) -> None:
    search = page.locator("#innerSearchKeyword")
    search.fill(keyword)
    page.locator(".prod_search_set .submit_search_list").click()
    page.wait_for_timeout(2_000)
    page.wait_for_selector("#productListArea .prod_item", timeout=20_000)

    count_select = page.locator('select[title="목록 개수 선택"]')
    if count_select.count() > 0:
        try:
            count_select.select_option("90")
            page.wait_for_timeout(1_500)
        except Exception:
            pass


def extract_products(page: Page) -> list[Product]:
    rows: list[Product] = []
    items = page.locator("#productListArea .prod_item")
    for index in range(items.count()):
        item = items.nth(index)
        name_link = item.locator(".prod_name .name_link").first
        compare_link = item.locator(".link_gocompare").first
        price_el = item.locator(".main_price .num, .price_sect .num").first
        if name_link.count() == 0 or compare_link.count() == 0 or price_el.count() == 0:
            continue
        name = normalize_name(name_link.inner_text())
        url = compare_link.get_attribute("href") or ""
        price = parse_price(price_el.inner_text())
        pcode_match = re.search(r"[?&]pcode=(\d+)", url)
        if not name or not price or not pcode_match:
            continue
        rows.append(Product(name=name, price=price, url=url, pcode=pcode_match.group(1), rank=index + 1))
    return rows


def exact_cpu_match(model: str) -> Callable[[Product], bool]:
    pattern = re.compile(rf"(?<![0-9A-Z]){re.escape(model.upper())}(?![0-9A-Z])")
    return lambda product: bool(pattern.search(product.name.upper())) and not excluded(product.name, COMMON_EXCLUDES)


def gpu_match(model: str) -> Callable[[Product], bool]:
    upper_model = model.upper()
    base = upper_model.replace(" 16GB", "").replace(" 8GB", "")
    pattern = re.compile(rf"(?<![0-9A-Z]){re.escape(base)}(?![0-9A-Z])")

    def matches(product: Product) -> bool:
        upper = product.name.upper()
        if excluded(product.name, GPU_EXCLUDES) or not pattern.search(upper):
            return False
        if "5060 TI 16GB" in upper_model:
            return bool(re.search(r"16\s*GB", upper))
        if "5060 TI 8GB" in upper_model:
            return bool(re.search(r"8\s*GB", upper)) and not bool(re.search(r"16\s*GB", upper))
        if base in {"RTX 5060", "RTX 5070"} and f"{base} TI" in upper:
            return False
        return True

    return matches


def choose_lowest(products: list[Product], predicate: Callable[[Product], bool]) -> Product | None:
    candidates = [product for product in products if predicate(product)]
    return min(candidates, key=lambda product: (product.price, product.rank)) if candidates else None


def to_row(category: str, product: Product, spec: str) -> dict[str, Any]:
    return {
        "category": category,
        "id": f"danawa-{product.pcode}",
        "name": product.name,
        "spec": spec,
        "reference_price": product.price,
        "reference_url": product.url,
        "reference_source": "다나와",
    }


def collect(page: Page, watchlist: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    output: list[dict[str, Any]] = []
    warnings: list[str] = []

    open_category(page, "cpu")
    for model in watchlist["cpu"]:
        search_inside_list(page, f"AMD {model}")
        products = extract_products(page)
        selected = choose_lowest(products, exact_cpu_match(model))
        if selected:
            output.append(to_row("cpu", selected, f"AMD {model} · 다나와 국내 판매 대표 최저가"))
        else:
            warnings.append(f"CPU {model}: 조건에 맞는 상품을 찾지 못했습니다.")
        page.wait_for_timeout(1_200)

    open_category(page, "ram")
    for rule in watchlist["ram"]:
        search_inside_list(page, rule["label"])
        match_compact = normalize_capacity(str(rule["match"]))
        matches = [
            product for product in extract_products(page)
            if match_compact in normalize_capacity(product.name)
            and not excluded(product.name, RAM_EXCLUDES)
        ][: int(rule.get("limit", 10))]
        if not matches:
            warnings.append(f"RAM {rule['label']}: 조건에 맞는 국내 상품을 찾지 못했습니다.")
        for rank, product in enumerate(matches, start=1):
            output.append(to_row("ram", product, f"{rule['label']} · 다나와 인기순 {rank}위 · 국내 유통"))
        page.wait_for_timeout(1_200)

    open_category(page, "gpu")
    for model in watchlist["gpu"]:
        search_inside_list(page, f"GeForce {model}")
        products = extract_products(page)
        selected = choose_lowest(products, gpu_match(model))
        if selected:
            output.append(to_row("gpu", selected, f"GeForce {model} · 다나와 국내 판매 대표 최저가"))
        else:
            warnings.append(f"GPU {model}: 조건에 맞는 상품을 찾지 못했습니다.")
        page.wait_for_timeout(1_200)

    return output, warnings


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    columns = (
        "category",
        "id",
        "name",
        "spec",
        "reference_price",
        "reference_url",
        "reference_source",
    )
    with temp.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    temp.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="BLUEDEAL 다나와 소규모 가격 수집")
    parser.add_argument("--watchlist", default=str(REPO_ROOT / "ops" / "collector" / "watchlist.json"))
    parser.add_argument(
        "--out",
        default=str(REPO_ROOT / "ops" / "collector" / "input" / "danawa-candidates.csv"),
    )
    parser.add_argument("--headed", action="store_true", help="Chrome 창을 보이게 실행")
    args = parser.parse_args()

    watchlist = json.loads(Path(args.watchlist).read_text(encoding="utf-8"))
    try:
        with sync_playwright() as playwright:
            browser = launch_browser(playwright, args.headed)
            page = browser.new_page(locale="ko-KR", viewport={"width": 1440, "height": 1000})
            rows, warnings = collect(page, watchlist)
            browser.close()
    except PlaywrightTimeoutError as error:
        print(f"[ERROR] 다나와 응답을 기다리다 시간이 초과됐습니다: {error}", file=sys.stderr)
        return 1
    except Exception as error:
        print(f"[ERROR] 수집 실패: {error}", file=sys.stderr)
        return 1

    for warning in warnings:
        print(f"[WARN] {warning}")
    if not rows:
        print("[ERROR] 수집된 상품이 없어 기존 입력 파일을 변경하지 않았습니다.", file=sys.stderr)
        return 1
    write_csv(Path(args.out), rows)
    print(f"[OK] 다나와 상품 {len(rows)}개 수집: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
