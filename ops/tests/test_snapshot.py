"""Price-feed guard checks. No real feeds, credentials or merchant requests."""
import importlib.util
from pathlib import Path
import sys
import os
import unittest
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError

COLLECTOR = Path(__file__).resolve().parents[1] / "collector"
sys.path.insert(0, str(COLLECTOR))
SPEC = importlib.util.spec_from_file_location("ingest_snapshot", COLLECTOR / "ingest_snapshot.py")
snapshot = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(snapshot)


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.now = snapshot.parse_now("2026-11-16T09:00:00Z")
        self.row = {"category": "ram", "id": "fixture-ram", "name": "TEST ONLY", "price": 100000,
                    "currency": "KRW", "checkedAt": "2026-11-16T08:00:00Z", "url": "https://item.gmarket.co.kr/Item?goodsCode=1",
                    "seller": "TEST SELLER", "capacityGB": 32, "moduleCount": 2, "moduleCapacityGB": 16, "memoryType": "DDR5"}
        self.catalog = {"products": [{key: self.row[key] for key in ["category", "id", "seller", "capacityGB", "moduleCount", "moduleCapacityGB", "memoryType"]}]}
        self.catalog["products"][0]["sourceUrl"] = self.row["url"]
        self.previous = [{**self.row, "checkedAt": "2026-11-16T00:00:00Z"}]

    def validate(self, rows, accept=False):
        snapshot.validate_snapshot(rows, self.catalog, self.previous, self.now, accept)

    def test_complete_matching_snapshot_passes(self):
        self.validate([self.row])

    def test_missing_duplicate_and_unknown_products_are_rejected(self):
        for rows in [[], [self.row, self.row], [{**self.row, "id": "wrong-model"}]]:
            with self.subTest(rows=len(rows)), self.assertRaises(ValueError):
                self.validate(rows)

    def test_currency_option_seller_and_source_changes_are_rejected(self):
        for key, value in [("currency", "USD"), ("capacityGB", 16), ("moduleCount", 1),
                           ("seller", "OTHER SELLER"), ("url", "https://item.gmarket.co.kr/Item?goodsCode=2")]:
            with self.subTest(field=key), self.assertRaises(ValueError):
                self.validate([{**self.row, key: value}])

    def test_stale_rollback_future_and_missing_check_times_are_rejected(self):
        for checked in ["2026-11-14T00:00:00Z", "2026-11-15T20:00:00Z", "2026-11-17T00:00:00Z", ""]:
            with self.subTest(checked=checked), self.assertRaises(ValueError):
                self.validate([{**self.row, "checkedAt": checked}])

    def test_large_change_needs_review_and_never_bypasses_model_validation(self):
        changed = {**self.row, "price": 200000}
        with self.assertRaises(ValueError):
            self.validate([changed])
        self.validate([changed], accept=True)
        with self.assertRaises(ValueError):
            self.validate([{**changed, "capacityGB": 16}], accept=True)

    def test_feed_errors_do_not_expose_url_secrets_or_bearer_tokens(self):
        url = "https://feed.example.invalid/data?key=TEST_URL_SECRET"
        opener = MagicMock()
        opener.open.side_effect = HTTPError(url, 403, "TEST_PRIVATE_BODY", {}, None)
        with patch.dict(os.environ, {"BLUEDEAL_PRICE_FEED_URL": url, "BLUEDEAL_PRICE_FEED_TOKEN": "TEST_TOKEN_SECRET"}), patch.object(snapshot, "build_opener", return_value=opener):
            with self.assertRaises(ValueError) as caught:
                snapshot.fetch_feed()
        self.assertIn("403", str(caught.exception))
        self.assertNotIn("SECRET", str(caught.exception))
        self.assertNotIn("TEST_PRIVATE_BODY", str(caught.exception))

    def test_feed_redirects_are_not_followed(self):
        self.assertIsNone(snapshot.NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://other.example.invalid/"))
