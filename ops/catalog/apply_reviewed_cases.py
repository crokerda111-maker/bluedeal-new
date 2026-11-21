"""Apply reviewed case quotes without fetching or advancing observation times."""
import argparse
import csv
import json
from pathlib import Path
from ops.catalog.apply_reviewed_cpus import BENEFIT_FIELDS
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import conditional_prices,parse_checked_at,parse_now,parse_price

ROOT=Path(__file__).resolve().parents[2]

def validate_offers(offers,models,now):
    ids=set();keys=set()
    for r in offers:
        m=models.get(r['productId'])
        if not m or r['id'] in ids or r['category']!='case' or m['category']!='case' or m['subtype']!='pc-case' or r['sourceKey'] in keys:
            raise ValueError('CASE_MODEL_OR_SOURCE_CONFLICT')
        ids.add(r['id']);keys.add(r['sourceKey'])
        merchant,code=merchant_identity(r['url'])
        if r['sourceKey']!=merchant+':'+code or not r.get('seller') or not r.get('spec'):raise ValueError('CASE_SOURCE_OR_VARIANT_MISSING')
        parse_price(r['price']);parse_price(r['shippingFee'],allow_zero=True);conditional_prices(r,r['price'])
        checked=parse_checked_at(r['checkedAt'],now)
        if r.get('availability')!='unknown' or not r.get('quantityOneVerified') or r.get('quantityOneTotal')!=r['price'] or parse_checked_at(r['quantityVerifiedAt'],now)<checked:
            raise ValueError('CASE_QUANTITY_OR_STATE_UNCONFIRMED')
        if not any(s['url']==r['url'] and s['kind']=='retailer-listing' and parse_checked_at(s['observedAt'],now)==checked for s in m['sources']):
            raise ValueError('CASE_REVIEW_SOURCE_MISMATCH')
    return ids

def prepare(root=ROOT):
    review=json.loads((root/'ops/catalog/case-review-2026-11-21.json').read_text(encoding='utf-8'))
    models={m['id']:m for m in review['models']}
    if len(models)!=len(review['models']) or len({p['post'] for p in review['posts']})!=7:raise ValueError('CASE_COVERAGE_MISMATCH')
    offers=json.loads((root/'ops/private/catalog-review/case-reviewed-offers.local.json').read_text(encoding='utf-8'))
    ids=validate_offers(offers,models,parse_now(None))
    claimed=[r['id'] for m in models.values() for r in m['listings']]
    if len(set(claimed))!=len(claimed) or set(claimed)!=ids:raise ValueError('CASE_LISTING_COVERAGE_MISMATCH')
    for p in review['posts']:
        if not set(p['modelIds'])<=models.keys() or not set(p['verifiedListingIds'])<=ids:raise ValueError('CASE_POST_MODEL_MISMATCH')
    file=root/'ops/collector/input/products.csv'
    with file.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f);fields=list(reader.fieldnames);prior=list(reader)
    if not {r['id'] for r in prior if r['category']=='case'}<=ids:raise ValueError('CASE_PREVIOUS_LISTING_MISSING')
    old={r['id']:r for r in prior}
    if any(r['id'] in old and old[r['id']]['url']!=r['url'] for r in offers):raise ValueError('CASE_URL_DRIFT')
    for field in BENEFIT_FIELDS:
        if field not in fields:fields.append(field)
    with file.open('w',encoding='utf-8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows([r for r in prior if r['id'] not in ids]+[{k:r.get(k,'') for k in fields} for r in offers])
    (root/'src/content/products/reviewed-cases.json').write_text(json.dumps(review['models'],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    summary={k:review[k] for k in ['reviewedOn','merchantObservations','freshPriceOffers']};summary.update(reviewedPosts=7,originalCategoryPosts=5,transferredPosts=2,retailerModels=len(models),priceRecords=len(offers))
    (root/'src/content/caseReviewSummary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    file=root/'ops/collector/catalog.json';catalog=json.loads(file.read_text(encoding='utf-8-sig'));catalog['products']=[r for r in catalog['products'] if r['id'] not in ids]+[dict(id=r['id'],category='case',seller=r['seller'],sourceUrl=r['url']) for r in offers];file.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return summary

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true',required=True);parser.parse_args();print(json.dumps(prepare(),ensure_ascii=False))
