import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'ops/collector'))
from build_prices import conditional_prices, normalize_url
from ops.hotdeals.inspect_post_links import extract


class ReviewedBoards(unittest.TestCase):
    def test_psu_posts_keep_wattage_color_and_collections_separate(self):
        data=json.loads((ROOT/'ops/catalog/psu-review-2026-11-21.json').read_text(encoding='utf-8'))
        ids=[p for g in data['groups'] for p in g['posts']]+[r['post'] for r in data['separateOffers']]
        self.assertEqual(len(ids),19);self.assertEqual(len(set(ids)),19)
        self.assertEqual(len(data['groups']),14);self.assertEqual(len(data['separateOffers']),3)

    def test_all_forty_posts_have_one_disposition_and_bundles_are_separate(self):
        data=json.loads((ROOT/'ops/catalog/motherboard-review-2026-11-21.json').read_text(encoding='utf-8'))
        ids=[p for g in data['groups'] for p in g['posts']]+[r['post'] for r in data['separateOffers']]
        self.assertEqual(len(ids),40);self.assertEqual(len(set(ids)),40)
        groups={g['id'] for g in data['groups']}
        for suffix in ['force','force-v2','elite-d4','elite-d4-gen5']:
            self.assertTrue(any(g.endswith(suffix) for g in groups))
        self.assertEqual(len(data['separateOffers']),3)

    def test_conditional_prices_require_conditions_and_valid_dates(self):
        for bad in [dict(cardPrice=90),dict(couponPrice=101,couponNote='조건'),dict(cardPrice=90,cardNote='조건',cardEndsOn='2026-02-30'),dict(cardPrice=90,cardNote='조건',cardRequiresCoupon=True)]:
            with self.assertRaises(ValueError): conditional_prices(bad,100)
        good=conditional_prices(dict(couponPrice=90,couponNote='쿠폰',cardPrice=80,cardNote='쿠폰+카드',cardRequiresCoupon=True),100)
        self.assertTrue(good['cardRequiresCoupon'])

    def test_public_store_host_is_narrow_and_does_not_allow_lookalikes(self):
        self.assertEqual(normalize_url('https://www.compuzone.co.kr/product/product_detail.htm?ProductNo=123')[1],'compuzone')
        with self.assertRaises(ValueError): normalize_url('https://compuzone.co.kr.example.com/product')

    def test_plain_purchase_urls_are_extracted_without_storing_body_or_author(self):
        html='<h1>Fixture</h1><table class="market-info-view-table"><tr><th>판매처</th><td>판매처</td></tr><tr><th>구매링크</th><td>https://item.gmarket.co.kr/Item?goodsCode=123</td></tr></table><div id="org_contents">쿠폰 SECRET_BODY</div><div>PRIVATE_AUTHOR</div>'
        row=extract(html,'https://quasarzone.com/bbs/qb_saleinfo/views/123')
        self.assertEqual(row['merchant_link_candidates'],['https://item.gmarket.co.kr/Item?goodsCode=123'])
        self.assertIn('쿠폰 언급',row['condition_flags'])
        self.assertNotIn('SECRET_BODY',json.dumps(row));self.assertNotIn('PRIVATE_AUTHOR',json.dumps(row))

    def test_official_http_11st_share_text_is_recovered_without_executing_js(self):
        html='<h1>Fixture</h1><table class="market-info-view-table"><tr><th>구매링크</th><td><a href="javascript:goToLink(\'NOT_EXECUTED\')">http://www.11st.co.kr/products/123/share</a></td></tr></table>'
        row=extract(html,'https://quasarzone.com/bbs/qb_saleinfo/views/123')
        self.assertEqual(row['merchant_link_candidates'],['https://www.11st.co.kr/products/123/share'])
        self.assertFalse(row['current_price_verified'])
        self.assertFalse(row['body_stored']);self.assertFalse(row['comments_stored'])

    def test_http_recovery_does_not_upgrade_lookalikes_credentials_or_other_routes(self):
        urls=['http://www.11st.co.kr.evil.invalid/products/123/share','http://user:secret@www.11st.co.kr/products/123/share','http://www.11st.co.kr:8080/products/123/share','http://www.11st.co.kr/orders/123','https://user:secret@www.11st.co.kr/products/123']
        html='<h1>Fixture</h1><table class="market-info-view-table"><tr><th>구매링크</th><td>'+' '.join(urls)+'</td></tr></table>'
        self.assertEqual(extract(html,'https://quasarzone.com/bbs/qb_saleinfo/views/123')['merchant_link_candidates'],[])


if __name__=='__main__': unittest.main()
