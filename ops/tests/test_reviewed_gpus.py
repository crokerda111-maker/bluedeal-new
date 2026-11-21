"""GPU variants, preserved sold-out records and verified quantity totals."""
import json
from pathlib import Path
import unittest

from ops.catalog.apply_reviewed_gpus import validate_offers
from ops.collector.build_prices import parse_now, availability_fields
from ops.catalog.store import merchant_identity

ROOT=Path(__file__).resolve().parents[2]
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))


class ReviewedGpus(unittest.TestCase):
    def test_refurbished_condition_and_merchant_identity_cannot_be_dropped(self):
        from ops.collector.build_prices import product_attributes
        self.assertNotIn('condition',product_attributes({},'gpu'))
        self.assertEqual(product_attributes({'condition':'refurbished'},'gpu')['condition'],'refurbished')
        for value in ['new','used-guessed','REFURBISHED']:
            with self.assertRaises(ValueError):product_attributes({'condition':value},'gpu')
        good='https://www.redbitmall.com/goods/goods_view.php?goodsNo=1000001190'
        self.assertEqual(merchant_identity(good),('redbitmall','1000001190'))
        for bad in [good+'&goodsNo=2',good+'&tracking=1',good.replace('www.redbitmall.com','www.redbitmall.com.evil.invalid'),good+'#qna']:
            with self.assertRaises(ValueError):merchant_identity(bad)
        row=dict(id='fixture',productId='model',category='gpu',sourceKey='redbitmall:1000001190',url=good,seller='Fixture',spec='refurbished AS3months',price=100,shippingFee=0,checkedAt='2026-11-20T01:00:00Z',quantityOneVerified=True,quantityOneTotal=100,quantityVerifiedAt='2026-11-21T01:00:00Z',availability='unknown',condition='refurbished')
        self.assertEqual(validate_offers([row],{'model':{}},{},parse_now(None)),{'fixture'})
        bad=dict(row);bad.pop('condition')
        with self.assertRaises(ValueError):validate_offers([bad],{'model':{}},{},parse_now(None))

    def test_all_posts_have_review_and_non_gpu_or_event_prices_are_excluded(self):
        review=read('ops/catalog/gpu-review-2026-11-21.json')
        self.assertEqual(len(review['posts']),138)
        self.assertEqual(len({p['post'] for p in review['posts']}),138)
        self.assertEqual(sum(review['counts'].values()),138)
        self.assertEqual(sum(review['outcomes'].values()),138)
        for p in review['posts']:
            self.assertFalse(p['originalPromotionVerified'])
            self.assertFalse(p['verifiedListingIds'] and p['alternativeListingIds'])
            if p['disposition'] not in ['단일 GPU 후보','여러 모델·색상 모음','리퍼·벌크 별도 조건']:
                self.assertEqual(p['modelIds'],[])
                self.assertEqual(p['verifiedListingIds'],[])
        by_post={p['post']:p for p in review['posts']}
        self.assertEqual(by_post['1984033']['modelIds'],[])
        self.assertEqual(by_post['1966111']['disposition'],'PC·노트북 별도 분류')

    def test_three_sold_out_prices_keep_their_original_amounts_timestamps_and_links(self):
        review=read('ops/catalog/gpu-review-2026-11-21.json')
        prices={p['id']:p for p in read('src/content/prices/gpu.json')['items']}
        self.assertEqual(len(prices),31)
        self.assertEqual(sum(p['availability']=='out-of-stock' for p in prices.values()),3)
        for old in review['retainedHistory']:
            item=prices[old['id']]
            for field in ['price','checkedAt','goCode']:self.assertEqual(item[field],old[field])
            self.assertEqual(item['availability'],'out-of-stock')
            self.assertEqual(parse_now(item['availabilityCheckedAt']),parse_now(old['stockObservedAt']))
            self.assertIn('이전 관측 기록',item['priceNote'])

    def test_variant_and_vram_separation_matches_all_price_records(self):
        models=read('src/content/products/reviewed-gpus.json');prices=read('src/content/prices/gpu.json')['items']
        listings=[p['id'] for m in models for p in m['listings']]
        self.assertEqual(len(set(listings)),len(listings))
        self.assertEqual(set(listings),{p['id'] for p in prices})
        self.assertEqual(sum(p['availability']!='out-of-stock' and p.get('condition')!='refurbished' for p in prices),26)
        self.assertTrue(all(p.get('capacityGB') in [8,12,16,32] for p in prices if p.get('condition')!='refurbished'))
        refurb=[p for p in prices if p.get('condition')=='refurbished']
        self.assertEqual(len(refurb),2)
        self.assertTrue(all('AS3개월' in p['name'] and 'capacityGB' not in p for p in refurb))
        core=next(m for m in models if 'rtx5080-solid-core' in m['id'])
        ordinary=next(m for m in models if 'rtx5080-solid-oc' in m['id'])
        self.assertNotEqual(core['id'],ordinary['id'])
        duo8=next(m for m in models if 'rtx5060ti-gaming-duo-8gb' in m['id'])
        duo16=next(m for m in models if m['id']=='curated-colorful-rtx-5060-ti-gaming-duo-16gb')
        self.assertNotEqual(duo8['id'],duo16['id'])

    def test_coupon_and_card_combinations_use_each_actual_coupon_deadline(self):
        prices=read('src/content/prices/gpu.json')['items']
        pny=next(p for p in prices if 'pny-rtx5080-oc-triple' in p['id'])
        asus=next(p for p in prices if 'gmarket-4839366018' in p['id'])
        msi=next(p for p in prices if p['id']=='msi-rtx-5060-shadow-2x-oc-8gb')
        self.assertEqual((pny['price'],pny['couponPrice'],pny['cardPrice']),(4508550,3651910,3451910))
        for item,end in [(pny,'2026-11-24'),(asus,'2026-11-25'),(msi,'2026-11-29')]:
            self.assertEqual(item['couponEndsOn'],end)
            self.assertEqual(item['cardEndsOn'],end)
            self.assertTrue(item['cardRequiresCoupon'])
            self.assertIn('발급 당일',item['couponNote'])

    def test_publisher_rejects_quantity_mismatch_and_refreshed_historical_prices(self):
        row=dict(id='fixture',productId='model',category='gpu',sourceKey='gmarket:123',url='https://item.gmarket.co.kr/Item?goodsCode=123',seller='Fixture',spec='8GB',price=100,shippingFee=0,checkedAt='2026-11-20T01:00:00Z',quantityOneVerified=True,quantityOneTotal=100,quantityVerifiedAt='2026-11-21T01:00:00Z',availability='unknown')
        now=parse_now('2026-11-21T02:00:00Z')
        self.assertEqual(validate_offers([row],{'model':{}},{},now),{'fixture'})
        for change in [dict(quantityOneTotal=99),dict(quantityOneVerified=False),dict(quantityVerifiedAt='2026-11-19T01:00:00Z'),dict(availability='in-stock')]:
            with self.assertRaises(ValueError):validate_offers([dict(row,**change)],{'model':{}},{},now)
        history={'fixture':dict(id='fixture',price=100,checkedAt=row['checkedAt'],sourceKey=row['sourceKey'],goCode='fixture-code',stockObservedAt='2026-11-21T01:00:00Z')}
        past=dict(row,retainedHistory=True,availability='out-of-stock',goCode='fixture-code',availabilityCheckedAt=history['fixture']['stockObservedAt'])
        self.assertEqual(validate_offers([past],{'model':{}},history,now),{'fixture'})
        for change in [dict(price=99),dict(checkedAt='2026-11-21T01:00:00Z'),dict(goCode='changed'),dict(availabilityCheckedAt=row['checkedAt'])]:
            with self.assertRaises(ValueError):validate_offers([dict(past,**change)],{'model':{}},history,now)

    def test_stock_observation_date_is_optional_but_never_inferred_or_future(self):
        now=parse_now('2026-11-21T02:00:00Z')
        self.assertEqual(availability_fields({},now),{})
        self.assertEqual(availability_fields({'availabilityCheckedAt':'2026-11-21T10:00:00+09:00'},now),{'availabilityCheckedAt':'2026-11-21T01:00:00Z'})
        for bad in ['2026-11-21T03:00:00Z','2026-11-21T01:00:00','not-a-date']:
            with self.assertRaises(ValueError):availability_fields({'availabilityCheckedAt':bad},now)


if __name__=='__main__':unittest.main()
