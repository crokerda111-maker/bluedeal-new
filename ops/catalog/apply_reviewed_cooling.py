"""Publish explicitly reviewed cooling models without fetching or refreshing time."""
import argparse
import csv
import json
from pathlib import Path
from ops.catalog.apply_reviewed_cpus import BENEFIT_FIELDS
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import conditional_prices,parse_checked_at,parse_now,parse_price

ROOT=Path(__file__).resolve().parents[2]
SUBTYPES={'cpu-liquid-cooler','cpu-air-cooler','case-fan'}


def validate_offers(offers,models,now):
    ids=set();keys=set()
    for row in offers:
        model=models.get(row['productId'])
        if row['id'] in ids or row['sourceKey'] in keys or row['category']!='cooler' or not model or model['subtype'] not in SUBTYPES:
            raise ValueError('COOLING_MODEL_OR_ID_CONFLICT')
        ids.add(row['id']);keys.add(row['sourceKey'])
        merchant,code=merchant_identity(row['url'])
        if row['sourceKey']!=merchant+':'+code or not row.get('seller') or not row.get('spec'):
            raise ValueError('COOLING_SOURCE_OR_VARIANT_MISSING')
        parse_price(row['price']);parse_price(row['shippingFee'],allow_zero=True)
        checked=parse_checked_at(row['checkedAt'],now);conditional_prices(row,row['price'])
        if row.get('availability')!='unknown' or not row.get('quantityOneVerified') or row.get('quantityOneTotal')!=row['price'] or parse_checked_at(row['quantityVerifiedAt'],now)<checked:
            raise ValueError('COOLING_QUANTITY_OR_STATE_UNCONFIRMED')
        if not any(s['url']==row['url'] and s['kind']=='retailer-listing' and parse_checked_at(s['observedAt'],now)==checked for s in model['sources']):
            raise ValueError('COOLING_REVIEW_SOURCE_MISMATCH')
    return ids


def prepare(root=ROOT):
    review=json.loads((root/'ops/catalog/cooling-review-2026-11-21.json').read_text(encoding='utf-8'))
    if len(review['posts'])!=26 or len({p['post'] for p in review['posts']})!=26:
        raise ValueError('COOLING_POST_COVERAGE_MISMATCH')
    models={m['id']:m for m in review['models']}
    if len(models)!=len(review['models']):raise ValueError('COOLING_MODEL_ID_CONFLICT')
    offers=json.loads((root/'ops/private/catalog-review/cooling-reviewed-offers.local.json').read_text(encoding='utf-8'))
    ids=validate_offers(offers,models,parse_now(None))
    claimed=[r['id'] for m in models.values() for r in m['listings']]
    if len(set(claimed))!=len(claimed) or set(claimed)!=ids:raise ValueError('COOLING_LISTING_COVERAGE_MISMATCH')
    for post in review['posts']:
        if not set(post['modelIds'])<=models.keys() or not set(post['verifiedListingIds'])<=ids:raise ValueError('COOLING_POST_MODEL_MISMATCH')
        if post['disposition'] in ['PC 부품 아님','케이스 별도 분류'] and post['verifiedListingIds']:raise ValueError('NON_COOLING_PRICE_REJECTED')
    file=root/'ops/collector/input/products.csv'
    with file.open(encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream);fields=list(reader.fieldnames);previous=list(reader)
    prior={r['id']:r for r in previous}
    if not {r['id'] for r in previous if r['category']=='cooler'}<=ids:raise ValueError('COOLING_PREVIOUS_LISTING_MISSING')
    if any(r['id'] in prior and prior[r['id']]['url']!=r['url'] for r in offers):raise ValueError('COOLING_PREVIOUS_URL_DRIFT')
    for field in BENEFIT_FIELDS:
        if field not in fields:fields.append(field)
    rows=[r for r in previous if r['id'] not in ids]+[{f:r.get(f,'') for f in fields} for r in offers]
    with file.open('w',encoding='utf-8',newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();writer.writerows(rows)
    (root/'src/content/products/reviewed-cooling.json').write_text(json.dumps(review['models'],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    summary={k:review[k] for k in ['reviewedOn','merchantObservations','freshPriceOffers']}
    summary.update(reviewedPosts=26,retailerModels=len(models),priceRecords=len(offers))
    (root/'src/content/coolingReviewSummary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    file=root/'ops/collector/catalog.json';catalog=json.loads(file.read_text(encoding='utf-8-sig'))
    catalog['products']=[r for r in catalog['products'] if r['id'] not in ids]+[{'id':r['id'],'category':'cooler','seller':r['seller'],'sourceUrl':r['url']} for r in offers]
    file.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return summary


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true',required=True);parser.parse_args()
    print(json.dumps(prepare(),ensure_ascii=False))
