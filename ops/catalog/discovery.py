"""Manufacturer-list ingestion; source entries are not verified domestic SKUs."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import hashlib
import html
import json
from pathlib import Path
import re
import sqlite3
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

from ops.catalog.public_fetch import SourceStopped
from ops.catalog.store import ROOT, json_text


def product_url(origin, href, prefix):
    url = urljoin(origin, href or '')
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.netloc != urlsplit(origin).netloc or parsed.username or parsed.password or parsed.query or parsed.fragment or not parsed.path.startswith(prefix):
        raise ValueError('UNEXPECTED_MANUFACTURER_PRODUCT_URL')
    return url


def parse_thermalright(soup):
    result = []
    for card in soup.select('a.product-card-item'):
        title = card.select_one('.product-card-name')
        ids = [value[5:] for value in card.get('class', []) if re.fullmatch(r'post-\d+', value)]
        categories = [value[12:] for value in card.get('class', []) if value.startswith('product_cat-')]
        if title is None or len(ids) != 1:
            raise ValueError('THERMALRIGHT_CARD_SCHEMA_CHANGED')
        subtype = ('ssd-heatsink' if 'ssd-cooler' in categories else 'ram-cooler' if 'ram-cooler' in categories else
                   'cpu-air-cooler' if set(categories) & {'single-tower-cooling', 'dual-towers', 'low-profile'} else 'unclassified-cooler')
        if subtype == 'unclassified-cooler':
            raise ValueError('THERMALRIGHT_UNCLASSIFIED_CARD')
        attributes = {key: card.get(key) for key in ('data-attr-fan-led', 'data-attr-heat-pipes', 'data-color', 'data-type') if card.get(key) is not None}
        result.append({'source_item_id': ids[0], 'manufacturer': 'Thermalright', 'category': 'cooler', 'item_kind': 'model',
                       'display_name': title.get_text(' ', strip=True), 'model_url': product_url('https://www.thermalright.com', card.get('href'), '/product/'),
                       'attributes': {'subtype': subtype, 'manufacturer_list_fields': attributes}, 'lifecycle': 'unknown'})
    return result


def parse_seasonic(soup):
    result = []
    for group in soup.select('.product-list'):
        heading = group.parent.find('a')
        if heading is None:
            raise ValueError('SEASONIC_GROUP_SCHEMA_CHANGED')
        discontinued = urlsplit(urljoin('https://seasonic.com', heading.get('href', ''))).path == '/discontinued-products/'
        for card in group.select('a.item'):
            title = card.select_one('.s-title')
            watts = card.select('.wattage span')
            if title is None or not watts:
                raise ValueError('SEASONIC_CARD_SCHEMA_CHANGED')
            family = title.get_text(' ', strip=True)
            url = product_url('https://seasonic.com', card.get('href'), '/')
            title_watts = re.search(r'-(\d{3,4})(?:\D|$)', family)
            for entry in watts:
                match = re.fullmatch(r'(\d{3,4})\s*W', entry.get_text(' ', strip=True))
                if match is None:
                    raise ValueError('SEASONIC_WATTAGE_SCHEMA_CHANGED')
                wattage = int(match[1])
                result.append({'source_item_id': urlsplit(url).path + f'@{wattage}W', 'manufacturer': 'Seasonic', 'category': 'psu',
                               'item_kind': 'listed-wattage-option', 'display_name': family + f' · {wattage}W', 'model_url': url,
                               'attributes': {'family_name': family, 'listed_wattage_w': wattage,
                                              'detail_verification_required': True,
                                              'name_wattage_conflict': bool(title_watts and int(title_watts[1]) != wattage)},
                               'lifecycle': 'listed-discontinued' if discontinued else 'listed-current'})
    return result


def parse_fractal(soup):
    result = []
    for card in soup.select('a[href]'):
        path = urlsplit(card['href']).path
        segments = path.strip('/').split('/')
        labels = card.find_all('p')
        if len(segments) != 5 or segments[:2] != ['products', 'cases'] or not labels:
            continue
        name = labels[0].get_text(' ', strip=True)
        url = product_url('https://www.fractal-design.com', card['href'], '/products/cases/')
        # The card represents a family and links to one default variant. Its
        # option buttons are not evidence that all exact SKUs were collected.
        result.append({'source_item_id': '/'.join(segments[:4]), 'manufacturer': 'Fractal Design', 'category': 'case',
                       'item_kind': 'product-family', 'display_name': name, 'model_url': url,
                       'attributes': {'default_variant_url': url, 'exact_variants_pending': True}, 'lifecycle': 'unknown'})
    return result


PARSERS = {'thermalright-cooler': parse_thermalright, 'seasonic-psu': parse_seasonic, 'fractal-case': parse_fractal}


def parse_source(source, raw):
    if len(raw) < 20000 and any(marker in raw.lower() for marker in (b'/_incapsula_resource', b'cf-chl-', b'checking your browser', b'verify you are human')):
        raise SourceStopped('access-challenge-stopped')
    if source not in PARSERS:
        raise ValueError('SOURCE_PARSER_NOT_IMPLEMENTED')
    items = PARSERS[source](BeautifulSoup(raw, 'html.parser'))
    unique = {}
    for item in items:
        if not item['display_name'].strip():
            raise ValueError('EMPTY_MANUFACTURER_MODEL_NAME')
        key = item['source_item_id']
        if key in unique and unique[key] != item:
            raise ValueError('CONFLICTING_SOURCE_IDENTITY')
        unique[key] = item
    if not unique:
        raise ValueError('EMPTY_OR_CHANGED_MANUFACTURER_LIST')
    return list(unique.values())


def ingest(root=ROOT):
    directory = root / 'ops/private/catalog'
    probes = directory / 'source-probes'
    records = json.loads((probes / 'manifest.local.json').read_text(encoding='utf-8'))
    database_file = directory / 'catalog.sqlite3'
    if not database_file.is_file():
        raise ValueError('RUN_CATALOG_BOOTSTRAP_FIRST')
    prepared = []
    for record in records:
        state = record['state']; items = []
        if state == 'fetched':
            source = record['source']
            if not re.fullmatch(r'[a-z0-9-]+', source):
                raise ValueError('INVALID_SOURCE_ID')
            raw = (probes / (source + '.html')).read_bytes()
            if hashlib.sha256(raw).hexdigest() != record['sha256']:
                raise ValueError('SOURCE_SNAPSHOT_HASH_MISMATCH')
            try:
                items = parse_source(source, raw); state = 'parsed-list-only'
            except SourceStopped as error:
                state = str(error)
            except ValueError as error:
                state = str(error)
        when = datetime.fromisoformat(record['retrieved_at'])
        if when.tzinfo is None:
            raise ValueError('SOURCE_TIMESTAMP_REQUIRES_TIMEZONE')
        prepared.append((record, state, items))
    database = sqlite3.connect(database_file, timeout=10)
    try:
        database.execute('PRAGMA foreign_keys=ON')
        if database.execute('SELECT version FROM schema_version').fetchall() != [(1,)]:
            raise ValueError('UNSUPPORTED_CATALOG_SCHEMA')
        database.executescript(Path(__file__).with_name('discovery.sql').read_text(encoding='utf-8'))
        parsed_at = datetime.now(timezone.utc).isoformat()
        with database:
            for record, state, items in prepared:
                source = record['source']; observed = record['retrieved_at']
                database.execute('INSERT INTO manufacturer_sources VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,retrieved_at=excluded.retrieved_at,parsed_at=excluded.parsed_at,source_hash=excluded.source_hash,observed_items=excluded.observed_items WHERE excluded.retrieved_at >= manufacturer_sources.retrieved_at',
                                 (source, record['url'], state, observed, parsed_at, record.get('sha256'), len(items)))
                for item in items:
                    database.execute('''INSERT INTO manufacturer_items(source_id,source_item_id,manufacturer,category,item_kind,display_name,model_url,attributes_json,lifecycle,first_seen_at,last_seen_at)
                        VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,source_item_id) DO UPDATE SET display_name=excluded.display_name,
                        model_url=excluded.model_url,attributes_json=excluded.attributes_json,lifecycle=excluded.lifecycle,last_seen_at=excluded.last_seen_at
                        WHERE excluded.last_seen_at > manufacturer_items.last_seen_at''',
                        (source, item['source_item_id'], item['manufacturer'], item['category'], item['item_kind'], item['display_name'], item['model_url'], json_text(item['attributes']), item['lifecycle'], observed, observed))
                    database.execute('INSERT OR IGNORE INTO manufacturer_item_observations VALUES(?,?,?,?,?)',
                                     (source, item['source_item_id'], record['sha256'], observed, json_text(item)))
        rows = database.execute('SELECT source_id,category,item_kind,lifecycle,attributes_json FROM manufacturer_items').fetchall()
        source_counts = Counter(row[0] for row in rows)
        summary = {'generated_at': parsed_at, 'manufacturer_list_entries': len(rows),
                   'item_kinds': dict(Counter(row[2] for row in rows)), 'categories': dict(Counter(row[1] for row in rows)),
                   'sources': [{'source': record['source'], 'state': state, 'snapshot_items': len(items), 'stored_items': source_counts[record['source']],
                                'retrieved_at': record['retrieved_at'], 'url': record['url']} for record, state, items in prepared],
                   'listed_current_psu_options': sum(row[1] == 'psu' and row[3] == 'listed-current' for row in rows),
                   'listed_discontinued_psu_options': sum(row[1] == 'psu' and row[3] == 'listed-discontinued' for row in rows),
                   'cooler_subtypes': dict(Counter(json.loads(row[4])['subtype'] for row in rows if row[1] == 'cooler')),
                   'domestic_confirmed': database.execute("SELECT count(*) FROM manufacturer_items WHERE domestic_state='confirmed'").fetchone()[0],
                   'price_observations': database.execute('SELECT count(*) FROM price_observations').fetchone()[0],
                   'published': False, 'unique_verified_domestic_skus': None,
                   'note': '공식 목록 항목입니다. 제품군·출력 옵션·모델을 구분하며 기존 31개 모델과 중복 대조 전입니다. 국내 유통·정확 품번·현재가 검증 수가 아닙니다.'}
        (directory / 'discovery-summary.local.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        render_report(database, summary, directory / 'discovery.html')
        return summary
    finally:
        database.close()


def render_report(database, summary, file):
    escape = html.escape
    rows = database.execute('SELECT manufacturer,category,item_kind,display_name,model_url,lifecycle FROM manufacturer_items ORDER BY category,manufacturer,display_name').fetchall()
    body = ''.join('<tr>' + ''.join('<td>' + escape(str(value)) + '</td>' for value in row[:4]) +
                   '<td><a href="' + escape(row[4], quote=True) + '" rel="noopener noreferrer">공식 목록 연결</a></td><td>' + escape(row[5]) + '</td></tr>' for row in rows)
    statuses = ''.join('<li>' + escape(source['source'] + ': ' + source['state'] + ' / ' + str(source['snapshot_items'])) + '</li>' for source in summary['sources'])
    file.write_text(f'''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>블루딜 제조사 목록 확보</title>
<style>body{{font:16px/1.7 system-ui;margin:24px;background:#07111f;color:#edf4ff}}a{{color:#9ae1ff}}table{{border-collapse:collapse;min-width:800px}}th,td{{text-align:left;padding:10px;border-bottom:1px solid #304253}}.scroll{{overflow:auto}}</style>
<h1>제조사 제품 목록 확보</h1><p>공식 목록 {summary['manufacturer_list_entries']}항목. {escape(summary['note'])}</p>
<p>새 국내 유통 확인 {summary['domestic_confirmed']}개 · 원장 가격 관측 {summary['price_observations']}개 · 외부 게시 없음.</p>
<p>제조사 사이트의 재고용 CSS와 제품군 이름을 실제 판매 재고·정확한 SKU로 취급하지 않습니다. listed-current는 제조사 현행 목록 구분이며 국내 판매를 뜻하지 않습니다.</p>
<ul>{statuses}</ul><div class="scroll"><table><thead><tr><th>제조사</th><th>분류</th><th>항목 종류</th><th>원문 명칭·옵션</th><th>출처</th><th>목록 상태</th></tr></thead><tbody>{body}</tbody></table></div></html>''', encoding='utf-8')


if __name__ == '__main__':
    result = ingest()
    print(json_text({key: result[key] for key in ('manufacturer_list_entries', 'item_kinds', 'categories', 'listed_current_psu_options', 'listed_discontinued_psu_options', 'cooler_subtypes', 'domestic_confirmed', 'price_observations', 'published')}))
