"""Protect selected configurations and conditional totals from misleading prices."""
import json,unittest
from datetime import datetime
from pathlib import Path
R=Path(__file__).resolve().parents[2]
read=lambda p:json.loads((R/p).read_text(encoding='utf-8'))

class HalfPcFollowup(unittest.TestCase):
    def test_selected_parts_and_conditional_totals_stay_bound_to_the_listing(self):
        review=read('ops/catalog/halfpc-option-review-2026-11-22.json')
        products={p['id']:p for p in read('src/content/products/catalog.json')['products']}
        items={p['id']:p for p in read('src/content/prices/halfpc.json')['items']}
        outbound=read('src/content/outbound.generated.json')
        self.assertEqual((len(review['checks']),len(items)),(5,4))
        for check in review['checks']:
            model=products[check['productId']]
            self.assertEqual(model['category'],'halfpc')
            self.assertEqual((model['strengths'],model['issues'],model['reviewSummary']),([],[],None))
            if not check['verifiedListingIds']:
                self.assertEqual(model['listings'],[])
                continue
            item=items[check['verifiedListingIds'][0]]
            self.assertEqual(outbound[item['goCode']]['originalUrl'],check['source'])
            self.assertEqual(datetime.fromisoformat(item['checkedAt']),datetime.fromisoformat(check['observedAt']))
            self.assertEqual((item['shippingFee'],item['availability']),(0,'unknown'))
            self.assertTrue(any(s['url']==check['source'] and s['observedAt']==check['observedAt'] and s['kind']=='retailer-listing' for s in model['sources']))
            if 'selectedOptions' in check:
                self.assertEqual(len(check['selectedOptions']),5)
                for choice in check['selectedOptions']:self.assertIn(choice['field']+': '+choice['value'],item['spec'])
                self.assertIn('프리도스',item['spec'])
                self.assertEqual(item['price']-item['cardPrice'],10000)
                self.assertIn('30만원 이상',item['cardNote'])
                self.assertIn('~11/30',item['cardNote'])
                self.assertNotIn('cardEndsAt',item)
            else:
                self.assertFalse(check['optionalAddonsSelected'])
                self.assertFalse(check['couponConditionsVerified'])
                self.assertEqual((item['price'],item['couponPrice']),(2003780,1923630))
                self.assertEqual(item['price']-item['couponPrice'],check['couponAmount'])
                self.assertIn('조건',item['couponNote'])
                self.assertNotIn('cardPrice',item)

    def test_same_title_does_not_merge_different_cases_or_unverified_headlines(self):
        models={p['id']:p for p in read('src/content/products/catalog.json')['products']}
        black=models['reviewed-halfpc-gmarket-4653763736']
        white=models['reviewed-halfpc-gmarket-4653764404']
        self.assertNotEqual(black['id'],white['id'])
        specs=lambda m:' '.join(s['value'] for s in m['specifications'])
        self.assertIn('DAVEN D7',specs(black));self.assertIn('DLX21',specs(white))
        self.assertIn('킹뱅크',specs(black));self.assertIn('PNY',specs(white))
        kream=models['reviewed-halfpc-kream-1109437']
        self.assertEqual(kream['listings'],[])
        self.assertTrue(any('최대 혜택가' in n and '등록하지' in n for n in kream['notes']))

if __name__=='__main__':unittest.main()
