"""Cooling identity, complete source coverage and real unit quote guards."""
import copy
import json
from pathlib import Path
import unittest
from ops.catalog.apply_reviewed_cooling import validate_offers
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import parse_now
ROOT=Path(__file__).resolve().parents[2]
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))

class ReviewedCooling(unittest.TestCase):
    def test_all_posts_and_non_pc_items_are_separate(self):
        r=read('ops/catalog/cooling-review-2026-11-21.json')
        self.assertEqual(len({p['post'] for p in r['posts']}),26)
        self.assertEqual(sum(r['counts'].values()),26)
        self.assertEqual(sum(r['outcomes'].values()),26)
        self.assertEqual(sum(bool(p['verifiedListingIds']) for p in r['posts']),7)
        for p in r['posts']:
            self.assertFalse(p['originalPromotionVerified'])
            if p['disposition'] in ['PC 부품 아님','케이스 별도 분류']:self.assertEqual(p['modelIds']+p['verifiedListingIds'],[])

    def test_fan_and_liquid_models_are_distinct_and_unavailable_quotes_not_published(self):
        models=read('src/content/products/reviewed-cooling.json');items=read('src/content/prices/cooler.json')['items']
        self.assertEqual(len(models),9);self.assertEqual(len(items),7)
        self.assertEqual(sum(m['subtype']=='case-fan' for m in models),1)
        self.assertTrue(all(p['availability']=='unknown' for p in items))
        self.assertTrue(all(m['reviewSummary'] is None and m['issues']==[] for m in models))
        for token in ['deepcool-lm360','pa120-se-refurb']:self.assertFalse(any(token in p['id'] for p in items))
        quotes={p['name']:(p['price'],p['shippingFee']) for p in items}
        self.assertEqual(quotes['쿨러마스터 MasterLiquid PL360 FLUX 블랙'],(76000,2500))
        noctua=next(p for p in items if 'noctua' in p['id'])
        self.assertEqual((noctua['price'],noctua['couponPrice'],noctua['shippingFee']),(457700,447700,3000))
        self.assertNotIn('cardPrice',noctua);self.assertNotIn('couponEndsOn',noctua)

    def test_publisher_rejects_quantity_time_stock_shipping_and_source_drift(self):
        now=parse_now('2026-11-21T12:00:00Z');checked='2026-11-21T01:00:00Z'
        url='https://www.compuzone.co.kr/product/product_detail.htm?ProductNo=123&BigDivNo=&MediumDivNo=1020&DivNo=4582'
        row=dict(id='fixture',productId='model',category='cooler',sourceKey='compuzone:123',url=url,seller='Fixture',spec='Black 360',price=100,shippingFee=0,checkedAt=checked,quantityOneVerified=True,quantityOneTotal=100,quantityVerifiedAt=checked,availability='unknown')
        models={'model':{'subtype':'cpu-liquid-cooler','sources':[dict(url=url,kind='retailer-listing',observedAt=checked)]}}
        self.assertEqual(validate_offers([row],models,now),{'fixture'})
        for change in [dict(quantityOneTotal=99),dict(quantityOneVerified=False),dict(availability='out-of-stock'),dict(shippingFee=None),dict(checkedAt='2026-11-22T01:00:00Z'),dict(sourceKey='compuzone:999'),dict(checkedAt='2026-11-21T02:00:00Z',quantityVerifiedAt='2026-11-21T02:00:00Z')]:
            with self.assertRaises(ValueError):validate_offers([dict(row,**change)],models,now)
        changed=copy.deepcopy(models);changed['model']['subtype']='case'
        with self.assertRaises(ValueError):validate_offers([row],changed,now)

    def test_compuzone_navigation_parameters_do_not_allow_duplicate_ids_or_other_routes(self):
        good='https://www.compuzone.co.kr/product/product_detail.htm?ProductNo=123&BigDivNo=&MediumDivNo=1020&DivNo=4582'
        self.assertEqual(merchant_identity(good),('compuzone','123'))
        for bad in [good+'&ProductNo=456',good+'&tracking=1',good.replace('MediumDivNo=1020','MediumDivNo=abc'),good.replace('www.compuzone.co.kr','www.compuzone.co.kr.evil.invalid')]:
            with self.assertRaises(ValueError):merchant_identity(bad)

if __name__=='__main__':unittest.main()
