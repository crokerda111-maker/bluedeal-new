"""Keep incomplete BOMs and conditional payment totals out of ordinary-price facts."""
import json
from pathlib import Path
import unittest
from ops.catalog.apply_reviewed_systems import validate_offers
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import parse_now
ROOT=Path(__file__).resolve().parents[2]
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))

class ReviewedSystems(unittest.TestCase):
    def test_incomplete_scope_and_unknown_bom_remain_explicit(self):
        r=read('ops/catalog/systems-review-2026-11-21.json')
        self.assertEqual(r['totalCandidatePosts'],dict(halfpc=8,fullpc=101))
        for category in ['halfpc','fullpc']:
            reviewed=sum(p['category']==category for p in r['posts'])
            self.assertEqual(r['reviewedPosts'][category],reviewed)
            self.assertEqual(r['remainingPosts'][category],r['totalCandidatePosts'][category]-reviewed)
        models=read('src/content/products/reviewed-systems.json')
        self.assertTrue(models)
        self.assertTrue(all(m['strengths']==[] and m['issues']==[] and m['reviewSummary'] is None for m in models))
        self.assertTrue(all(any(s['label']=='정확한 전체 부품 목록(BOM)' and s['value']=='추가 확인 필요' for s in m['specifications']) for m in models))
        self.assertTrue(all(not m['listings'] for m in models if m['category']=='halfpc'))
        self.assertFalse(any('0067428712' in m['id'] for m in models))
        for post in r['posts']:
            if any(c['status']=='model-identity-insufficient' for c in post['merchantChecks']):self.assertEqual(post['modelIds']+post['verifiedListingIds'],[])

    def test_price_types_and_shipping_are_not_inferred_from_benefit_labels(self):
        items=read('src/content/prices/fullpc.json')['items']
        actual={p['id']:(p['price'],p['shippingFee']) for p in items if p['source']=='G마켓'}
        self.assertEqual(actual,{'reviewed-fullpc-gmarket-4805310267-offer':(3765850,0),'reviewed-fullpc-gmarket-4864796475-offer':(1614340,0),'reviewed-fullpc-gmarket-4653902503-offer':(5956750,0),'reviewed-fullpc-gmarket-4653892370-offer':(2392600,0)})
        lotte=[r for r in items if r['source']=='롯데온']
        self.assertEqual({(r['price'],r['cardPrice']) for r in lotte},{(2040000,1717530),(2269000,2105520)})
        self.assertTrue(all('couponPrice' not in r and 'instantPrice' not in r for r in lotte))
        self.assertTrue(all('조건' in r['cardNote'] and '기간' in r['cardNote'] for r in lotte))
        ordinary=next(r for r in items if r['source']=='오늘의집')
        self.assertEqual((ordinary['price'],ordinary['shippingFee']),(2399000,0))
        self.assertIn('제주20,000원',ordinary['shippingNote'])
        self.assertTrue(all(r['availability']=='unknown' for r in items))

    def test_conditional_unit_total_must_match_its_own_kind_and_source(self):
        checked='2026-11-21T01:00:00Z';url='https://www.lotteon.com/p/product/LO123'
        row=dict(id='fixture',productId='model',category='fullpc',sourceKey='lotteon:LO123',url=url,seller='Fixture',spec='Exact configuration',price=100,cardPrice=90,cardNote='조건·기간 미확인',shippingFee=0,checkedAt=checked,quantityOneVerified=True,quantityOneTotal=90,quantityTotalKind='card',quantityVerifiedAt=checked,availability='unknown')
        models={'model':dict(category='fullpc',sources=[dict(url=url,kind='retailer-listing',observedAt=checked)])};now=parse_now('2026-11-21T12:00:00Z')
        self.assertEqual(validate_offers([row],models,now),{'fixture'})
        for change in [dict(quantityTotalKind='ordinary'),dict(quantityOneTotal=89),dict(quantityOneVerified=False),dict(cardNote=''),dict(shippingFee=None),dict(sourceKey='lotteon:LO999'),dict(cardRequiresCoupon=True)]:
            with self.assertRaises(ValueError):validate_offers([dict(row,**change)],models,now)

    def test_ohou_identity_rejects_deceptive_domains_other_routes_or_tracking(self):
        good='https://store.ohou.se/goods/4100098'
        self.assertEqual(merchant_identity(good),('ohou','4100098'))
        for bad in [good+'?token=x',good.replace('store.ohou.se','store.ohou.se.evil.invalid'),good.replace('/goods/','/orders/'),good.replace('4100098','abc')]:
            with self.assertRaises(ValueError):merchant_identity(bad)

if __name__=='__main__':unittest.main()
