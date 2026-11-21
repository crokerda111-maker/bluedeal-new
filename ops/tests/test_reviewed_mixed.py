"""Protect package identity and current quote types after mixed-post review."""
import copy,json,unittest
from pathlib import Path
from ops.catalog.apply_reviewed_systems import validate_offers
from ops.collector.build_prices import parse_now
R=Path(__file__).resolve().parents[2]
read=lambda p:json.loads((R/p).read_text(encoding='utf-8'))

class ReviewedMixed(unittest.TestCase):
    def test_packages_stay_separate_and_sold_out_totals_are_not_prices(self):
        r=read('ops/catalog/mixed-review-2026-11-21.json');models=r['models']
        self.assertEqual(len(r['posts']),31)
        self.assertEqual(len({p['post'] for p in r['posts']}),31)
        packages=[m for m in models if m['category']=='bundle']
        self.assertEqual(len(packages),2)
        self.assertTrue(all(not m['listings'] for m in packages))
        self.assertEqual(read('src/content/prices/bundle.json')['items'],[])
        for post in r['posts']:
            if post['category']=='bundle':
                self.assertEqual(post['merchantChecks'][0]['status'],'out-of-stock')
                self.assertEqual(post['verifiedListingIds'],[])
        for m in models:
            self.assertEqual((m['strengths'],m['issues'],m['reviewSummary']),([],[],None))
        excluded=[p for p in r['posts'] if p['post'] in ('1979515','1984600','1971958','1998486','1991624')]
        self.assertEqual(len(excluded),5)
        self.assertTrue(all(not p['modelIds'] and not p['verifiedListingIds'] for p in excluded))

    def test_current_composition_and_typed_coupon_totals_are_kept(self):
        models={m['id']:m for m in read('src/content/products/reviewed-mixed.json')}
        followup={id for c in read('ops/catalog/pc-option-review-2026-11-21.json')['checks'] for id in c['verifiedListingIds']}
        offers=[p for cat in ('fullpc','ram') for p in read('src/content/prices/'+cat+'.json')['items'] if p['id'].startswith('reviewed-mixed-') and p['id'] not in followup]
        self.assertEqual(len(offers),5)
        byid={p['id']:p for p in offers}
        r=byid['reviewed-mixed-fullpc-gmarket-4840266488-offer']
        self.assertEqual((r['price'],r['shippingFee']),(19343620,0))
        self.assertIn('9950X3D2',r['name']);self.assertIn('5090',r['name'])
        expected={'8564658171':(2146980,2061110),'8271959297':(3303060,3170940),'8221231651':(3522090,3381210)}
        for source,(price,coupon) in expected.items():
            row=byid['reviewed-mixed-fullpc-11st-'+source+'-offer']
            self.assertEqual((row['price'],row['couponPrice'],row['shippingFee']),(price,coupon,0))
            self.assertIn('기간',row['couponNote']);self.assertIn('미확인',row['priceNote'])
            self.assertNotIn('couponEndsOn',row)
        self.assertIn('16GB+16GB',byid['reviewed-mixed-fullpc-11st-8564658171-offer']['name'])
        self.assertIn('14700K',byid['reviewed-mixed-fullpc-11st-8271959297-offer']['name'])
        ram=byid['reviewed-mixed-ram-11st-8209876314-offer']
        self.assertEqual((ram['price'],ram['shippingFee'],ram['capacityGB'],ram['moduleCapacityGB'],ram['moduleCount']),(886000,2500,32,16,2))
        self.assertIn('CL30',ram['name']);self.assertIn('화이트',ram['name'])
        self.assertEqual(len(models),18)

    def test_package_price_cannot_pass_pc_quote_validation(self):
        at='2026-11-21T01:00:00Z';url='https://www.11st.co.kr/products/123'
        row=dict(id='fixture',productId='model',category='fullpc',sourceKey='11st:123',url=url,seller='Fixture',spec='Explicit configuration',price=100,shippingFee=0,checkedAt=at,quantityOneVerified=True,quantityOneTotal=100,quantityTotalKind='ordinary',quantityVerifiedAt=at,availability='unknown')
        model=dict(category='fullpc',sources=[dict(url=url,kind='retailer-listing',observedAt=at)])
        self.assertEqual(validate_offers([row],{'model':model},parse_now('2026-11-21T12:00:00Z')),{'fixture'})
        for change in [dict(category='bundle'),dict(quantityOneTotal=99),dict(shippingFee=None)]:
            with self.assertRaises(ValueError):validate_offers([dict(row,**change)],{'model':model},parse_now('2026-11-21T12:00:00Z'))
        model=copy.deepcopy(model);model['category']='bundle'
        with self.assertRaises(ValueError):validate_offers([dict(row,category='bundle')],{'model':model},parse_now('2026-11-21T12:00:00Z'),categories=('fullpc','ram'))

if __name__=='__main__':unittest.main()
