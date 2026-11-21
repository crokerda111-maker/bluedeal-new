"""Publish reviewed SSD observations without fetching or advancing timestamps."""
import argparse
import csv
import json
from pathlib import Path

from ops.catalog.apply_reviewed_cpus import BENEFIT_FIELDS
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import conditional_prices, parse_checked_at, parse_now, parse_price, product_attributes

ROOT=Path(__file__).resolve().parents[2]


def validate_offers(offers,models,now):
    ids=set();sources=set()
    for row in offers:
        if row['id'] in ids or row['sourceKey'] in sources or row['category']!='ssd' or row['productId'] not in models:
            raise ValueError('SSD_REVIEW_ID_CONFLICT')
        ids.add(row['id']);sources.add(row['sourceKey'])
        if not row.get('seller') or not row.get('spec'):raise ValueError('SSD_SELLER_OR_OPTION_MISSING')
        merchant,code=merchant_identity(row['url'])
        if row['sourceKey']!=merchant+':'+code:raise ValueError('SSD_SOURCE_ID_MISMATCH')
        parse_price(row['price']);parse_price(row['shippingFee'],allow_zero=True)
        parse_checked_at(row['checkedAt'],now);product_attributes(row,'ssd');conditional_prices(row,row['price'])
    return ids


def prepare(root=ROOT):
    review=json.loads((root/'ops/catalog/ssd-review-2026-11-21.json').read_text(encoding='utf-8'))
    if len(review['posts'])!=65 or len({p['post'] for p in review['posts']})!=65:raise ValueError('SSD_POST_COVERAGE_MISMATCH')
    models={m['id']:m for m in review['models']}
    if len(models)!=len(review['models']):raise ValueError('SSD_MODEL_ID_CONFLICT')
    offers=json.loads((root/'ops/private/catalog-review/ssd-reviewed-offers.local.json').read_text(encoding='utf-8'))
    ids=validate_offers(offers,models,parse_now(None))
    byid={r['id']:r for r in offers}
    for post in review['posts']:
        if not set(post['modelIds'])<=models.keys() or not set(post['verifiedListingIds']+post['alternativeListingIds'])<=ids:raise ValueError('SSD_POST_LISTING_MISMATCH')
        if any(byid[r]['productId'] not in post['modelIds'] for r in post['verifiedListingIds']+post['alternativeListingIds']):raise ValueError('SSD_POST_VARIANT_MISMATCH')
    file=root/'ops/collector/input/products.csv'
    with file.open(encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream);fields=list(reader.fieldnames);previous=list(reader)
    old={r['id']:r for r in previous}
    if not {r['id'] for r in previous if r['category']=='ssd'}<=ids:raise ValueError('SSD_LEGACY_LISTING_MISSING')
    if any(r['id'] in old and old[r['id']]['url']!=r['url'] for r in offers):raise ValueError('SSD_LEGACY_URL_DRIFT')
    for field in BENEFIT_FIELDS:
        if field not in fields:fields.append(field)
    rows=[r for r in previous if r['id'] not in ids]+[{f:r.get(f,'') for f in fields} for r in offers]
    public=[]
    for m in models.values():
        listings=[r for r in offers if r['productId']==m['id']]
        specs=list(m.get('specifications',[]));options=list(dict.fromkeys(r['spec'] for r in listings))
        if 'capacityGB' in m:specs.append({'label':'판매 용량(GB)','value':str(m['capacityGB'])})
        specs += [{'label':'판매 구성 표기','value':o} for o in options[:2]]
        notes=list(dict.fromkeys([*m.get('notes',[]),'같은 제품군이라도 용량·방열판·정품/해외직구·국내 유통과 보증 조건이 다르면 별도 확인이 필요합니다.',
                                 'DRAM·HMB·NAND·최대 성능은 제조사 자료와 판매명 표기를 구분합니다. HMB 지원만으로 DRAM 유무나 품질을 추정하지 않았습니다.',
                                 '적립·경유·구매 후 보상은 현재 상품가나 카드 할인으로 합산하지 않았습니다.']))
        if not listings:notes.append('현재 구매 총액·판매 상태가 확인되지 않아 가격표에 금액을 등록하지 않았습니다.')
        public.append({'id':m['id'],'name':m['name'],'category':'ssd','subtype':m['subtype'],'brand':m['brand'],'kind':'retailer-reviewed-model',
                       'features':options[:2] or ['판매 구성·상태 확인 · 현재가 미등록'],'specifications':specs,
                       'description':'실제 판매 페이지에서 모델·용량·판매 상태와 가격 조건을 확인한 SSD입니다. 종료된 행사·품절·관부가세 미확인 금액은 현재 구매가로 등록하지 않았습니다. 공식 자료를 연결한 항목도 독립 성능·품질·후기 평가는 별도로 검토해야 합니다.',
                       'notes':notes,'lifecycle':'unknown','domesticState':'listing-observed','manufacturerPartNumber':m.get('manufacturerPartNumber'),'sources':m['sources'],
                       'listObservedAt':None,'strengths':[],'issues':[],'reviewSummary':None,'reviewSources':[],
                       'listings':[{'id':r['id'],'merchant':r['source'],'seller':r['seller'],'pricePage':'/prices/ssd#'+r['id']} for r in listings]})
    with file.open('w',encoding='utf-8',newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();writer.writerows(rows)
    (root/'src/content/products/reviewed-ssds.json').write_text(json.dumps(public,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    summary={'reviewedOn':review['reviewedOn'],'reviewedPosts':65,'ssdCandidates':44,'accessories':17,'hddNasCandidates':4,'retailerModels':len(public),'priceOffers':len(offers),'recheckedLegacyOffers':len(review['legacyListingIds'])}
    (root/'src/content/ssdReviewSummary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    file=root/'ops/collector/catalog.json';catalog=json.loads(file.read_text(encoding='utf-8-sig'))
    catalog['products']=[r for r in catalog['products'] if r['id'] not in ids]+[{'id':r['id'],'category':'ssd','seller':r['seller'],'sourceUrl':r['url']} for r in offers]
    file.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return summary


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true',required=True);parser.parse_args()
    print(json.dumps(prepare(),ensure_ascii=False))
