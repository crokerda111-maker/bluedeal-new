"""RAM variant separation, post coverage and offer publication boundary."""
import json
from pathlib import Path
import unittest

from ops.catalog.apply_reviewed_ram import validate_offers
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import parse_now

ROOT=Path(__file__).resolve().parents[2]
read=lambda path: json.loads((ROOT/path).read_text(encoding='utf-8'))


class ReviewedRam(unittest.TestCase):
    def test_posts_keep_original_and_alternative_sales_separate(self):
        review=read('ops/catalog/ram-review-2026-11-21.json')
        self.assertEqual(len(review['posts']),67)
        self.assertEqual(len({p['post'] for p in review['posts']}),67)
        self.assertEqual(sum(review['outcomes'].values()),67)
        for p in review['posts']:
            self.assertFalse(p['originalPromotionVerified'])
            self.assertFalse(p['verifiedListingIds'] and p['alternativeListingIds'])
        posts={p['post']:p for p in review['posts']}
        self.assertEqual(posts['1986346']['modelIds'],[])
        self.assertEqual(posts['1986448']['verifiedListingIds'],[])
        self.assertEqual(posts['1988074']['modelIds'],[])
        self.assertNotEqual(posts['2002648']['modelIds'],posts['1998371']['modelIds'])
        self.assertNotEqual(posts['1981325']['modelIds'],posts['1999874']['modelIds'])

    def test_exact_model_claims_and_unknown_module_count(self):
        models=read('src/content/products/reviewed-ram.json')
        prices=read('src/content/prices/ram.json')['items']
        claimed=[s['id'] for m in models for s in m['listings']]
        self.assertEqual(len(claimed),37)
        self.assertEqual(len(set(claimed)),37)
        supplemental=read('src/content/products/reviewed-mixed.json')
        mixed_claimed={s['id'] for m in supplemental if m['category']=='ram' for s in m['listings']}
        self.assertEqual(set(claimed)|mixed_claimed,{p['id'] for p in prices})
        for token in ['samsung-ddr5-5600-24gb-retailer','agi-ud238-5600-cl46-32gb-retailer']:
            row=next(p for p in prices if token in p['id'])
            self.assertNotIn('moduleCount',row)
            self.assertNotIn('moduleCapacityGB',row)
        single=next(p for p in prices if 'single-32gb' in p['id'])
        self.assertEqual((single['capacityGB'],single['moduleCapacityGB'],single['moduleCount']),(32,32,1))
        rgb=next(m for m in models if m['manufacturerPartNumber']=='KF560C30BBEAK2-32')
        self.assertIn('4800',str(rgb['specifications']))
        self.assertIn('6000',str(rgb['specifications']))
        self.assertTrue(any(s['kind']=='manufacturer-datasheet' for s in rgb['sources']))

    def test_ended_promotions_and_conditional_prices(self):
        models=read('src/content/products/reviewed-ram.json')
        for token in ['kingbank-krxb','white-amd-6000-cl30','urbane-v-rgb-white-6000-cl28','hx100-silver']:
            self.assertEqual(next(m for m in models if token in m['id'])['listings'],[])
        prices=read('src/content/prices/ram.json')['items']
        dw=next(p for p in prices if p['id']=='biwin-dw100-rgb-black-6000-cl28-48gb-11st')
        self.assertEqual((dw['price'],dw['couponPrice']),(1273680,1210000))
        lotte=next(p for p in prices if 'LO2251046520' in p['id'])
        self.assertEqual((lotte['price'],lotte['couponPrice'],lotte['cardPrice']),(910000,819000,761670))
        self.assertTrue(lotte['cardRequiresCoupon'])
        self.assertNotIn('cardEndsOn',lotte)

    def test_lotteon_identity_rejects_other_routes_and_tracking(self):
        good='https://www.lotteon.com/p/product/LO2251046520'
        self.assertEqual(merchant_identity(good),('lotteon','LO2251046520'))
        for bad in [good+'?coupon=1',good.replace('/p/','/m/'),good.replace('LO2251046520','LO'),good.replace('www.lotteon.com','www.lotteon.com.evil.invalid')]:
            with self.assertRaises(ValueError):merchant_identity(bad)

    def test_rejects_model_source_time_and_module_drift(self):
        row=dict(id='fixture',sourceKey='lotteon:LO123',productId='model',category='ram',seller='Fixture',spec='16GB×2',url='https://www.lotteon.com/p/product/LO123',price=100,shippingFee=0,checkedAt='2026-11-21T01:00:00Z',capacityGB=32,moduleCapacityGB=16,moduleCount=2,memoryType='DDR5')
        now=parse_now('2026-11-21T02:00:00Z')
        self.assertEqual(validate_offers([row],{'model':{}},now),{'fixture'})
        for change in [dict(sourceKey='lotteon:LO456'),dict(productId='other'),dict(checkedAt='2026-11-22T01:00:00Z'),dict(moduleCount=1)]:
            with self.assertRaises(ValueError):validate_offers([dict(row,**change)],{'model':{}},now)
        with self.assertRaises(ValueError):validate_offers([row,dict(row)],{'model':{}},now)


if __name__=='__main__':unittest.main()
