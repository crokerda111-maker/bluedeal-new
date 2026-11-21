"""Apply explicitly reviewed CPU observations; this command never fetches or deploys."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from ops.catalog.store import merchant_identity
from ops.collector.build_prices import conditional_prices, parse_checked_at, parse_now, parse_price

ROOT = Path(__file__).resolve().parents[2]
BENEFIT_FIELDS = [kind + field for kind in ('instant', 'coupon', 'card')
                  for field in ('Price', 'Note', 'StartsOn', 'EndsOn', 'EndsAt')] + ['cardRequiresCoupon']


def validate_offers(offers, models, now):
    seen = set()
    for row in offers:
        if row['id'] in seen or row['productId'] not in models or row['category'] != 'cpu':
            raise ValueError('CPU_REVIEW_ID_CONFLICT')
        seen.add(row['id'])
        if not row.get('seller') or not row.get('spec'):
            raise ValueError('CPU_SELLER_OR_OPTION_MISSING')
        merchant, code = merchant_identity(row['url'])
        if row['sourceKey'] != merchant + ':' + code:
            raise ValueError('CPU_SOURCE_ID_MISMATCH')
        parse_price(row['price'])
        parse_price(row['shippingFee'], allow_zero=True)
        parse_checked_at(row['checkedAt'], now)
        conditional_prices(row, row['price'])
    return seen


def prepare(root=ROOT):
    review = json.loads((root / 'ops/catalog/cpu-review-2026-11-21.json').read_text(encoding='utf-8'))
    if len(review['posts']) != 59 or len({r['post'] for r in review['posts']}) != 59:
        raise ValueError('CPU_POST_COVERAGE_MISMATCH')
    models = {row['id']: row for row in review['models']}
    if len(models) != len(review['models']): raise ValueError('CPU_MODEL_ID_CONFLICT')
    offers = json.loads((root / 'ops/private/catalog-review/cpu-reviewed-offers.local.json').read_text(encoding='utf-8'))
    accepted_ids = validate_offers(offers, models, parse_now(None))
    for post in review['posts']:
        if post['modelId'] not in models or not set(post['verifiedListingIds'] + post['alternativeListingIds']) <= accepted_ids:
            raise ValueError('CPU_POST_LISTING_MISMATCH')
    input_path = root / 'ops/collector/input/products.csv'
    with input_path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream); fields = list(reader.fieldnames); rows = list(reader)
    previous = {row['id']: row for row in rows}
    for field in BENEFIT_FIELDS:
        if field not in fields: fields.append(field)
    preserved = [row for row in rows if row['id'] not in accepted_ids]
    for offer in offers:
        # Rechecked legacy listings retain their exact /go source URL and manufacturer reference.
        old = previous.get(offer['id'], {})
        if old and old['url'] != offer['url']: raise ValueError('CPU_LEGACY_URL_DRIFT')
        row = {field: offer.get(field, '') for field in fields}
        if old.get('officialUrl'): row['officialUrl'] = old['officialUrl']
        preserved.append(row)
    public = []
    for model in models.values():
        model_offers = [r for r in offers if r['productId'] == model['id']]
        sources = list(model['sources'])
        for offer in model_offers:
            official = previous.get(offer['id'], {}).get('officialUrl')
            if official and not any(s['url'] == official for s in sources):
                sources.append({'label': '기존 등록 제조사 자료 · 상세 재대조 필요', 'url': official, 'observedAt': None, 'kind': 'curated-reference'})
        public.append({'id': model['id'], 'name': model['name'], 'category': 'cpu', 'subtype': 'cpu', 'brand': model['brand'],
                       'kind': 'retailer-reviewed-model', 'features': [model['variant']],
                       'specifications': [{'label': '판매 구성 표기', 'value': model['variant']}],
                       'description': '실제 판매 페이지의 모델과 구성을 확인한 CPU입니다. 기본 상품가·배송비·조건부 할인·확인 시각을 구분해 제공합니다. 제조사 상세 사양·성능·품질·후기 평가는 추가 검토 중입니다.',
                       'notes': ['멀티팩·벌크·해외직구·정품 표기는 판매 상품 기준입니다. 포장·수입 유통사·국내 보증·쿨러 구성과 메인보드 BIOS 지원은 구매 전에 확인하세요.',
                                 '과거 핫딜의 적립·경유·게임 증정·학생 혜택을 현재 혜택으로 승계하지 않았습니다.', *model['notes']],
                       'lifecycle': 'unknown', 'domesticState': 'listing-observed', 'manufacturerPartNumber': None,
                       'sources': sources, 'listObservedAt': None, 'strengths': [], 'issues': [], 'reviewSummary': None, 'reviewSources': [],
                       'listings': [{'id': r['id'], 'merchant': r['source'], 'seller': r['seller'], 'pricePage': '/prices/cpu#' + r['id']} for r in model_offers]})
    with input_path.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields); writer.writeheader(); writer.writerows(preserved)
    (root / 'src/content/products/reviewed-cpus.json').write_text(json.dumps(public, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    summary = {'reviewedOn': review['reviewedOn'], 'reviewedPosts': 59, 'retailerModels': len(public), 'priceOffers': len(offers)}
    (root / 'src/content/cpuReviewSummary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    catalog_path = root / 'ops/collector/catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8-sig'))
    catalog['products'] = [row for row in catalog['products'] if row['id'] not in accepted_ids]
    catalog['products'] += [{'id': r['id'], 'category': 'cpu', 'seller': r['seller'], 'sourceUrl': r['url']} for r in offers]
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'reviewedPosts': 59, 'models': len(public), 'acceptedOffers': len(offers), 'preservedPriceRows': len(preserved) - len(offers)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--apply', action='store_true', required=True); parser.parse_args()
    print(json.dumps(prepare(), ensure_ascii=False))
