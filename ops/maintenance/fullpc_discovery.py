"""Compare recent complete-PC leads with retailer identities already in BLUEDEAL."""
from collections import defaultdict
from datetime import datetime, timedelta
from html import escape
import json
from pathlib import Path
import re
from tempfile import NamedTemporaryFile

from ops.catalog.store import merchant_identity


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return {}


def identity(url):
    try:
        if isinstance(url, str) and re.fullmatch(r"https://www\.11st\.co\.kr/products/[0-9]+/share", url):
            url = url.removesuffix("/share")
        return merchant_identity(url)
    except (TypeError, ValueError, AttributeError):
        return None


def recent_pc_time(post, now):
    if post.get("category") != "fullpc" or post.get("ended") or post.get("offer_kind") == "raffle":
        return None
    try:
        at = datetime.fromisoformat(post.get("posted_upper") or "")
    except (TypeError, ValueError):
        return None
    return at if at.tzinfo is not None and now - timedelta(days=7) <= at <= now else None


def recent_complete_pc_candidates(catalog, entries, links_by_post, now, closed=()):
    known = {
        key for product in catalog.get("products", []) if product["category"] == "fullpc"
        for source in product.get("sources", []) if (key := identity(source["url"]))
    }
    missing = {}
    unresolved = []
    for post in entries:
        if (post["source"], post["post_id"]) in closed or not (at := recent_pc_time(post, now)):
            continue
        urls = links_by_post.get((post["source"], post["post_id"]), ())
        direct = {key: url for url in urls if (key := identity(url))}
        if not direct:
            unresolved.append({"title": post["title"], "source": post["post_url"], "posted_at": at.isoformat()})
        for key, url in direct.items():
            if key in known:
                continue
            lead = missing.setdefault(key, {"market": key[0], "listing_id": key[1], "seller_url": url,
                                            "title": post["title"], "signals": []})
            lead["signals"].append({"url": post["post_url"], "posted_at": at.isoformat()})
    candidates = sorted(missing.values(), key=lambda row: max(s["posted_at"] for s in row["signals"]), reverse=True)
    return {"missing": candidates, "unresolved": unresolved, "catalog_retailer_ids": len(known)}


def save_json(path, document):
    with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as stream:
        json.dump(document, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        temp = Path(stream.name)
    temp.replace(path)


def read_recent_post_links(folder, entries, now, links, closed):
    from ops.hotdeals.inspect_post_links import CrawlStop, Transport, extract

    path = folder / "fullpc-recent-post-links.local.json"
    report = read_json(path) or {"posts": []}
    if report.get("state") == "access-stopped" or read_json(folder / "fullpc-post-links.local.json").get("state") == "access-stopped":
        return "access-stopped"
    pending = []
    for post in entries:
        post_id = post["post_id"]
        url = f"https://quasarzone.com/bbs/qb_saleinfo/views/{post_id}"
        if (post["source"] == "quasarzone" and re.fullmatch(r"[0-9]+", post_id) and post["post_url"] == url
                and recent_pc_time(post, now) and ("quasarzone", post_id) not in links and ("quasarzone", post_id) not in closed):
            pending.append((post_id, url))
    if not pending:
        return "no-new-posts"
    transport = Transport("https://quasarzone.com")
    state = "checked"
    try:
        transport.load_robots()
        for post_id, url in pending[:4]:
            item = extract(transport.get(url), url)
            report["posts"].append({"post_id": post_id, "post_url": url, **item})
            if item["ended_in_heading"]:
                closed.add(("quasarzone", post_id))
            else:
                links[("quasarzone", post_id)].extend(item["merchant_link_candidates"])
    except CrawlStop:
        state = "access-stopped"
    except OSError:
        state = "network-unavailable"
    report.update(state=state, checked_at=now.isoformat())
    save_json(path, report)
    return state


def write_fullpc_discovery(root: Path, entries, now, *, refresh_links=False):
    folder = root / "ops/private/catalog-review"
    catalog = read_json(root / "src/content/products/catalog.json")
    links = defaultdict(list)
    closed = set()
    for evidence in sorted(folder.glob("*-post-links.local.json")):
        for row in read_json(evidence).get("posts", []):
            post_id = str(row.get("post_id"))
            if row.get("post_url") != f"https://quasarzone.com/bbs/qb_saleinfo/views/{post_id}":
                continue
            key = ("quasarzone", post_id)
            if row.get("ended_in_heading"):
                closed.add(key)
            else:
                links[key].extend(row.get("merchant_link_candidates", []))
    link_scan = read_recent_post_links(folder, entries, now, links, closed) if refresh_links else "cached"
    results = recent_complete_pc_candidates(catalog, entries, links, now, closed)
    results.update(checked_at=now.isoformat(), link_scan=link_scan)
    save_json(folder / "fullpc-discovery.local.json", results)
    def link(url, title):
        if not url.startswith("https://"):
            return escape(title)
        return f'<a href="{escape(url, quote=True)}" rel="noopener noreferrer">{escape(title)}</a>'

    missing = "".join(f"<li>{link(row['seller_url'], row['title'])} · {escape(row['market'])}</li>" for row in results["missing"])
    unresolved = "".join(f"<li>{link(row['source'], row['title'])}</li>" for row in results["unresolved"])
    page = f"""<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>완본체 누락 후보</title><style>body{{font:16px/1.8 system-ui;max-width:860px;margin:24px auto;padding:0 18px;background:#091327;color:#e6f0fa}}a{{color:#a3efff}}</style>
<h1>완본체 누락 후보</h1><p>{escape(now.isoformat()[:16].replace('T',' '))} KST · 최근 7일의 미종료 후보를 판매처 상품번호와 대조했습니다.</p>
<p><a href="report.html">상품 검토로 돌아가기</a></p><h2>미등록 판매번호 ({len(results['missing'])}건)</h2><ul>{missing}</ul>
<h2>판매 링크 확인 필요 ({len(results['unresolved'])}건)</h2><ul>{unresolved}</ul>
<p>등록 전 판매처의 현재 재고, 선택 구성, 보증, 수량 1 금액과 배송비를 확인합니다.</p></html>"""
    with NamedTemporaryFile("w", encoding="utf-8", dir=folder, delete=False) as stream:
        stream.write(page)
        temp = Path(stream.name)
    temp.replace(folder / "fullpc-discovery.html")
    return {
        "missing_complete_pc_listings": len(results["missing"]),
        "complete_pc_posts_without_direct_listing": len(results["unresolved"]),
        "known_complete_pc_retailer_ids": results["catalog_retailer_ids"],
        "fullpc_post_link_scan": link_scan,
    }
