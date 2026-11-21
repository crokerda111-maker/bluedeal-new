import json
from pathlib import Path
import unittest

from ops.catalog.store import merchant_identity
from ops.collector.build_prices import conditional_prices, normalize_url

ROOT = Path(__file__).resolve().parents[2]
read = lambda path: json.loads((ROOT / path).read_text(encoding='utf-8'))


class ReviewedPsus(unittest.TestCase):
    def test_19_posts_are_accounted_for_without_converting_category_sales_into_exact_skus(self):
        review = read('ops/catalog/psu-review-2026-11-21.json')
        self.assertEqual(len(review['decisions']), 19)
        self.assertEqual(len({r['post'] for r in review['decisions']}), 19)
        category = next(r for r in review['decisions'] if r['post'] == '1954565')
        self.assertEqual(category['modelIds'], [])
        self.assertEqual(category['currentListingIds'], [])
        wattages = next(r for r in review['decisions'] if r['post'] == '1974286')['modelIds']
        self.assertEqual(len(wattages), 2)
        self.assertTrue(any('850' in key for key in wattages))
        self.assertTrue(any('1000' in key for key in wattages))

    def test_old_ev_and_unknown_bulk_generation_are_separate_and_unconfirmed_prices_stay_absent(self):
        products = {r['id']: r for r in read('src/content/products/reviewed-psus.json')}
        self.assertIn('reviewed-micronics-classic-ii-ev-750-gold', products)
        self.assertEqual(products['reviewed-micronics-classic-ii-750-gold-black']['listings'], [])
        self.assertEqual(products['reviewed-nzxt-c650-black-bulk']['listings'], [])
        self.assertTrue(products['reviewed-nzxt-c650-bulk-retailer']['listings'])
        self.assertEqual(products['reviewed-msi-mpg-ai1300ts']['listings'], [])
        self.assertNotIn('reviewed-asrock-sl-850g', products)

    def test_current_official_products_do_not_reuse_closed_promotion_urls_or_prices(self):
        prices = read('src/content/prices/psu.json')['items']
        outbound = read('src/content/outbound.generated.json')
        urls = [outbound[p['goCode']]['originalUrl'] for p in prices]
        self.assertIn('https://darkflash.co.kr/product/detail.html?product_no=785', urls)
        self.assertIn('https://darkflash.co.kr/product/detail.html?product_no=591', urls)
        self.assertFalse(any('product_no=1034' in u or 'product_no=1093' in u for u in urls))
        aone = next(p for p in prices if '4654061660' in p['id'])
        self.assertTrue(aone['cardRequiresCoupon'])
        self.assertEqual(aone['couponEndsOn'], '2026-11-25')
        conditional_prices(aone, aone['price'])

    def test_official_store_identity_rejects_ambiguous_product_numbers_and_lookalikes(self):
        url = 'https://darkflash.co.kr/product/detail.html?product_no=785'
        self.assertEqual(merchant_identity(url), ('darkflash', '785'))
        self.assertEqual(normalize_url(url)[1], 'darkflash')
        for bad in [url + '&product_no=591', url.replace('785', ''), url + '&returnUrl=other', url.replace('darkflash.co.kr', 'darkflash.co.kr.example.invalid')]:
            with self.assertRaises(ValueError): merchant_identity(bad)


if __name__ == '__main__': unittest.main()
