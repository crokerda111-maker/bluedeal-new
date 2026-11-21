"""Export only accepted, directly observed PSU offers from the review ledger."""
import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def prepare(root=ROOT):
    ledger=json.loads((root/'ops/private/catalog-review/psu-merchant-observations.local.json').read_text(encoding='utf-8'))
    accepted=[row for row in ledger['observations'] if row.get('priceAccepted') is True]
    groups=json.loads((root/'ops/catalog/psu-review-2026-11-21.json').read_text(encoding='utf-8'))['groups']
    known={row['id']:row for row in groups}
    public=[]
    for row in accepted:
        if row['category']!='psu' or row['productId'] not in known or row['postId'] not in known[row['productId']]['posts']:
            raise ValueError('UNKNOWN_PSU_REVIEW')
        public.append({'id':row['productId'],'name':row['name'],'category':'psu','subtype':'power-supply','brand':known[row['productId']]['brand'],
            'kind':'retailer-reviewed-model','features':[row['variant']], 'specifications':[{'label':'판매 모델','value':row['variant']}],
            'description':'실제 판매 페이지에서 모델명과 상품가·기본 배송비를 확인한 파워입니다. 인증·보호회로·커넥터 구성·품질 평가는 공식 자료와 독립 시험 자료를 추가 검토 중입니다.',
            'notes':['적립금·구매 후 보상·외부 광고의 쿠폰을 실결제 할인으로 차감하지 않습니다.','정확한 제조사 품번·리비전·국내 보증과 시스템 전력·전원 커넥터를 구매 전에 확인하세요.'],
            'lifecycle':'unknown','domesticState':'listing-observed','manufacturerPartNumber':None,
            'sources':[{'label':row['source']+' 판매 페이지','url':row['url'],'observedAt':row['checkedAt'],'kind':'retailer-listing'}],
            'listObservedAt':None,'strengths':[],'issues':[],'reviewSummary':None,'reviewSources':[],
            'listings':[{'id':row['id'],'merchant':row['source'],'seller':row['seller'],'pricePage':'/prices/psu#'+row['id']}]})
    destination=root/'src/content/products/reviewed-psus.json'
    destination.write_text(json.dumps(public,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    file=root/'ops/collector/input/products.csv'
    with file.open(encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream);fields=list(reader.fieldnames);rows=list(reader)
    ids={row['id'] for row in accepted}
    rows=[row for row in rows if row['id'] not in ids]
    rows += [{field:(row['variant'] if field=='spec' else row.get(field,'')) for field in fields} for row in accepted]
    with file.open('w',encoding='utf-8',newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();writer.writerows(rows)
    file=root/'ops/collector/catalog.json';catalog=json.loads(file.read_text(encoding='utf-8-sig'))
    catalog['products']=[row for row in catalog['products'] if row['id'] not in ids]
    catalog['products'] += [{'id':row['id'],'category':'psu','seller':row['seller'],'sourceUrl':row['url']} for row in accepted]
    file.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return {'acceptedPsuOffers':len(accepted),'catalogModelsAdded':len(public),'purchasePricesInvented':0}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true',required=True);parser.parse_args()
    print(json.dumps(prepare()))
