"""Official model columns never become inferred retailer prices or package units."""
import json,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[2]
read=lambda p:json.loads((R/p).read_text(encoding='utf-8'))

class ReviewedHdds(unittest.TestCase):
    def test_exact_pdf_columns_and_manufacturer_scope(self):
        models=read('src/content/products/reviewed-hdds.json')
        self.assertEqual(len(models),2)
        bycode={m['manufacturerPartNumber']:m for m in models}
        for code,capacity,rpm,cache,speed in [('WD40EZZX','4TB','5,400rpm','128MB','180MB/s'),('WD80EAAZ','8TB','5,640rpm','256MB','215MB/s')]:
            m=bycode[code];spec={v['label']:v['value'] for v in m['specifications']}
            self.assertEqual((spec['제조사 표기 용량'],spec['회전 속도'],spec['캐시'],spec['제조사 내부 전송 속도 최대']),(capacity,rpm,cache,speed))
            self.assertEqual(spec['기록 방식'],'CMR')
            self.assertEqual((m['category'],m['domesticState'],m['lifecycle'],m['listings']),('hdd','unverified','unknown',[]))
            self.assertEqual(m['sources'][0]['kind'],'manufacturer-datasheet')
            self.assertTrue(m['sources'][0]['url'].startswith('https://documents.westerndigital.com/'))
            self.assertIn('지역별 조건',spec['제조사 제한적 보증 표기'])

    def test_mixed_nas_and_four_drive_pack_do_not_invent_a_single_hdd(self):
        review=read('ops/catalog/hdd-review-2026-11-21.json')
        posts={p['post']:p for p in review['posts']}
        self.assertEqual(len(posts),4)
        self.assertEqual(posts['2002185']['modelIds'],[])
        self.assertEqual(posts['1969676']['modelIds'],[])
        self.assertTrue(all(not p['verifiedListingIds'] for p in posts.values()))
        self.assertEqual(read('src/content/prices/hdd.json')['items'],[])
        self.assertEqual(sum(p['merchantChecks'][0]['status']=='previous-access-restriction-not-retried' for p in posts.values()),3)

    def test_displayed_bom_rows_have_distinct_labels_and_ram_followup_is_linked(self):
        mixed=read('src/content/products/reviewed-mixed.json')
        for m in mixed:
            labels=[s['label'] for s in m['specifications']]
            self.assertEqual(len(labels),len(set(labels)))
        ram=next(p for p in read('ops/catalog/ram-review-2026-11-21.json')['posts'] if p['post']=='1996984')
        self.assertEqual(ram['verifiedListingIds'],['reviewed-mixed-ram-11st-8209876314-offer'])
        self.assertIn('후속',ram['reason'])

if __name__=='__main__':unittest.main()
