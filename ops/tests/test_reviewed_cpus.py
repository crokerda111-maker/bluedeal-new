"""Review coverage and the publication boundary between observations and facts."""
import json
from pathlib import Path
import unittest

from ops.catalog.apply_reviewed_cpus import validate_offers
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import conditional_prices, parse_now

ROOT = Path(__file__).resolve().parents[2]


class ReviewedCpus(unittest.TestCase):
    def test_all_59_posts_have_one_review_and_alternatives_are_not_original_promotions(self):
        review = json.loads((ROOT / 'ops/catalog/cpu-review-2026-11-21.json').read_text(encoding='utf-8'))
        self.assertEqual(len(review['posts']), 59)
        self.assertEqual(len({p['post'] for p in review['posts']}), 59)
        self.assertEqual(sum(review['outcomes'].values()), 59)
        for post in review['posts']:
            self.assertFalse(post['originalPromotionVerified'])
            self.assertFalse(post['verifiedListingIds'] and post['alternativeListingIds'])
        epyc = next(p for p in review['posts'] if p['post'] == '1963279')
        self.assertIn('epyc-4585px', epyc['modelId'])
        self.assertNotIn('9950', epyc['modelId'])
        by_post = {p['post']: p for p in review['posts']}
        self.assertEqual(by_post['2003013']['outcome'], '원 판매처 접근·인증 제한')
        self.assertEqual(by_post['1999021']['outcome'], '원 판매조건 추가 확인 필요')

    def test_cpu_variants_and_unconfirmed_total_cost_do_not_collapse_into_prices(self):
        models = json.loads((ROOT / 'src/content/products/reviewed-cpus.json').read_text(encoding='utf-8'))
        prices = json.loads((ROOT / 'src/content/prices/cpu.json').read_text(encoding='utf-8'))['items']
        self.assertEqual(len({p['id'] for p in models}), len(models))
        listings = [s['id'] for p in models for s in p['listings']]
        self.assertEqual(set(listings), {p['id'] for p in prices})
        self.assertEqual(len(listings), len(set(listings)))
        k = next(p for p in models if p['id'].endswith('14600k-bulk-cynex'))
        kf = next(p for p in models if p['id'].endswith('14600kf-bulk-cynex'))
        self.assertNotEqual(k['id'], kf['id'])
        imported = next(p for p in models if '5500x3d' in p['id'])
        self.assertEqual(imported['listings'], [])
        self.assertTrue(any('관세' in note for note in imported['notes']))
        for p in prices:
            self.assertNotIn('kingdommol', p['id'])
            self.assertNotIn('4879891560', p['id'])

    def test_ssg_product_identity_accepts_context_but_rejects_tracking_and_ambiguous_ids(self):
        base = 'https://www.ssg.com/item/itemView.ssg?itemId=123'
        self.assertEqual(merchant_identity(base + '&siteNo=6004&salestrNo=6005'), ('ssg', '123'))
        for bad in [base + '&itemId=456', base + '&siteNo=', base + '&ckwhere=other', base.replace('www.ssg.com', 'ssg.com.example.com')]:
            with self.assertRaises(ValueError): merchant_identity(bad)

    def test_precise_promotion_deadlines_require_timezone_and_are_not_replaced_by_dates(self):
        quote = dict(instantPrice=90, instantNote='회원 조건', instantEndsAt='2026-11-28T04:00:00+09:00')
        self.assertEqual(conditional_prices(quote, 100)['instantEndsAt'], quote['instantEndsAt'])
        for bad in [dict(quote, instantEndsAt='2026-11-28T04:00:00'), dict(quote, instantEndsOn='2026-11-28'), dict(quote, instantEndsAt='2026-02-30T04:00:00+09:00'), dict(quote, instantStartsOn='2026-11-29')]:
            with self.assertRaises(ValueError): conditional_prices(bad, 100)

    def test_observed_offer_rejects_mismatched_source_and_future_observation(self):
        row = dict(id='fixture',productId='fixture-model',category='cpu',seller='Test seller',spec='Test option',url='https://www.ssg.com/item/itemView.ssg?itemId=123',sourceKey='ssg:123',price=100,shippingFee=0,checkedAt='2026-11-21T01:00:00Z')
        now = parse_now('2026-11-21T02:00:00Z')
        self.assertEqual(validate_offers([row], {'fixture-model': {}}, now), {'fixture'})
        for bad in [dict(row,sourceKey='ssg:456'), dict(row,checkedAt='2026-11-22T01:00:00Z')]:
            with self.assertRaises(ValueError): validate_offers([bad], {'fixture-model': {}}, now)


if __name__ == '__main__': unittest.main()
