"""Current tuple totals and unavailable base choices must remain distinct."""
import copy,json,unittest
from pathlib import Path
from ops.catalog.apply_reviewed_systems import validate_offers
from ops.collector.build_prices import parse_now
R=Path(__file__).resolve().parents[2]
read=lambda p:json.loads((R/p).read_text(encoding='utf-8'))

class PcSelectedOptions(unittest.TestCase):
    def test_every_new_price_belongs_to_its_observed_selected_tuple(self):
        review=read('ops/catalog/pc-option-review-2026-11-21.json');checks=review['checks']
        self.assertEqual((len(checks),review['verifiedQuotes'],review['defaultOptionUnavailable'],review['selectionFields']),(16,13,3,51))
        items={r['id']:r for r in read('src/content/prices/fullpc.json')['items']}
        outbound=read('src/content/outbound.generated.json')
        expected={'3951478263':3723290,'4428358112':5744430,'4577261087':5637820,'4463680822':3616480,'4427752068':3498930,'4355054602':3085000,'4432429738':3375530,'4685925482':2456380,'4427748101':2288000,'4638008638':3616960,'4366263439':5659230,'4890427920':5769120,'4895851667':2835000}
        seen=set()
        for check in checks:
            if not check['verifiedListingIds']:continue
            self.assertEqual(len(check['verifiedListingIds']),1)
            item=items[check['verifiedListingIds'][0]];code=check['source'].split('goodscode=')[1]
            self.assertEqual((item['price'],item['shippingFee'],item['availability']),(expected[code],0,'unknown'))
            self.assertEqual(outbound[item['goCode']]['originalUrl'],check['source'])
            self.assertIn('추가 확인',item['cardNote'])
            for choice in check['selectedOptions']:self.assertIn(choice['field']+': '+choice['value'],item['spec'])
            self.assertNotRegex(item['spec'],r'\b\d+_')
            seen.add(code)
        self.assertEqual(seen,set(expected))
        gre=next(i for i in items.values() if i['id'].endswith('4638008638-offer'))
        self.assertIn('GRE 12GB',gre['name']);self.assertNotIn('RX9070XT',gre['name'])
        sud=next(i for i in items.values() if i['id'].endswith('4895851667-offer'))
        self.assertIn('7800X3D',sud['name']);self.assertIn('5060 Ti',sud['name']);self.assertNotIn('32GB',sud['name'])

    def test_unavailable_defaults_do_not_turn_header_prices_into_quotes(self):
        review=read('ops/catalog/pc-option-review-2026-11-21.json')
        products={m['id']:m for m in read('src/content/products/catalog.json')['products']}
        unavailable=[c for c in review['checks'] if c['status']=='default-option-out-of-stock']
        self.assertEqual(len(unavailable),3)
        for check in unavailable:
            m=products[check['productId']]
            self.assertEqual(m['listings'],[]);self.assertEqual(m['lifecycle'],'unknown')
            self.assertIn('품절',check['blockedChoice'])
            self.assertTrue(any('품절' in s['value'] for s in m['specifications']))

    def test_missing_or_ambiguous_selection_evidence_is_rejected(self):
        at='2026-11-21T01:00:00Z';url='https://item.gmarket.co.kr/Item?goodscode=123'
        row=dict(id='fixture',productId='model',category='fullpc',sourceKey='gmarket:123',url=url,seller='Fixture',spec='RAM 변경없음',price=100,shippingFee=0,checkedAt=at,quantityOneVerified=True,quantityOneTotal=100,quantityTotalKind='ordinary',quantityVerifiedAt=at,availability='unknown',optionSelectionVerified=True,selectedOptions=[dict(field='RAM',value='변경없음')])
        models={'model':dict(category='fullpc',sources=[dict(url=url,kind='retailer-listing',observedAt=at)])};now=parse_now('2026-11-21T12:00:00Z')
        self.assertEqual(validate_offers([row],models,now),{'fixture'})
        for change in [dict(optionSelectionVerified=False),dict(selectedOptions=[]),dict(selectedOptions=[{}]),dict(selectedOptions=[dict(field='RAM',value='')]),dict(selectedOptions=[*row['selectedOptions'],*row['selectedOptions']])]:
            with self.assertRaises(ValueError):validate_offers([dict(row,**change)],models,now)

if __name__=='__main__':unittest.main()
