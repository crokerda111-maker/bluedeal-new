"""Publish reviewed PC listings; conditional totals never become ordinary prices."""
import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from ops.catalog.apply_reviewed_cpus import BENEFIT_FIELDS
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import conditional_prices,parse_checked_at,parse_now,parse_price
ROOT=Path(__file__).resolve().parents[2]

def validate_offers(offers,models,now):
    ids=set();keys=set()
    for r in offers:
        m=models.get(r['productId'])
        if not m or r['id'] in ids or r['category'] not in ['fullpc','halfpc'] or m['category']!=r['category'] or r['sourceKey'] in keys:raise ValueError('SYSTEM_MODEL_OR_ID_CONFLICT')
        ids.add(r['id']);keys.add(r['sourceKey'])
        merchant,code=merchant_identity(r['url'])
        if r['sourceKey']!=merchant+':'+code or not r.get('seller') or not r.get('spec'):raise ValueError('SYSTEM_SOURCE_OR_VARIANT_MISSING')
        parse_price(r['price']);parse_price(r['shippingFee'],allow_zero=True);conditional_prices(r,r['price'])
        checked=parse_checked_at(r['checkedAt'],now)
        kind=r.get('quantityTotalKind');field={'ordinary':'price','coupon':'couponPrice','card':'cardPrice'}.get(kind)
        if not field or not r.get('quantityOneVerified') or r.get('quantityOneTotal')!=r.get(field) or r.get('availability')!='unknown' or parse_checked_at(r['quantityVerifiedAt'],now)<checked:raise ValueError('SYSTEM_UNIT_TOTAL_UNCONFIRMED')
        if kind in ['coupon','card'] and not r.get(kind+'Note'):raise ValueError('SYSTEM_CONDITIONAL_TOTAL_WITHOUT_NOTE')
        if kind=='coupon':
            observed_discount=parse_price(r.get('autoCouponDisplayed'))
            if r.get('couponBaselineMatches') is not True or r.get('preCouponDisplayed')!=r['price'] or observed_discount!=r['price']-r['couponPrice']:raise ValueError('SYSTEM_COUPON_BASELINE_UNCONFIRMED')
        if kind=='card' and r.get('cardRequiresCoupon') and not r.get('couponPrice'):raise ValueError('SYSTEM_COUPON_DEPENDENCY_MISSING')
        if not any(s['url']==r['url'] and s['kind']=='retailer-listing' and parse_checked_at(s['observedAt'],now)==checked for s in m['sources']):raise ValueError('SYSTEM_EVIDENCE_MISMATCH')
    return ids

def prepare(root=ROOT):
    read=lambda p:json.loads(p.read_text(encoding='utf-8'))
    review=read(root/'ops/catalog/systems-review-2026-11-21.json');models={m['id']:m for m in review['models']}
    counts=dict(Counter(p['category'] for p in review['posts']))
    if len(models)!=len(review['models']) or len({p['post'] for p in review['posts']})!=len(review['posts']) or counts!=review['reviewedPosts']:raise ValueError('SYSTEM_COVERAGE_MISMATCH')
    if any(review['totalCandidatePosts'][c]-counts.get(c,0)!=review['remainingPosts'][c] for c in review['totalCandidatePosts']):raise ValueError('SYSTEM_REMAINING_SCOPE_MISMATCH')
    offers=read(root/'ops/private/catalog-review/systems-reviewed-offers.local.json');ids=validate_offers(offers,models,parse_now(None))
    claimed=[r['id'] for m in models.values() for r in m['listings']]
    if len(set(claimed))!=len(claimed) or set(claimed)!=ids:raise ValueError('SYSTEM_LISTING_COVERAGE_MISMATCH')
    for p in review['posts']:
        if not set(p['modelIds'])<=models.keys() or not set(p['verifiedListingIds'])<=ids:raise ValueError('SYSTEM_POST_MODEL_MISMATCH')
    file=root/'ops/collector/input/products.csv'
    with file.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f);fields=list(reader.fieldnames);prior=list(reader)
    old={r['id']:r for r in prior}
    if not {r['id'] for r in prior if r['category'] in ['fullpc','halfpc']}<=ids:raise ValueError('SYSTEM_PREVIOUS_LISTING_MISSING')
    if any(r['id'] in old and old[r['id']]['url']!=r['url'] for r in offers):raise ValueError('SYSTEM_URL_DRIFT')
    for field in BENEFIT_FIELDS:
        if field not in fields:fields.append(field)
    with file.open('w',encoding='utf-8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows([r for r in prior if r['id'] not in ids]+[{k:r.get(k,'') for k in fields} for r in offers])
    (root/'src/content/products/reviewed-systems.json').write_text(json.dumps(review['models'],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    summary={k:review[k] for k in ['reviewedOn','totalCandidatePosts','reviewedPosts','remainingPosts','merchantObservations','freshPriceOffers']};summary.update(retailerModels=dict(Counter(m['category'] for m in models.values())),priceRecords=dict(Counter(r['category'] for r in offers)),restrictedPosts=review.get('restrictedPosts',{}))
    (root/'src/content/systemsReviewSummary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    file=root/'ops/collector/catalog.json';catalog=read(file);catalog['products']=[r for r in catalog['products'] if r['id'] not in ids]+[dict(id=r['id'],category=r['category'],seller=r['seller'],sourceUrl=r['url']) for r in offers];file.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return summary

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true',required=True);parser.parse_args();print(json.dumps(prepare(),ensure_ascii=False))
