"""Publish explicitly reviewed RAM variants and offers; never fetch or deploy."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from ops.catalog.apply_reviewed_cpus import BENEFIT_FIELDS
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import conditional_prices, parse_checked_at, parse_now, parse_price, product_attributes

ROOT = Path(__file__).resolve().parents[2]


def validate_offers(offers, models, now):
    ids = set()
    sources = set()
    for row in offers:
        if row['id'] in ids or row['sourceKey'] in sources or row['productId'] not in models or row['category'] != 'ram':
            raise ValueError('RAM_REVIEW_ID_CONFLICT')
        ids.add(row['id']); sources.add(row['sourceKey'])
        if not row.get('seller') or not row.get('spec'):
            raise ValueError('RAM_SELLER_OR_OPTION_MISSING')
        merchant, code = merchant_identity(row['url'])
        if row['sourceKey'] != merchant + ':' + code:
            raise ValueError('RAM_SOURCE_ID_MISMATCH')
        parse_price(row['price']); parse_price(row['shippingFee'], allow_zero=True)
        parse_checked_at(row['checkedAt'], now)
        product_attributes(row, 'ram')
        conditional_prices(row, row['price'])
    return ids


def prepare(root=ROOT):
    review = json.loads((root / 'ops/catalog/ram-review-2026-11-21.json').read_text(encoding='utf-8'))
    if len(review['posts']) != 67 or len({row['post'] for row in review['posts']}) != 67:
        raise ValueError('RAM_POST_COVERAGE_MISMATCH')
    models = {row['id']: row for row in review['models']}
    if len(models) != len(review['models']): raise ValueError('RAM_MODEL_ID_CONFLICT')
    offers = json.loads((root / 'ops/private/catalog-review/ram-reviewed-offers.local.json').read_text(encoding='utf-8'))
    ids = validate_offers(offers, models, parse_now(None))
    for row in review['posts']:
        if not set(row['modelIds']) <= models.keys() or not set(row['verifiedListingIds'] + row['alternativeListingIds']) <= ids:
            raise ValueError('RAM_POST_LISTING_MISMATCH')
        for listing in row['verifiedListingIds'] + row['alternativeListingIds']:
            if next(r['productId'] for r in offers if r['id'] == listing) not in row['modelIds']:
                raise ValueError('RAM_POST_VARIANT_MISMATCH')
    file = root / 'ops/collector/input/products.csv'
    with file.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream); fields = list(reader.fieldnames); previous = list(reader)
    prior = {row['id']: row for row in previous}
    old_ram = {row['id'] for row in previous if row['category'] == 'ram'}
    mixed_file=root/'src/content/products/reviewed-mixed.json'
    mixed_ids={r['id'] for m in json.loads(mixed_file.read_text(encoding='utf-8')) for r in m['listings']} if mixed_file.exists() else set()
    if not old_ram <= ids | mixed_ids: raise ValueError('RAM_LEGACY_LISTING_MISSING')
    for offer in offers:
        if offer['id'] in prior and prior[offer['id']]['url'] != offer['url']:
            raise ValueError('RAM_LEGACY_URL_DRIFT')
    for field in BENEFIT_FIELDS:
        if field not in fields: fields.append(field)
    rows = [row for row in previous if row['id'] not in ids]
    rows += [{field: offer.get(field, '') for field in fields} for offer in offers]
    public = []
    for model in models.values():
        model_offers = [row for row in offers if row['productId'] == model['id']]
        options = list(dict.fromkeys(row['spec'] for row in model_offers))
        specifications = list(model.get('specifications', []))
        for key,label in [('memoryType','메모리 종류'),('capacityGB','판매 용량(GB)'),('moduleCapacityGB','모듈 용량(GB)'),('moduleCount','모듈 수')]:
            if key in model: specifications.append({'label':label,'value':str(model[key])})
        specifications += [{'label':'판매 구성 표기','value':value} for value in options[:2]]
        notes = list(dict.fromkeys([*model.get('notes', []),
            '속도·CL·색상·RGB·총 용량·모듈 수·AMD 패키지를 구분했습니다. 품번·메모리 프로필·폼팩터·국내 보증은 구매 전에 확인하세요.',
            '판매 페이지의 품절·행사 종료는 해당 상품의 확인 시점 상태이며 모델 전체의 단종이나 모든 판매처의 품절을 뜻하지 않습니다.',
            '과거 핫딜의 적립·경유·리뷰 보상·BTC를 현재 결제 할인으로 승계하지 않았습니다.']))
        if not model_offers: notes.append('현재 구매 조건이 확인되지 않아 가격표에 금액을 등록하지 않았습니다.')
        public.append({'id':model['id'],'name':model['name'],'category':'ram','subtype':'ram','brand':model['brand'],
            'kind':'retailer-reviewed-model','features':options[:2] or ['판매 구성·상태 확인 · 현재가 미등록'],
            'specifications':specifications,'description':'실제 판매 페이지에서 모델·용량·선택 구성을 대조한 RAM입니다. 상품가·배송비·조건부 쿠폰 및 카드가·확인 시각을 구분해 제공합니다. 별도 근거가 없는 품질·성능·후기 평점은 산정하지 않았습니다.',
            'notes':notes,'lifecycle':'unknown','domesticState':'listing-observed','manufacturerPartNumber':model.get('manufacturerPartNumber'),
            'sources':model['sources'],'listObservedAt':None,'strengths':[],'issues':[],'reviewSummary':None,'reviewSources':[],
            'listings':[{'id':r['id'],'merchant':r['source'],'seller':r['seller'],'pricePage':'/prices/ram#'+r['id']} for r in model_offers]})
    with file.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields); writer.writeheader(); writer.writerows(rows)
    (root / 'src/content/products/reviewed-ram.json').write_text(json.dumps(public,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    summary={'reviewedOn':review['reviewedOn'],'reviewedPosts':67,'retailerModels':len(public),'priceOffers':len(offers),'recheckedLegacyOffers':len(review['legacyListingIds'])}
    (root / 'src/content/ramReviewSummary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    file = root / 'ops/collector/catalog.json'; catalog = json.loads(file.read_text(encoding='utf-8-sig'))
    catalog['products']=[row for row in catalog['products'] if row['id'] not in ids]
    catalog['products'] += [{'id':row['id'],'category':'ram','seller':row['seller'],'sourceUrl':row['url']} for row in offers]
    file.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return summary


if __name__ == '__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--apply',action='store_true',required=True); parser.parse_args()
    print(json.dumps(prepare(),ensure_ascii=False))
