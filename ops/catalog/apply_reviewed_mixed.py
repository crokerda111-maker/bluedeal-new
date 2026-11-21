"""Publish reviewed misclassified candidates without changing previous records."""
import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from ops.catalog.apply_reviewed_cpus import BENEFIT_FIELDS
from ops.catalog.apply_reviewed_systems import validate_offers
from ops.collector.build_prices import parse_now,product_attributes
ROOT=Path(__file__).resolve().parents[2]

def prepare(root=ROOT):
    read=lambda p:json.loads(p.read_text(encoding='utf-8'))
    review=read(root/'ops/catalog/mixed-review-2026-11-21.json')
    if len(review['posts'])!=31 or len({p['post'] for p in review['posts']})!=31:raise ValueError('MIXED_POST_COVERAGE_MISMATCH')
    models={m['id']:m for m in review['models']}
    if len(models)!=len(review['models']):raise ValueError('MIXED_MODEL_CONFLICT')
    previous=read(root/'src/content/products/catalog.json')['products']
    previous_ids={m['id'] for m in previous}
    offers=read(root/'ops/private/catalog-review/mixed-reviewed-offers.local.json')
    ids=validate_offers(offers,models,parse_now(None),categories=('fullpc','ram'))
    for r in offers:
        if r['category']=='ram':product_attributes(r,'ram')
    claimed=[r['id'] for m in models.values() for r in m['listings']]
    if len(set(claimed))!=len(claimed) or set(claimed)!=ids:raise ValueError('MIXED_LISTING_COVERAGE_MISMATCH')
    for p in review['posts']:
        if not set(p['modelIds'])<=models.keys()|previous_ids or not set(p['verifiedListingIds'])<=ids|{r['id'] for m in previous for r in m['listings']}:raise ValueError('MIXED_REFERENCE_MISMATCH')
    # Packages remain packages. A sold-out displayed total never becomes a price.
    if any(m['listings'] for m in models.values() if m['category']=='bundle'):raise ValueError('MIXED_PACKAGE_QUOTE_UNCONFIRMED')
    file=root/'ops/collector/input/products.csv'
    with file.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f);fields=list(reader.fieldnames);prior=list(reader)
    old={r['id']:r for r in prior}
    if any(r['id'] in old and old[r['id']]['url']!=r['url'] for r in offers):raise ValueError('MIXED_URL_DRIFT')
    for field in BENEFIT_FIELDS:
        if field not in fields:fields.append(field)
    with file.open('w',encoding='utf-8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows([r for r in prior if r['id'] not in ids]+[{k:r.get(k,'') for k in fields} for r in offers])
    (root/'src/content/products/reviewed-mixed.json').write_text(json.dumps(review['models'],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    summary=dict(reviewedOn=review['reviewedOn'],candidatePosts=30,recoveredRamPosts=1,reviewedPosts=len(review['posts']),newModels=dict(Counter(m['category'] for m in models.values())),priceRecords=dict(Counter(r['category'] for r in offers)),restrictedPosts=1,packageModels=sum(m['category']=='bundle' for m in models.values()))
    (root/'src/content/mixedReviewSummary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    file=root/'ops/collector/catalog.json';catalog=read(file);catalog['products']=[r for r in catalog['products'] if r['id'] not in ids]+[dict(id=r['id'],category=r['category'],seller=r['seller'],sourceUrl=r['url']) for r in offers];file.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return summary

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true',required=True);parser.parse_args();print(json.dumps(prepare(),ensure_ascii=False))
