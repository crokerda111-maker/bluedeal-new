"""Prepare public records from locally observed offers, never fetch or publish."""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ops/collector'))
from build_prices import conditional_prices, normalize_url, parse_price  # noqa: E402

BENEFIT_FIELDS = ['couponPrice', 'couponNote', 'couponStartsOn', 'couponEndsOn', 'cardPrice', 'cardNote', 'cardStartsOn', 'cardEndsOn', 'cardRequiresCoupon']
PUBLIC_NOTES = {
    'reviewed-gigabyte-b850m-force-v2': 'FORCE V2 모델입니다. V2 표기가 없는 FORCE와 구분해 비교하세요.',
    'reviewed-gigabyte-b850m-force': 'V2 표기가 없는 FORCE 모델입니다. FORCE V2와 구분해 비교하세요.',
    'reviewed-colorful-battle-ax-a520m-k-m2-v14': 'V14 표기가 있는 판매 상품입니다. 다른 리비전과 구분해 확인하세요.',
    'reviewed-asus-tuf-b850m-plus-ii': 'B850M-PLUS II 모델입니다. B850-PLUS WIFI나 B850M Wi-Fi 모델의 사양을 대신하지 않습니다.',
    'reviewed-gigabyte-b850m-aorus-elite-wifi6e-ice': 'ICE 색상 모델입니다. 일반 색상과 정확한 리비전이 같은지 별도로 확인하세요.',
    'reviewed-gigabyte-b760m-aorus-elite-d4-gen5': 'D4 GEN5 표기가 있는 판매 상품입니다. 이전 D4 모델과 구분해 확인하세요.',
    'reviewed-asus-tuf-x870-plus-wifi': 'X870-PLUS WIFI 모델입니다. X870E-PLUS WIFI7과 다른 모델입니다.',
}
MANUALS = {
    'reviewed-asus-rog-strix-b860-g-gaming-wifi': ('ASUS 공식 사용자 설명서', 'https://dlcdnets.asus.com/pub/ASUS/mb/LGA1851/ROG_STRIX_B860-G_GAMING_WIFI/E25168_ROG_STRIX_B860-G_GAMING_WIFI_EM_WEB.pdf', [('CPU 소켓', 'Intel LGA1851 · Core Ultra Series 2'), ('칩셋', 'Intel B860'), ('규격', 'microATX 24.4 × 24.4cm'), ('메모리', 'DDR5 슬롯 4개')]),
    'reviewed-asus-tuf-x870e-plus-wifi7': ('ASUS 공식 사용자 설명서', 'https://dlcdnets.asus.com/pub/ASUS/mb/SocketAM5/TUF_GAMING_X870E-PLUS_WIFI7/E26142_TUF_GAMING_X870E-PLUS_WIFI7_EM_WEB.pdf', [('CPU 소켓', 'AMD AM5'), ('칩셋', 'AMD X870E'), ('규격', 'ATX 30.5 × 24.4cm'), ('메모리', 'DDR5 슬롯 4개'), ('유선 네트워크', '2.5Gb Ethernet')]),
    'reviewed-asus-tuf-b850-plus-wifi': ('ASUS 공식 사용자 설명서', 'https://dlcdnets.asus.com/pub/ASUS/mb/SocketAM5/TUF_GAMING_B850-PLUS_WIFI/E25809_TUF_GAMING_B850-PLUS_WIFI_UM_V2_WEB.pdf', [('CPU 소켓', 'AMD AM5'), ('메모리', 'DDR5')]),
}


def prepare(root=ROOT):
    review = json.loads((root / 'ops/catalog/motherboard-review-2026-11-21.json').read_text(encoding='utf-8'))
    posts = json.loads((root / 'ops/private/catalog-review/motherboard-post-links.local.json').read_text(encoding='utf-8'))['posts']
    ids = [post for group in review['groups'] for post in group['posts']] + [row['post'] for row in review['separateOffers']]
    if len(ids) != 40 or len(set(ids)) != 40 or set(ids) != {row['post_id'] for row in posts}:
        raise ValueError('BOARD_REVIEW_COVERAGE_MISMATCH')
    offers = json.loads((root / 'ops/private/catalog-review/merchant-observations.local.json').read_text(encoding='utf-8'))
    unavailable = json.loads((root / 'ops/private/catalog-review/merchant-unavailable.local.json').read_text(encoding='utf-8'))
    known = {row['id']: row for row in review['groups']}
    if len({row['id'] for row in offers}) != len(offers):
        raise ValueError('DUPLICATE_REVIEWED_OFFER')
    accepted = []
    for original in offers:
        offer = dict(original)
        if offer['productId'] not in known or offer['category'] != 'motherboard':
            raise ValueError('UNKNOWN_REVIEWED_MODEL')
        if offer.get('reviewStatus') == 'seller-unconfirmed':
            continue
        normalize_url(offer['url'])
        parse_price(offer['price'])
        if not offer.get('seller') or not offer.get('checkedAt'):
            raise ValueError('MISSING_REVIEWED_SELLER_OR_TIME')
        if offer.get('paymentOffers'):
            payment = offer['paymentOffers'][0]
            offer.update(cardPrice=payment['price'], cardNote=f"{payment['label']} {payment['discountAmount']:,}원 할인. 실구매금액 {payment['minimumSpend']:,}원 이상. {payment['conditions']}", cardStartsOn=payment['startsOn'], cardEndsOn=payment['endsOn'])
        if offer.get('couponPrice') and offer.get('cardPrice'):
            offer['cardRequiresCoupon'] = True
        conditional_prices(offer, offer['price'])
        accepted.append(offer)

    public = []
    for group in review['groups']:
        model_offers = [row for row in accepted if row['productId'] == group['id']]
        observations = [row for row in offers if row['productId'] == group['id']]
        stopped = [row for row in unavailable if row['productId'] == group['id'] and row['state'] in ('sold-out', 'not-selling') and row.get('identityConfirmed', True)]
        if not observations and not stopped:
            continue
        sources = [{'label': row['source'] + ' 판매 표기 확인', 'url': row['url'], 'observedAt': row['checkedAt'], 'kind': 'retailer-listing'} for row in observations]
        sources += [{'label': '판매처 상태 확인', 'url': row['url'], 'observedAt': row['checkedAt'], 'kind': 'retailer-availability'} for row in stopped]
        notes = ['같은 모델도 국내 유통사·정확한 리비전·보증 조건은 판매 상품별로 확인해야 합니다.']
        if group['id'] in PUBLIC_NOTES: notes.append(PUBLIC_NOTES[group['id']])
        if stopped:
            notes.append('확인한 특정 판매 페이지에 품절 또는 판매 중단 안내가 있었습니다. 전체 시장의 품절을 뜻하지 않으며 해당 페이지의 과거 가격을 현재가로 등록하지 않았습니다.')
        if observations and not model_offers:
            notes.append('판매 페이지의 쿠폰 상세는 로그인 확인이 필요하고 판매자 정보가 미확인이라 가격표 등록을 보류했습니다.')
        specifications = []
        for index, row in enumerate(observations, 1):
            specifications.append({'label': f'판매 표기 {index}', 'value': row['variant']})
        official = MANUALS.get(group['id'])
        if official:
            sources.insert(0, {'label': official[0], 'url': official[1], 'observedAt': '2026-11-21', 'kind': 'manufacturer-manual'})
            specifications = [{'label': label, 'value': value} for label, value in official[2]] + specifications
        features = [row['value'] for row in specifications[:2]] or ['판매 페이지의 모델명 확인 · 상세 사양 대조 중']
        if group['id'].endswith('d4-gen5'):
            notes.append('판매 페이지는 ELTIE D4 GEN5로 표기합니다. 제목의 철자 차이가 있어 제조사 정확한 품번 대조 전이며 이전 D4와 합치지 않았습니다.')
        if group['id'] == 'reviewed-asus-tuf-x870e-plus-wifi7':
            notes.append('공식 설명서: M.2_2를 x4로 사용하면 PCIe(G5)_1 그래픽 슬롯은 x8로 동작합니다. Ryzen 8000 계열에서는 M.2_2가 지원되지 않습니다. CPU·슬롯별 대역폭과 BIOS 지원을 확인하세요.')
        public.append({'id': group['id'], 'name': group['name'], 'category': 'motherboard', 'subtype': 'motherboard', 'brand': group['brand'],
                       'kind': 'source-reviewed-model' if official else 'retailer-reviewed-model', 'features': features, 'specifications': specifications,
                       'description': '실제 판매 페이지의 모델·유통 표기를 확인한 메인보드입니다. 가격은 판매처별 확인 시각과 할인 조건을 구분해 제공합니다. 성능·품질·후기 평가는 추가 검토 중입니다.',
                       'notes': notes, 'lifecycle': 'unknown', 'domesticState': 'listing-observed', 'manufacturerPartNumber': None,
                       'sources': sources, 'listObservedAt': None, 'strengths': [], 'issues': [], 'reviewSummary': None, 'reviewSources': [],
                       'listings': [{'id': row['id'], 'merchant': row['source'], 'seller': row['seller'], 'pricePage': '/prices/motherboard#' + row['id']} for row in model_offers]})

    input_path = root / 'ops/collector/input/products.csv'
    with input_path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream); fields = list(reader.fieldnames); rows = list(reader)
    for field in BENEFIT_FIELDS:
        if field not in fields: fields.append(field)
    accepted_ids = {row['id'] for row in accepted}
    preserved = [row for row in rows if row['id'] not in accepted_ids]
    for offer in accepted:
        row = {field: offer.get(field, '') for field in fields}
        row['spec'] = offer['variant']
        if offer['productId'] in MANUALS: row['officialUrl'] = MANUALS[offer['productId']][1]
        preserved.append(row)
    with input_path.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields); writer.writeheader(); writer.writerows(preserved)
    (root / 'src/content/products/reviewed-models.json').write_text(json.dumps(public, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    catalog_path = root / 'ops/collector/catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8-sig'))
    catalog['products'] = [row for row in catalog['products'] if row['id'] not in accepted_ids]
    catalog['products'] += [{'id': row['id'], 'category': 'motherboard', 'seller': row['seller'], 'sourceUrl': row['url']} for row in accepted]
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'reviewedPosts': len(ids), 'candidateGroups': len(review['groups']), 'separateOffers': len(review['separateOffers']), 'publishedModels': len(public), 'acceptedOffers': len(accepted), 'preservedPriceRows': len(preserved) - len(accepted)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--apply', action='store_true', required=True); parser.parse_args()
    print(json.dumps(prepare(), ensure_ascii=False))
