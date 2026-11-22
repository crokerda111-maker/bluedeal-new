"""Case quotes must retain their exact variant, shipment uncertainty and source."""
import copy
import json
from pathlib import Path
import unittest
from ops.catalog.apply_reviewed_cases import validate_offers
from ops.collector.build_prices import parse_now
ROOT=Path(__file__).resolve().parents[2]
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))

class ReviewedCases(unittest.TestCase):
    def test_case_promotions_are_not_current_prices_and_refurb_category_is_not_a_model(self):
        r=read('ops/catalog/case-review-2026-11-21.json')
        self.assertEqual(len({p['post'] for p in r['posts']}),7)
        self.assertEqual(sum(r['counts'].values()),7)
        self.assertEqual(sum(bool(p['verifiedListingIds']) for p in r['posts']),4)
        self.assertTrue(all(not p['originalPromotionVerified'] for p in r['posts']))
        self.assertEqual(next(p for p in r['posts'] if p['post']=='1961903')['modelIds'],[])
        self.assertTrue(all(not p['verifiedListingIds'] for p in r['posts'] if p['post'] in ['1965372','1954577']))

    def test_current_variant_prices_and_uncertain_stock_do_not_inherit_old_promotions(self):
        all_items=read('src/content/prices/case.json')['items']
        retail_ids={r['listingId'] for r in read('src/content/products/distributor-retail-reviewed.json')['decisions'] if r['category']=='case' and r['priceState']=='confirmed'}
        items=[p for p in all_items if p['id'] not in retail_ids]
        self.assertEqual({p['id'] for p in all_items},retail_ids|{p['id'] for p in items})
        self.assertEqual(len(items),4)
        actual={p['name']:(p['price'],p['shippingFee']) for p in items}
        self.assertEqual(actual,{'1STPlayer 와칠 WA7-K RGB 블랙':(39000,2500),'PHANTEKS EX5 블랙':(176740,2500),'Antec FLUX PRO MESH 화이트':(269000,0),'darkFlash FLOATRON F1 ARGB 블랙':(125000,2500)})
        self.assertTrue(all(p['availability']=='unknown' for p in items))
        self.assertTrue(all(not any(k in p for k in ['couponPrice','cardPrice','instantPrice']) for p in items))
        antec=next(p for p in items if p['name'].startswith('Antec'))
        self.assertIn('입고예정 미정',antec['priceNote'])
        models=read('src/content/products/reviewed-cases.json')
        self.assertTrue(all(m['specifications']==[] and m['reviewSummary'] is None for m in models))
        self.assertTrue(any('181mm/190mm' in n for m in models for n in m['notes']))

    def test_rejects_ambiguous_quantity_missing_shipping_and_mismatched_evidence(self):
        checked='2026-11-21T01:00:00Z';url='https://www.compuzone.co.kr/product/product_detail.htm?ProductNo=123'
        row=dict(id='fixture',productId='model',category='case',sourceKey='compuzone:123',url=url,seller='Fixture',spec='Black',price=100,shippingFee=0,checkedAt=checked,quantityOneVerified=True,quantityOneTotal=100,quantityVerifiedAt=checked,availability='unknown')
        models={'model':dict(category='case',subtype='pc-case',sources=[dict(url=url,kind='retailer-listing',observedAt=checked)])};now=parse_now('2026-11-21T12:00:00Z')
        self.assertEqual(validate_offers([row],models,now),{'fixture'})
        for change in [dict(quantityOneTotal=99),dict(shippingFee=None),dict(availability='in-stock'),dict(sourceKey='compuzone:999'),dict(checkedAt='2026-11-22T01:00:00Z'),dict(category='cooler')]:
            with self.assertRaises(ValueError):validate_offers([dict(row,**change)],models,now)
        changed=copy.deepcopy(models);changed['model']['sources'][0]['observedAt']='2026-11-21T02:00:00Z'
        with self.assertRaises(ValueError):validate_offers([row],changed,now)

if __name__=='__main__':unittest.main()
