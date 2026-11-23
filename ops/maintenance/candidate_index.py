#!/usr/bin/env python3
"""Private catalog review: exact post deduplication, explicit listing aliases only."""
from __future__ import annotations

import csv
from datetime import datetime, timedelta, timezone
import html
import json
from pathlib import Path
import re
import sqlite3
import unicodedata

ROOT = Path(__file__).resolve().parents[2]
KST = timezone(timedelta(hours=9))
# These three existing listing pairs differ by retailer, not by the curated RAM option.
# Equality checks below reject future option drift rather than silently merging it.
LISTING_ALIASES = {
    'agi-turbojet-ud858-rgb-black-6000-cl30-48gb-11st': 'agi-turbojet-ud858-rgb-black-6000-cl30-48gb',
    'klevv-cras-v-rgb-white-6000-cl30-48gb-11st': 'klevv-cras-v-rgb-white-6000-cl30-48gb',
    'biwin-dw100-rgb-black-6000-cl28-48gb-11st': 'biwin-dw100-rgb-black-6000-cl28-48gb',
}


def normalized_ram_name(name):
    text = unicodedata.normalize('NFKC', name).lower().replace('블랙', 'black').replace('화이트', 'white')
    text = re.sub(r'\(\s*\d+\s*gb\s*[x×]\s*\d+\s*\)', '', text)
    return re.sub(r'\s+', ' ', text).strip()


def equivalent_ram(left, right):
    fields = ('capacityGB', 'moduleCapacityGB', 'moduleCount', 'memoryType')
    return (left['category'] == right['category'] == 'ram'
            and all(left.get(key) is not None and left.get(key) == right.get(key) for key in fields)
            and left['moduleCapacityGB'] * left['moduleCount'] == left['capacityGB']
            and normalized_ram_name(left['name']) == normalized_ram_name(right['name']))


def baseline_models(root=ROOT):
    listings = {}
    for file in sorted((root / 'src/content/prices').glob('*.json')):
        data = json.loads(file.read_text(encoding='utf-8-sig'))
        for item in data.get('items', []):
            if item['id'] in listings: raise ValueError('DUPLICATE_BASELINE_LISTING_ID')
            listings[item['id']] = {'category': data['category'], **{key: item.get(key) for key in ('id', 'name', 'capacityGB', 'moduleCapacityGB', 'moduleCount', 'memoryType', 'officialUrl')}}
    models = {}
    for listing_id, listing in listings.items():
        model_id = LISTING_ALIASES.get(listing_id, listing_id)
        if model_id != listing_id:
            if model_id not in listings or not equivalent_ram(listing, listings[model_id]): raise ValueError('BASELINE_ALIAS_VARIANT_MISMATCH')
        if model_id not in models:
            base = listings[model_id]
            models[model_id] = {'internal_model_id': model_id, 'name': base['name'], 'category': base['category'], 'official_url': base['officialUrl'], 'listing_ids': [], 'manufacturer_part_number': None, 'manufacturer_sku_verified': False}
        models[model_id]['listing_ids'].append(listing_id)
    return listings, list(models.values())


def read_archive(file, label):
    if not file.is_file(): return [], {'archive': label, 'state': 'missing'}
    database = sqlite3.connect(file.resolve().as_uri() + '?mode=ro', uri=True)
    database.row_factory = sqlite3.Row
    try:
        job = database.execute('SELECT id,since,until,state FROM jobs ORDER BY id DESC LIMIT 1').fetchone()
        if not job: return [], {'archive': label, 'state': 'empty'}
        records = []
        for item in database.execute('SELECT d.payload,j.window_status FROM job_posts j JOIN deals d USING(source,post_id) WHERE j.job_id=?', (job['id'],)):
            row = json.loads(item['payload'])
            if row['category'] == 'other': continue
            row['_provenance'] = {'archive': label, 'job_id': job['id'], 'observed_at': row.get('observed_at'), 'window_status': item['window_status']}
            records.append(row)
        states = [dict(row) for row in database.execute('SELECT source,state FROM progress WHERE job_id=?', (job['id'],))]
        return records, {'archive': label, 'job': dict(job), 'sources': states, 'pc_posts': len(records)}
    finally: database.close()


def observation_time(row):
    try:
        value = datetime.fromisoformat(row.get('observed_at', '').replace('Z', '+00:00'))
        if value.tzinfo is not None: return value
    except (ValueError, TypeError): pass
    return datetime.min.replace(tzinfo=timezone.utc)


def merge_posts(rows):
    merged = {}
    for row in rows:
        key = (row['source'], row['post_id'])
        evidence = dict(row['_provenance'])
        if key not in merged:
            merged[key] = {**row, 'provenance': [evidence]}
        else:
            previous = merged[key]; provenance = previous['provenance'] + [evidence]
            # Title similarity never merges distinct posts, SKUs, or capacities.
            latest = row if observation_time(row) > observation_time(previous) else previous
            merged[key] = {**latest, 'provenance': provenance}
    return [merged[key] for key in sorted(merged)]


def review_entry(row):
    return {
        'source': row['source'], 'post_id': row['post_id'], 'post_url': row['post_url'],
        'category': row['category'], 'title': row['title'], 'title_candidate_group': row['candidate_key'],
        'reported_price_text': row.get('price_text'), 'reported_observed_at': row.get('observed_at'),
        'posted_lower': row.get('posted_lower'), 'posted_upper': row.get('posted_upper'), 'date_precision': row.get('date_precision'),
        'provenance': row['provenance'], 'manufacturer_sku_verified': False, 'internal_model_id': None,
        'merchant_url': None, 'selected_variant': None, 'seller': None, 'current_price_krw': None,
        'shipping_krw': None, 'availability': 'unverified', 'price_checked_at': None,
        'review_state': 'exact-model-and-retailer-evidence-required',
    }


def csv_cell(value):
    text = str(value if value is not None else '')
    return "'" + text if text.lstrip().startswith(('=', '+', '-', '@')) or text.startswith(('\t', '\r', '\n')) else text


def build_index(root=ROOT, *, refresh_fullpc_links=False):
    listings, models = baseline_models(root)
    rows = []; coverage = []
    for label in ('hotdeal-research', 'hotdeal-watch'):
        records, source = read_archive(root / f'ops/private/{label}/hotdeals.sqlite3', label)
        rows.extend(records); coverage.append(source)
    entries = [review_entry(row) for row in merge_posts(rows)]
    summary = {'generated_at': datetime.now(KST).isoformat(), 'state': 'ready' if rows else 'sources-pending',
               'baseline_listings': len(listings), 'internal_models': len(models), 'explicit_retailer_aliases': len(listings) - len(models),
               'input_pc_post_rows': len(rows), 'unique_pc_posts': len(entries), 'duplicate_post_rows_removed': len(rows) - len(entries),
               'title_candidate_groups': len({(row['category'], row['title_candidate_group']) for row in entries}),
               'candidate_current_prices_verified': 0, 'candidate_manufacturer_skus_verified': 0, 'publication_authorized': False,
               'coverage': coverage, 'note': '제목 후보 그룹·내부 모델·판매 상품을 구분합니다. 목록 금액은 현재 판매가가 아니며 조사 자료의 상업적 재사용 범위는 별도 확인해야 합니다.'}
    output = root / 'ops/private/catalog-review'; output.mkdir(parents=True, exist_ok=True)
    for name, value in [('summary.local.json', summary), ('baseline-models.local.json', models), ('candidates.local.json', entries)]:
        (output / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    columns = ['source','post_id','post_url','category','title','title_candidate_group','reported_price_text','reported_observed_at','internal_model_id','merchant_url','selected_variant','seller','current_price_krw','shipping_krw','availability','price_checked_at','review_state']
    with (output / 'candidate-queue.generated.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=columns); writer.writeheader()
        for row in entries: writer.writerow({key: csv_cell(row.get(key)) for key in columns})
    e = html.escape
    table = ''.join(f"<tr><td>{e(row['category'])}</td><td>{e(row['title'])}</td><td>{e(row['reported_observed_at'] or '미확인')}</td><td>모델·판매처 검증 전</td></tr>" for row in entries[:100])
    page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>블루딜 통합 상품 검토</title><style>body{{background:#060b1a;color:#edf2fa;font:16px/1.8 system-ui;margin:24px}}a{{color:#9dedff}}table{{border-collapse:collapse;width:100%}}td,th{{padding:12px;border-bottom:1px solid #354057;text-align:left}}.scroll{{overflow:auto}}</style><h1>통합 상품 검토</h1><p>기존 판매 상품 {len(listings)}개 → 내부 모델 {len(models)}개. 제조사 SKU 확인과는 구분합니다.</p><p>PC 게시글 {len(rows)}행 중 동일 출처·글 번호 중복 {len(rows)-len(entries)}행을 제거해 {len(entries)}건을 정리했습니다.</p><p>현재 판매가와 후보 상품 SKU는 아직 확인하지 않았습니다. 같은 제목을 동일 제품이라고 자동 확정하지 않습니다.</p><p><a href="candidate-queue.generated.csv">자동생성 후보 목록 CSV</a> · <a href="fullpc-discovery.html">완본체 누락 후보</a> · <a href="../maintenance/dashboard.html">자동 관리 현황</a></p><p>목록은 수집 후 다시 생성됩니다. 검증 결과는 이 파일을 덮어쓰지 말고 별도 검증 기록에 보관해야 합니다.</p><p>아래는 첫 {min(100,len(entries))}건입니다. 과거 글·최근 글의 원래 관측 시각을 보존합니다.</p><div class="scroll"><table><thead><tr><th>분류</th><th>원문 제목</th><th>목록 관측 시각</th><th>검토 상태</th></tr></thead><tbody>{table}</tbody></table></div></html>'''
    (output / 'report.html').write_text(page, encoding='utf-8')
    from ops.maintenance.fullpc_discovery import write_fullpc_discovery
    summary['fullpc_discovery'] = write_fullpc_discovery(root, entries, datetime.now(KST), refresh_links=refresh_fullpc_links)
    (output / 'summary.local.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return summary


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='블루딜 상품 후보 검토')
    parser.add_argument('--refresh-fullpc-links', action='store_true')
    value = build_index(refresh_fullpc_links=parser.parse_args().refresh_fullpc_links)
    print(json.dumps({key: value[key] for key in ('state','baseline_listings','internal_models','unique_pc_posts','duplicate_post_rows_removed','fullpc_discovery')}, ensure_ascii=False))
