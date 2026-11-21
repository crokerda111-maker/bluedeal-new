"""Publish manufacturer HDD specifications without creating seller prices."""
import argparse,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def prepare(root=ROOT):
    review=json.loads((root/'ops/catalog/hdd-review-2026-11-21.json').read_text(encoding='utf-8'))
    if len(review['posts'])!=4 or len({p['post'] for p in review['posts']})!=4:raise ValueError('HDD_POST_SCOPE_MISMATCH')
    models=review['models'];ids={m['id'] for m in models}
    if len(ids)!=len(models) or any(m['category']!='hdd' or m['listings'] or m['domesticState']!='unverified' or not m['manufacturerPartNumber'] for m in models):raise ValueError('HDD_SPECS_ARE_NOT_RETAIL_QUOTES')
    if any(not set(p['modelIds'])<=ids or p['verifiedListingIds'] for p in review['posts']):raise ValueError('HDD_POST_REFERENCE_MISMATCH')
    (root/'src/content/products/reviewed-hdds.json').write_text(json.dumps(models,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    summary=dict(reviewedOn=review['reviewedOn'],reviewedPosts=4,manufacturerModels=len(models),priceOffers=0,restrictedPosts=3)
    (root/'src/content/hddReviewSummary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return summary

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true',required=True);parser.parse_args();print(json.dumps(prepare(),ensure_ascii=False))
