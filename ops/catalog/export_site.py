"""Export an explicit public field allowlist; never upload the private database."""
from __future__ import annotations

from datetime import datetime
import hashlib
import json
from pathlib import Path
import sqlite3
from urllib.parse import urlsplit

from ops.catalog.store import ROOT, json_text
from ops.maintenance.candidate_index import baseline_models

CATEGORIES = {'cpu', 'motherboard', 'ram', 'gpu', 'psu', 'ssd', 'hdd', 'case', 'cooler', 'fullpc', 'halfpc', 'bundle'}
BRANDS = {'amd': 'AMD', 'samsung': 'Samsung', 'gskill': 'G.SKILL', 'klevv': 'KLEVV', 'agi': 'AGI',
          'apacer': 'Apacer', 'biwin': 'BIWIN', 'pny': 'PNY', 'msi': 'MSI', 'galax': 'GALAX',
          'colorful': 'COLORFUL', 'gainward': 'Gainward', 'palit': 'Palit', 'gigabyte': 'GIGABYTE', 'asus': 'ASUS'}


def public_url(value):
    if not isinstance(value, str):
        raise ValueError('MISSING_PUBLIC_SOURCE')
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.port:
        raise ValueError('INVALID_PUBLIC_SOURCE')
    if any(key in parsed.query.lower() for key in ('token=', 'password=', 'secret=', 'affiliate=', 'affid=')):
        raise ValueError('PRIVATE_QUERY_NOT_EXPORTABLE')
    return value


def feature_data(row):
    category = row['category']; attributes = json.loads(row['attributes_json'])
    features = []; specifications = []; notes = []
    if category == 'cooler':
        subtype = attributes.get('subtype')
        subtype_label = {'cpu-air-cooler': 'CPU 공랭 쿨러', 'ssd-heatsink': 'SSD 방열판', 'ram-cooler': 'RAM 쿨러'}.get(subtype)
        if subtype_label is None: raise ValueError('UNKNOWN_PUBLIC_COOLER_SUBTYPE')
        features.append(subtype_label)
        allowed = attributes.get('manufacturer_list_fields', {})
        tower = {'double': '듀얼 타워', 'single': '싱글 타워', 'low': '로우 프로파일'}.get(allowed.get('data-type'))
        if tower: features.append(tower)
        for key, label in [('data-color', '목록 색상'), ('data-attr-fan-led', '목록 LED'), ('data-attr-heat-pipes', '목록 히트파이프 수')]:
            if allowed.get(key) is not None:
                specifications.append({'label': label, 'value': str(allowed[key])})
        description = '제조사 쿨러 목록에서 확인한 모델입니다. 장착 소켓·높이·메모리 및 케이스 간섭은 상세 사양을 확인해야 합니다.'
    elif category == 'psu':
        wattage = attributes.get('listed_wattage_w')
        if type(wattage) is not int or not 100 <= wattage <= 10000: raise ValueError('INVALID_PUBLIC_PSU_OPTION')
        subtype = 'power-supply'; features.append(f'목록 출력 {wattage}W')
        specifications = [{'label': '제품군 표기', 'value': str(attributes['family_name'])}, {'label': '목록 출력 옵션', 'value': f'{wattage}W'}]
        if attributes.get('name_wattage_conflict') is True:
            notes.append('제조사 목록의 이름에 포함된 출력과 선택 출력이 다릅니다. 정확한 모델·품번을 재확인해야 합니다.')
        description = '제조사 제품군에 표시된 출력 옵션입니다. 정확한 품번·리비전·커넥터·국내 보증은 상세 자료와 판매처에서 확인해야 합니다.'
    elif category == 'case':
        subtype = 'case-family'; features.append('케이스 제품군')
        notes.append('제품군 기준입니다. 색상·패널·팬 구성에 따른 정확한 옵션은 확인 중입니다.')
        description = '제조사 케이스 목록에 있는 제품군입니다. 공식 링크는 목록에서 선택된 기본 옵션이며 다른 옵션의 사양을 대신하지 않습니다.'
    else:
        raise ValueError('UNSUPPORTED_MANUFACTURER_CATEGORY')
    return subtype, features, specifications, notes, description


def export(root=ROOT):
    private = root / 'ops/private/catalog'
    file = private / 'catalog.sqlite3'
    database = sqlite3.connect(file.resolve().as_uri() + '?mode=ro', uri=True)
    database.row_factory = sqlite3.Row
    try:
        reduced, models = baseline_models(root)
        catalog = json.loads((root / 'ops/collector/catalog.json').read_text(encoding='utf-8-sig'))['products']
        by_id = {item['id']: item for item in catalog}
        raw = {}
        for path in sorted((root / 'src/content/prices').glob('*.json')):
            data = json.loads(path.read_text(encoding='utf-8-sig'))
            for item in data.get('items', []): raw[item['id']] = {**item, 'category': data['category']}
        products = []; merchants = []
        reviewed_file = root / 'src/content/products/reviewed-models.json'
        reviewed = json.loads(reviewed_file.read_text(encoding='utf-8')) if reviewed_file.exists() else []
        psu_file = root / 'src/content/products/reviewed-psus.json'
        if psu_file.exists(): reviewed += json.loads(psu_file.read_text(encoding='utf-8'))
        cpu_file = root / 'src/content/products/reviewed-cpus.json'
        if cpu_file.exists(): reviewed += json.loads(cpu_file.read_text(encoding='utf-8'))
        ram_file = root / 'src/content/products/reviewed-ram.json'
        if ram_file.exists(): reviewed += json.loads(ram_file.read_text(encoding='utf-8'))
        ssd_file = root / 'src/content/products/reviewed-ssds.json'
        if ssd_file.exists(): reviewed += json.loads(ssd_file.read_text(encoding='utf-8'))
        gpu_file = root / 'src/content/products/reviewed-gpus.json'
        if gpu_file.exists(): reviewed += json.loads(gpu_file.read_text(encoding='utf-8'))
        cooling_file = root / 'src/content/products/reviewed-cooling.json'
        if cooling_file.exists(): reviewed += json.loads(cooling_file.read_text(encoding='utf-8'))
        case_file = root / 'src/content/products/reviewed-cases.json'
        if case_file.exists(): reviewed += json.loads(case_file.read_text(encoding='utf-8'))
        systems_file = root / 'src/content/products/reviewed-systems.json'
        if systems_file.exists(): reviewed += json.loads(systems_file.read_text(encoding='utf-8'))
        mixed_file = root / 'src/content/products/reviewed-mixed.json'
        if mixed_file.exists(): reviewed += json.loads(mixed_file.read_text(encoding='utf-8'))
        hdd_file = root / 'src/content/products/reviewed-hdds.json'
        if hdd_file.exists(): reviewed += json.loads(hdd_file.read_text(encoding='utf-8'))
        claimed = {listing['id'] for product in reviewed for listing in product['listings']}
        for model in models:
            if all(listing in claimed for listing in model['listing_ids']):
                continue
            if any(listing in claimed for listing in model['listing_ids']):
                raise ValueError('PARTIALLY_CLAIMED_PUBLIC_MODEL')
            product_id = 'curated-' + model['internal_model_id']
            primary = raw[model['internal_model_id']]
            specifications = []
            for key, label in [('memoryType', '메모리 종류'), ('capacityGB', '등록 용량(GB)'), ('moduleCapacityGB', '모듈 용량(GB)'), ('moduleCount', '모듈 수')]:
                if primary.get(key) is not None: specifications.append({'label': label, 'value': str(primary[key])})
            listings = []
            for listing_id in model['listing_ids']:
                item = raw[listing_id]; original = by_id[listing_id]
                listings.append({'id': listing_id, 'merchant': item.get('source', '판매처'), 'seller': original['seller'],
                                 'pricePage': '/prices/' + item['category']})
                merchants.append({'productId': product_id, 'listingId': listing_id, 'name': item['name'], 'category': item['category'],
                                  'merchant': item.get('source'), 'seller': original['seller'], 'sourceUrl': public_url(original['sourceUrl']),
                                  'recordedPriceKRW': item.get('price'), 'recordedShippingKRW': item.get('shippingFee'),
                                  'shippingNote': item.get('shippingNote'), 'priceConditions': item.get('priceNote'),
                                  'availabilityAtObservation': item.get('availability', 'unknown'), 'observedAt': item.get('checkedAt')})
            products.append({'id': product_id, 'name': primary['name'], 'category': model['category'], 'subtype': model['category'],
                             'brand': BRANDS.get(model['internal_model_id'].split('-')[0], '확인 필요'), 'kind': 'curated-model',
                             'features': [primary['spec']] if primary.get('spec') else [], 'specifications': specifications,
                             'description': '기존 부품 가격표에 등록된 모델입니다. 등록 사양과 이전 판매처 정보를 보존했으며 현재 구매 조건은 다시 확인해야 합니다.',
                             'notes': ['등록 사양의 정확한 제조사 품번·리비전은 추가 대조가 필요합니다.'],
                             'lifecycle': 'unknown', 'domesticState': 'unverified', 'manufacturerPartNumber': None,
                             'sources': [{'label': '기존 등록 제조사 자료', 'url': public_url(model['official_url']), 'observedAt': None, 'kind': 'curated-reference'}],
                             'listObservedAt': None, 'strengths': [], 'issues': [], 'reviewSummary': None, 'reviewSources': [],
                             'listings': listings})
        for row in database.execute('SELECT * FROM manufacturer_items ORDER BY source_id,source_item_id'):
            subtype, features, specifications, notes, description = feature_data(row)
            product_id = 'maker-' + row['source_id'] + '-' + hashlib.sha256(row['source_item_id'].encode('utf-8')).hexdigest()[:16]
            url = public_url(row['model_url'])
            products.append({'id': product_id, 'name': row['display_name'], 'category': row['category'], 'subtype': subtype,
                             'brand': row['manufacturer'], 'kind': row['item_kind'], 'features': features, 'specifications': specifications,
                             'description': description, 'notes': notes, 'lifecycle': row['lifecycle'],
                             'domesticState': 'unverified', 'manufacturerPartNumber': None,
                             'sources': [{'label': row['manufacturer'] + ' 공식 목록', 'url': url, 'observedAt': row['last_seen_at'], 'kind': 'manufacturer-list'}],
                             'listObservedAt': row['last_seen_at'], 'strengths': [], 'issues': [], 'reviewSummary': None, 'reviewSources': [], 'listings': []})
        if len({product['id'] for product in products}) != len(products) or any(product['category'] not in CATEGORIES for product in products):
            raise ValueError('PUBLIC_CATALOG_ID_OR_CATEGORY_CONFLICT')
        sources = [dict(row) for row in database.execute('SELECT id,url,state,retrieved_at,observed_items FROM manufacturer_sources ORDER BY id')]
        payload = {'schemaVersion': 1, 'products': products, 'sourceCoverage': sources}
        private.mkdir(parents=True, exist_ok=True)
        output = private / 'public-catalog.base.local.json'
        output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        (private / 'workbook-merchants.local.json').write_text(json.dumps(merchants, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        return {'baseCatalogEntries': len(products), 'merchantRecords': len(merchants), 'freshPricesAdded': 0}
    finally:
        database.close()


if __name__ == '__main__':
    print(json_text(export()))
