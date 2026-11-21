"""Apply reviewed PSU offers without fetching, promoting old offers or deploying."""
import argparse
import csv
import json
from pathlib import Path

from ops.catalog.store import merchant_identity
from ops.collector.build_prices import conditional_prices, parse_checked_at, parse_now, parse_price
from ops.catalog.apply_reviewed_cpus import BENEFIT_FIELDS

ROOT = Path(__file__).resolve().parents[2]


def prepare(root=ROOT):
    private = root / 'ops/private/catalog-review'
    accepted = json.loads((private / 'psu-reviewed-offers.local.json').read_text(encoding='utf-8'))
    unavailable = json.loads((private / 'psu-reviewed-unavailable.local.json').read_text(encoding='utf-8'))
    review = json.loads((root / 'ops/catalog/psu-review-2026-11-21.json').read_text(encoding='utf-8'))
    known = {row['id']: row for row in review['groups'] + review['additionalModels']}
    if len({row['post'] for row in review['decisions']}) != 19 or len(review['decisions']) != 19:
        raise ValueError('PSU_POST_COVERAGE_MISMATCH')
    ids = {row['id'] for row in accepted}
    if len(ids) != len(accepted): raise ValueError('PSU_DUPLICATE_OFFER')
    for row in accepted:
        if row['category'] != 'psu' or row['productId'] not in known or not row.get('seller') or not row.get('variant'):
            raise ValueError('UNKNOWN_PSU_REVIEW')
        merchant_identity(row['url'])
        parse_price(row['price']); parse_price(row['shippingFee'], allow_zero=True)
        parse_checked_at(row['checkedAt'], parse_now(None))
        conditional_prices(row, row['price'])
    public = []
    for model in known.values():
        offers = [row for row in accepted if row['productId'] == model['id']]
        observations = [row for row in unavailable if row['productId'] == model['id']]
        # A closed page alone does not establish the exact current non-GW model.
        if model['id'] == 'reviewed-asrock-sl-850g' and not offers: continue
        if not offers and not observations: continue
        sources = [{'label': row['source'] + ' 판매 페이지', 'url': row['url'], 'observedAt': row['checkedAt'], 'kind': 'retailer-listing'} for row in offers]
        sources += [{'label': '판매 상태·조건 확인', 'url': row['url'], 'observedAt': row['checkedAt'], 'kind': 'retailer-availability'} for row in observations]
        notes = ['80PLUS·ATX·PCIe 버전은 판매명 표기와 공식 인증·독립 시험 확인 여부를 구분해야 합니다.',
                 '적립금·구매 후 보상·다른 상품이나 외부 광고의 쿠폰을 결제 할인으로 차감하지 않았습니다.',
                 '정확한 제조사 품번·세대·색상·국내 보증·케이블 구성과 시스템의 전력·커넥터를 구매 전에 확인하세요.']
        if model.get('note'): notes.append(model['note'])
        if observations:
            notes.extend(dict.fromkeys(row['note'] for row in observations))
            notes.append('위 상태는 확인한 특정 판매 상품에 한정되며 다른 판매처나 모델 전체의 품절을 뜻하지 않습니다.')
        if not offers: notes.append('정확한 현재 판매조건이 확인되지 않아 가격표에 금액을 등록하지 않았습니다.')
        variants = list(dict.fromkeys(row['variant'] for row in offers)) or ['판매 모델·현재 조건 추가 대조 필요']
        public.append({'id': model['id'], 'name': model['name'], 'category': 'psu', 'subtype': 'power-supply', 'brand': model['brand'],
                       'kind': 'retailer-reviewed-model', 'features': variants[:2], 'specifications': [{'label': '판매 구성 표기', 'value': variant} for variant in variants],
                       'description': '실제 판매 페이지의 모델 표기와 판매 상태·조건을 검토한 파워입니다. 확인된 상품가·배송비·조건부 할인은 가격표에서 구분합니다. 인증·보호회로·커넥터·품질 평가는 공식 자료와 독립 시험 자료를 추가 검토 중입니다.',
                       'notes': notes, 'lifecycle': 'unknown', 'domesticState': 'listing-observed', 'manufacturerPartNumber': None,
                       'sources': sources, 'listObservedAt': None, 'strengths': [], 'issues': [], 'reviewSummary': None, 'reviewSources': [],
                       'listings': [{'id': row['id'], 'merchant': row['source'], 'seller': row['seller'], 'pricePage': '/prices/psu#' + row['id']} for row in offers]})
    file = root / 'ops/collector/input/products.csv'
    with file.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream); fields = list(reader.fieldnames); rows = list(reader)
    for field in BENEFIT_FIELDS:
        if field not in fields: fields.append(field)
    rows = [row for row in rows if row['id'] not in ids]
    rows += [{field: (row['variant'] if field == 'spec' else row.get(field, '')) for field in fields} for row in accepted]
    with file.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields); writer.writeheader(); writer.writerows(rows)
    destination = root / 'src/content/products/reviewed-psus.json'
    destination.write_text(json.dumps(public, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    file = root / 'ops/collector/catalog.json'; catalog = json.loads(file.read_text(encoding='utf-8-sig'))
    catalog['products'] = [row for row in catalog['products'] if row['id'] not in ids]
    catalog['products'] += [{'id': row['id'], 'category': 'psu', 'seller': row['seller'], 'sourceUrl': row['url']} for row in accepted]
    file.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'reviewedPosts': 19, 'acceptedPsuOffers': len(accepted), 'publicModels': len(public), 'purchasePricesInvented': 0}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--apply', action='store_true', required=True); parser.parse_args()
    print(json.dumps(prepare()))
