"""Apply reviewed GPU offers; retain old sold-out prices without freshening them."""
import argparse
import csv
import json
from pathlib import Path

from ops.catalog.apply_reviewed_cpus import BENEFIT_FIELDS
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import conditional_prices, parse_checked_at, parse_now, parse_price, product_attributes

ROOT=Path(__file__).resolve().parents[2]


def validate_offers(offers,models,history,now):
    ids=set();keys=set()
    for row in offers:
        if row['id'] in ids or row['sourceKey'] in keys or row['category']!='gpu' or row['productId'] not in models:
            raise ValueError('GPU_REVIEW_ID_CONFLICT')
        ids.add(row['id']);keys.add(row['sourceKey'])
        if not row.get('seller') or not row.get('spec'):raise ValueError('GPU_SELLER_OR_VARIANT_MISSING')
        merchant,code=merchant_identity(row['url'])
        if row['sourceKey']!=merchant+':'+code:raise ValueError('GPU_SOURCE_ID_MISMATCH')
        if merchant=='redbitmall' and row.get('condition')!='refurbished':raise ValueError('GPU_REFURBISHED_CONDITION_MISSING')
        parse_price(row['price']);parse_price(row['shippingFee'],allow_zero=True)
        checked=parse_checked_at(row['checkedAt'],now)
        product_attributes(row,'gpu');conditional_prices(row,row['price'])
        if row.get('retainedHistory'):
            old=history.get(row['id'])
            if not old or row['availability']!='out-of-stock' or any(row.get(k)!=old[k] for k in ['price','checkedAt','sourceKey','goCode']) or row.get('availabilityCheckedAt')!=old['stockObservedAt']:
                raise ValueError('GPU_HISTORICAL_PRICE_DRIFT')
            if parse_checked_at(old['stockObservedAt'],now)<checked:raise ValueError('GPU_STOCK_OBSERVATION_BEFORE_PRICE')
        elif row.get('availability')!='unknown' or not row.get('quantityOneVerified') or row.get('quantityOneTotal')!=row['price'] or parse_checked_at(row['quantityVerifiedAt'],now)<checked:
            raise ValueError('GPU_QUANTITY_TOTAL_UNCONFIRMED')
    if set(history)!={r['id'] for r in offers if r.get('retainedHistory')}:raise ValueError('GPU_HISTORY_COVERAGE_MISMATCH')
    return ids


def prepare(root=ROOT):
    review=json.loads((root/'ops/catalog/gpu-review-2026-11-21.json').read_text(encoding='utf-8'))
    if len(review['posts'])!=138 or len({p['post'] for p in review['posts']})!=138:raise ValueError('GPU_POST_COVERAGE_MISMATCH')
    models={m['id']:m for m in review['models']};history={h['id']:h for h in review['retainedHistory']}
    if len(models)!=len(review['models']):raise ValueError('GPU_MODEL_ID_CONFLICT')
    offers=json.loads((root/'ops/private/catalog-review/gpu-reviewed-offers.local.json').read_text(encoding='utf-8'))
    ids=validate_offers(offers,models,history,parse_now(None));byid={r['id']:r for r in offers}
    for post in review['posts']:
        if not set(post['modelIds'])<=models.keys() or not set(post['verifiedListingIds']+post['alternativeListingIds'])<=ids:raise ValueError('GPU_POST_LISTING_MISMATCH')
        if any(byid[r]['productId'] not in post['modelIds'] for r in post['verifiedListingIds']+post['alternativeListingIds']):raise ValueError('GPU_POST_VARIANT_MISMATCH')
    file=root/'ops/collector/input/products.csv'
    with file.open(encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream);fields=list(reader.fieldnames);previous=list(reader)
    prior={r['id']:r for r in previous}
    if not {r['id'] for r in previous if r['category']=='gpu'}<=ids:raise ValueError('GPU_LEGACY_LISTING_MISSING')
    if any(r['id'] in prior and prior[r['id']]['url']!=r['url'] for r in offers):raise ValueError('GPU_LEGACY_URL_DRIFT')
    for field in BENEFIT_FIELDS:
        if field not in fields:fields.append(field)
    if 'availabilityCheckedAt' not in fields:fields.append('availabilityCheckedAt')
    if 'condition' not in fields:fields.append('condition')
    rows=[r for r in previous if r['id'] not in ids]+[{f:r.get(f,'') for f in fields} for r in offers]
    public=[]
    for m in models.values():
        listings=[r for r in offers if r['productId']==m['id']]
        notes=list(dict.fromkeys([*m['notes'],
            '여기서 확인한 항목은 판매명과 판매 구성입니다. 제조사 품번·색상·OC/SOC·쿨러·리비전·국내 유통·보증을 추가 대조해야 하며 전체 시장의 고유 SKU 수를 뜻하지 않습니다.',
            '게임 코드·리뷰·사은품·적립·경유를 결제 할인으로 차감하지 않았습니다. 증정 행사가 판매명에 남아 있어도 현재 제공을 보장하지 않습니다.',
            '장착 길이·슬롯 두께·케이스 간섭·전원 커넥터·파워 요구 조건과 성능·소음·발열·후기 평가는 별도 확인이 필요합니다.']))
        if not listings:notes.append('현재 가격표에 등록된 금액은 없습니다. 확인한 판매 상태와 범위는 개별 출처·주의사항을 참조하세요.')
        if any(r.get('retainedHistory') for r in listings):notes.append('연결된 가격표에는 품절 전의 과거 기록이 있습니다. 당시 금액과 가격 확인일을 보존했으며 현재 구매 가능한 가격으로 간주하지 마세요.')
        public.append({'id':m['id'],'name':m['name'],'category':'gpu','subtype':'gpu','brand':m['brand'],'kind':'retailer-reviewed-model',
                       'features':[m['name']],'specifications':([{'label':'판매명 그래픽 메모리(GB)','value':str(m['observedMemoryGB'])}] if m.get('observedMemoryGB') else []),
                       'description':'실제 판매 페이지에서 GPU 모델 표기와 확인 가능한 판매 상태를 검토한 항목입니다. 가격표에 등록한 상품만 수량1 금액·배송비를 대조했습니다. 독립적인 성능·품질·후기 점수는 아직 산정하지 않았습니다.',
                       'notes':notes,'lifecycle':'unknown','domesticState':'listing-observed','manufacturerPartNumber':None,'sources':m['sources'],
                       'listObservedAt':None,'strengths':[],'issues':[],'reviewSummary':None,'reviewSources':[],
                       'listings':[{'id':r['id'],'merchant':r['source'],'seller':r['seller'],'pricePage':'/prices/gpu'+('?condition=refurbished' if r.get('condition')=='refurbished' else '')+'#'+r['id']} for r in listings]})
    with file.open('w',encoding='utf-8',newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();writer.writerows(rows)
    (root/'src/content/products/reviewed-gpus.json').write_text(json.dumps(public,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    summary={'reviewedOn':review['reviewedOn'],'reviewedPosts':138,'retailerModels':len(public),'verifiedGmarketListings':review['verifiedGmarketListings'],
             'freshPriceOffers':review['freshPriceOffers'],'retainedOutOfStockOffers':len(history),'priceRecords':len(offers),
             'additionalMerchantObservations':review.get('additionalMerchantObservations',0),'refurbishedOffers':review.get('refurbishedOffers',0)}
    (root/'src/content/gpuReviewSummary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    file=root/'ops/collector/catalog.json';catalog=json.loads(file.read_text(encoding='utf-8-sig'))
    catalog['products']=[r for r in catalog['products'] if r['id'] not in ids]+[{'id':r['id'],'category':'gpu','seller':r['seller'],'sourceUrl':r['url']} for r in offers]
    file.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return summary


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true',required=True);parser.parse_args()
    print(json.dumps(prepare(),ensure_ascii=False))
