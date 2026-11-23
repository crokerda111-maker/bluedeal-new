from datetime import datetime
import unittest

from ops.maintenance.fullpc_discovery import recent_complete_pc_candidates


class FullPcDiscoveryTests(unittest.TestCase):
    def test_only_unregistered_exact_retailer_products_enter_the_new_listing_queue(self):
        day = "2026-11-23T12:00:00+09:00"
        now = datetime.fromisoformat("2026-11-24T00:00:00+09:00")
        known = "https://item.gmarket.co.kr/Item?goodscode=3210"
        new = "https://www.11st.co.kr/products/4398"
        old = "https://www.11st.co.kr/products/92201"
        catalog = {"products": [{"category": "fullpc", "sources": [{"url": known}]}]}
        posts = [{"source": "quasarzone", "post_id": str(index), "post_url": f"https://quasarzone.com/bbs/qb_saleinfo/views/{index}",
                  "category": "fullpc", "title": "조립 PC", "posted_upper": day} for index in range(5)]
        posts[3]["ended"] = True
        posts[4]["posted_upper"] = "2026-11-01T00:00:00+09:00"
        links = {("quasarzone", "0"): [known.replace("goodscode", "goodsCode"), new],
                 ("quasarzone", "1"): [new], ("quasarzone", "2"): ["https://www.11st.co.kr.example.net/products/999"],
                 ("quasarzone", "3"): [old], ("quasarzone", "4"): [old]}
        report = recent_complete_pc_candidates(catalog, posts, links, now)
        self.assertEqual(report["catalog_retailer_ids"], 1)
        self.assertEqual([row["listing_id"] for row in report["missing"]], ["4398"])
        self.assertEqual(len(report["missing"][0]["signals"]), 2)
        self.assertEqual(len(report["unresolved"]), 1)
        self.assertNotIn("current_price", report["missing"][0])
