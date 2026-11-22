"""Bounded official-distributor inventory. Discovery never creates prices or reviews."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urljoin, urlsplit, parse_qs
from bs4 import BeautifulSoup
from ops.catalog.public_fetch import PublicFetch, SourceStopped

ORIGIN = 'https://www.seorinexpress.com'
SCOPES = {
    'klevv': ('ram', '056001'),
    'desktop-ddr5': ('ram', '038009'),
    'm2-ssd': ('ssd', '076001'),
    'atx-psu': ('psu', '034001'),
    'sfx-psu': ('psu', '034002'),
    'mid-tower': ('case', '035009'),
    'air-coolers': ('cooler', '046009002'),
}

def list_url(url):
    """One canonical URL for the same category/page; do not revisit page 1."""
    values = parse_qs(urlsplit(url).query)
    code = values.get('cateCd', [''])[0]
    page = values.get('page', ['1'])[0]
    if not code.isdigit() or not page.isdigit() or int(page) < 1:
        raise ValueError('INVALID_DISTRIBUTOR_LIST_PAGE')
    return f'{ORIGIN}/goods/goods_list.php?cateCd={code}' + (f'&page={int(page)}' if int(page) > 1 else '')

def parse_seorin(html, url, category):
    soup = BeautifulSoup(html, 'html.parser')
    rows = {}
    for box in soup.select('.goods_list_item .goods_list_cont .item_cont'):
        name = box.select_one('.item_name')
        link = name.find_parent('a', href=True) if name else None
        if not link: continue
        target = urljoin(url, link['href']); parsed = urlsplit(target)
        number = parse_qs(parsed.query).get('goodsNo', [''])[0]
        if parsed.scheme != 'https' or parsed.netloc != urlsplit(ORIGIN).netloc or parsed.path != '/goods/goods_view.php' or not number.isdigit():
            raise ValueError('INVALID_DISTRIBUTOR_PRODUCT_LINK')
        title = name.get_text(' ', strip=True)
        if not title: raise ValueError('MISSING_DISTRIBUTOR_PRODUCT_NAME')
        rows[number] = dict(sourceId=number, name=title, category=category, detailUrl=target)
    pages = []
    for a in soup.select('.pagination a[href]'):
        target = urljoin(url, a['href']); parsed = urlsplit(target)
        if parsed.scheme == 'https' and parsed.netloc == urlsplit(ORIGIN).netloc and parsed.path == '/goods/goods_list.php':
            if parse_qs(parsed.query).get('cateCd') == parse_qs(urlsplit(url).query).get('cateCd'):
                pages.append(list_url(target))
    return list(rows.values()), list(dict.fromkeys(pages))

def collect(scope, output, max_pages=2, resume=False):
    category, code = SCOPES[scope]
    output.mkdir(parents=True, exist_ok=True)
    queue = [f'{ORIGIN}/goods/goods_list.php?cateCd={code}']; seen = set(); products = {}; pages = []
    stopped = None
    previous = output/f'{scope}-inventory.json'
    if resume and previous.exists():
        saved = json.loads(previous.read_text(encoding='utf-8'))
        if saved['scope'] != scope or saved['category'] != category or saved['stopped']:
            raise ValueError('SOURCE_STOPPED_OR_WRONG_RESUME_SCOPE')
        pages = saved['pages']; seen = {list_url(page['url']) for page in pages}
        products = {row['sourceId']: row for row in saved['rows']}
        queue = [list_url(url) for url in saved['pendingPages'] if list_url(url) not in seen]
    client = PublicFetch(ORIGIN)
    if queue: client.robots()
    while queue and len(seen) < max_pages:
        url = queue.pop(0)
        if url in seen: continue
        seen.add(url)
        try: raw, charset = client.get(url)
        except SourceStopped as error:
            stopped = str(error); break
        html = raw.decode(charset or 'utf-8', errors='replace')
        rows, links = parse_seorin(html, url, category)
        if not rows: stopped = 'empty-list-needs-review'; break
        observed = datetime.now(timezone.utc).isoformat()
        file = f'{scope}-{len(pages)+1}.html'; (output/file).write_text(html, encoding='utf-8')
        pages.append(dict(url=url, observedAt=observed, sha256=hashlib.sha256(raw).hexdigest(), localFile=file, entries=len(rows)))
        for row in rows: products[row['sourceId']] = {**row, 'listUrl': url, 'observedAt': observed}
        for link in links:
            if link not in seen and link not in queue: queue.append(link)
    result = dict(distributor='서린씨앤아이 공식 온라인 스토어', scope=scope, category=category, pages=pages,
                  rows=list(products.values()), pendingPages=[url for url in queue if url not in seen], stopped=stopped,
                  statement='목록 등록 여부만 확인. 현재가·재고·국내 보증·후기·동일 모델 매칭은 별도 검증.')
    (output/f'{scope}-inventory.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    return dict(scope=scope, pages=len(pages), uniqueEntries=len(products), pendingPages=len(result['pendingPages']), stopped=stopped)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--scope', choices=SCOPES, required=True)
    parser.add_argument('--max-pages', type=int, choices=range(1,5), default=2)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--resume', action='store_true')
    args=parser.parse_args()
    print(json.dumps(collect(args.scope,args.output,args.max_pages,args.resume),ensure_ascii=False))

if __name__=='__main__': main()
