"""Storage classification, variant drift and conditional offer boundary."""
import json
from pathlib import Path
import unittest

from ops.catalog.apply_reviewed_ssds import validate_offers
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import parse_now

ROOT=Path(__file__).resolve().parents[2]
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))


class ReviewedSsds(unittest.TestCase):
    def test_all_posts_keep_ssd_accessory_and_hdd_nas_distinct(self):
        data=read('ops/catalog/ssd-review-2026-11-21.json')
        self.assertEqual(len(data['posts']),65)
        self.assertEqual(len({p['post'] for p in data['posts']}),65)
        self.assertEqual(sorted(data['counts'].values()),[4,17,44])
        self.assertEqual(sum(data['outcomes'].values()),65)
        for post in data['posts']:
            self.assertFalse(post['originalPromotionVerified'])
            self.assertFalse(post['verifiedListingIds'] and post['alternativeListingIds'])
            if post['disposition']!='내장·외장 SSD 후보':
                self.assertEqual(post['modelIds'],[])
                self.assertEqual(post['verifiedListingIds'],[])

    def test_imported_capacity_drift_and_ended_prices_do_not_become_offers(self):
        models=read('src/content/products/reviewed-ssds.json')
        prices=read('src/content/prices/ssd.json')['items']
        self.assertEqual(len(prices),7)
        self.assertEqual({r['id'] for r in prices},{s['id'] for p in models for s in p['listings']})
        for token in ['lexar-nm710-500gb','tipro9000','crucial-t500','sandisk-ssd-plus','seagate-game-drive-external']:
            model=next(p for p in models if token in p['id'])
            self.assertEqual(model['listings'],[])
        lexar=next(p for p in models if 'lexar-nm710' in p['id'])
        self.assertIn('500GB',lexar['name'])
        self.assertIn('512GB',str(lexar['notes']))
        pro=next(p for p in prices if 'exceria-pro-g2' in p['id'])
        self.assertNotIn('capacityGB',pro)
        self.assertEqual(pro['ssdDram'],'unknown')

    def test_coupon_combination_does_not_outlive_the_earlier_coupon(self):
        prices=read('src/content/prices/ssd.json')['items']
        gm=next(p for p in prices if 'gm9000' in p['id'])
        self.assertEqual((gm['price'],gm['couponPrice'],gm['cardPrice']),(721690,577340,525380))
        self.assertEqual((gm['couponEndsOn'],gm['cardEndsOn']),('2026-11-24','2026-11-24'))
        self.assertTrue(gm['cardRequiresCoupon'])
        self.assertIn('발급 당일',gm['couponNote'])
        self.assertEqual(gm['ssdDram'],'unknown')
        sam=next(p for p in prices if '9100-pro' in p['id'])
        self.assertEqual(sam['ssdDram'],'present')
        self.assertNotIn('cardEndsOn',sam)

    def test_icoda_identity_and_observation_validation_reject_drift(self):
        url='https://usr.icoda.co.kr/item/view/1601142'
        self.assertEqual(merchant_identity(url),('icoda','1601142'))
        for bad in [url+'?tracking=1',url.replace('usr.icoda.co.kr','usr.icoda.co.kr.evil.invalid'),url.replace('/item/view/','/item/other/')]:
            with self.assertRaises(ValueError):merchant_identity(bad)
        row=dict(id='fixture',productId='model',sourceKey='icoda:1601142',category='ssd',url=url,seller='Fixture',spec='2TB',price=100,shippingFee=0,checkedAt='2026-11-21T01:00:00Z',ssdDram='unknown')
        now=parse_now('2026-11-21T02:00:00Z')
        self.assertEqual(validate_offers([row],{'model':{}},now),{'fixture'})
        for change in [dict(sourceKey='icoda:123'),dict(productId='other'),dict(checkedAt='2026-11-22T01:00:00Z'),dict(ssdDram='assumed')]:
            with self.assertRaises(ValueError):validate_offers([dict(row,**change)],{'model':{}},now)


if __name__=='__main__':unittest.main()
