"""Seed an independent private catalog without upgrading legacy facts or prices."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from urllib.parse import parse_qs, urlsplit

from ops.maintenance.candidate_index import baseline_models

ROOT = Path(__file__).resolve().parents[2]
OPTION_FIELDS = ('capacityGB', 'moduleCapacityGB', 'moduleCount', 'memoryType')


def json_text(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def merchant_identity(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port or parsed.fragment:
        raise ValueError('INVALID_MERCHANT_URL')
    if parsed.hostname == 'usr.icoda.co.kr' and not parsed.query:
        segments = parsed.path.strip('/').split('/')
        if len(segments) == 3 and segments[:2] == ['item', 'view'] and segments[2].isascii() and segments[2].isdigit():
            return 'icoda', segments[2]
    if parsed.hostname == 'www.lotteon.com' and not parsed.query:
        segments = parsed.path.strip('/').split('/')
        if len(segments) == 3 and segments[:2] == ['p', 'product'] and segments[2].startswith('LO') and segments[2][2:].isascii() and segments[2][2:].isdigit():
            return 'lotteon', segments[2]
    if parsed.hostname in ('darkflash.co.kr', 'www.darkflash.co.kr') and parsed.path == '/product/detail.html':
        query = parse_qs(parsed.query, keep_blank_values=True)
        codes = query.get('product_no', [])
        if len(query) == 1 and len(codes) == 1 and codes[0].isascii() and codes[0].isdigit():
            return 'darkflash', codes[0]
    if parsed.hostname in ('www.ssg.com', 'emart.ssg.com', 'shinsegaemall.ssg.com') and parsed.path == '/item/itemView.ssg':
        query = parse_qs(parsed.query, keep_blank_values=True)
        if set(query) <= {'itemId', 'siteNo', 'salestrNo'} and 'itemId' in query and all(len(values) == 1 and values[0].isascii() and values[0].isdigit() for values in query.values()):
            return 'ssg', query['itemId'][0]
    if parsed.hostname in ('seorinexpress.com', 'www.seorinexpress.com') and parsed.path == '/goods/goods_view.php':
        query = parse_qs(parsed.query)
        codes = query.get('goodsNo', [])
        if len(query) == 1 and len(codes) == 1 and codes[0].isascii() and codes[0].isdigit():
            return 'seorinexpress', codes[0]
    if parsed.hostname == 'www.compuzone.co.kr' and parsed.path == '/product/product_detail.htm':
        query = parse_qs(parsed.query)
        codes = query.get('ProductNo', [])
        if len(query) == 1 and len(codes) == 1 and codes[0].isascii() and codes[0].isdigit():
            return 'compuzone', codes[0]
    if parsed.hostname == 'item.gmarket.co.kr' and parsed.path == '/Item':
        query = parse_qs(parsed.query)
        codes = [code for key, values in query.items() if key.lower() == 'goodscode' for code in values]
        if len(query) == 1 and len(codes) == 1 and codes[0].isascii() and codes[0].isdigit():
            return 'gmarket', codes[0]
    if parsed.hostname == 'www.11st.co.kr' and not parsed.query:
        segments = parsed.path.strip('/').split('/')
        if len(segments) == 2 and segments[0] == 'products' and segments[1].isascii() and segments[1].isdigit():
            return '11st', segments[1]
    raise ValueError('UNSUPPORTED_MERCHANT_URL')


def bootstrap(root=ROOT):
    """Idempotent insert; conflicts stop for review and never overwrite verified data."""
    reduced, models = baseline_models(root)
    catalog = json.loads((root / 'ops/collector/catalog.json').read_text(encoding='utf-8-sig'))['products']
    if len({item['id'] for item in catalog}) != len(catalog) or {item['id'] for item in catalog} != set(reduced):
        raise ValueError('BASELINE_CATALOG_MISMATCH')
    by_id = {item['id']: item for item in catalog}
    sources = {}
    for file in sorted((root / 'src/content/prices').glob('*.json')):
        data = json.loads(file.read_text(encoding='utf-8-sig'))
        for item in data.get('items', []):
            # No goCode, affiliate identifier or live price is copied into a verified record.
            payload = {key: item.get(key) for key in ('id', 'name', 'officialUrl', *OPTION_FIELDS)}
            sources[item['id']] = (file.relative_to(root).as_posix(), payload)
    prepared = []
    for model in models:
        for listing_id in model['listing_ids']:
            item = by_id[listing_id]
            if item['category'] != model['category'] or any(item.get(key) != reduced[listing_id].get(key) for key in OPTION_FIELDS):
                raise ValueError('BASELINE_OPTION_MISMATCH')
            merchant, product_id = merchant_identity(item['sourceUrl'])
            prepared.append((model, item, merchant, product_id))

    file = root / 'ops/private/catalog/catalog.sqlite3'
    file.parent.mkdir(parents=True, exist_ok=True)
    database = sqlite3.connect(file, timeout=10)
    try:
        database.execute('PRAGMA foreign_keys=ON')
        if database.execute("SELECT 1 FROM sqlite_master WHERE name='schema_version'").fetchone():
            if database.execute('SELECT version FROM schema_version').fetchall() != [(1,)]:
                raise ValueError('UNSUPPORTED_CATALOG_SCHEMA')
        database.executescript((Path(__file__).with_name('schema.sql')).read_text(encoding='utf-8'))
        retrieved_at = datetime.now(timezone.utc).isoformat()
        with database:
            for model, item, merchant, product_id in prepared:
                part_id = model['internal_model_id']; variant_id = part_id + '@curated'
                attributes = {key: reduced[part_id].get(key) for key in OPTION_FIELDS if reduced[part_id].get(key) is not None}
                database.execute('INSERT OR IGNORE INTO parts VALUES(?,?,?,?,?,?)',
                                 (part_id, model['category'], model['name'], None, None, 'curated-unverified'))
                database.execute('INSERT OR IGNORE INTO variants VALUES(?,?,?,?,?)',
                                 (variant_id, part_id, None, json_text(attributes), 'curated-unverified'))
                existing = database.execute('SELECT variant_id,merchant,merchant_product_id,source_url,seller FROM listings WHERE id=?', (item['id'],)).fetchone()
                expected = (variant_id, merchant, product_id, item['sourceUrl'], item['seller'])
                if existing is not None and existing != expected:
                    raise ValueError('EXISTING_LISTING_REQUIRES_REVIEW')
                database.execute('INSERT OR IGNORE INTO listings VALUES(?,?,?,?,?,?,?)',
                                 (item['id'], *expected, 'needs-merchant-verification'))
                artifact, payload = sources[item['id']]
                evidence_id = hashlib.sha256(json_text([artifact, payload]).encode('utf-8')).hexdigest()
                database.execute('INSERT OR IGNORE INTO evidence VALUES(?,?,?,?,?,?,?,?)',
                                 (evidence_id, 'legacy-curated-artifact', model['official_url'], artifact, retrieved_at, None, None, json_text(payload)))
                for key in OPTION_FIELDS:
                    if payload.get(key) is not None:
                        database.execute('INSERT OR IGNORE INTO facts VALUES(?,?,?,?,?)',
                                         (variant_id, key, json_text(payload[key]), evidence_id, 'curated-unverified'))
        counts = {table: database.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
                  for table in ('parts', 'variants', 'listings', 'evidence', 'price_observations', 'benefit_versions', 'affiliate_routes')}
        if database.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('CATALOG_FOREIGN_KEY_FAILURE')
        return {'state': 'catalog-seeded-unverified', **counts, 'fresh_prices_collected': 0, 'published': False}
    finally:
        database.close()


if __name__ == '__main__':
    print(json_text(bootstrap()))
