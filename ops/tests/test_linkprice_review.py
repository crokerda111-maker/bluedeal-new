"""Offline API review must never promote incomplete or ambiguous prices."""
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "collector"))
import review_linkprice as reviewer
sys.path.pop(0)


class LinkPriceReviewTests(unittest.TestCase):
    def setUp(self):
        base = Path(__file__).resolve().parents[2] / ".test-tmp"
        base.mkdir(exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(prefix="linkprice-review-", dir=base)
        self.root = Path(self.directory.name)
        self.assertTrue(self.root.resolve().is_relative_to(base.resolve()))
        self.addCleanup(self.directory.cleanup)
        self.url = "https://item.gmarket.co.kr/Item?goodsCode=100"
        self.catalog = {"products": [{"id": "fixture-kit", "sourceUrl": self.url}]}
        self.normal_row = {"p_code": "100", "p_name": "TEST ONLY memory kit", "p_price": "123000", "target_url": self.url}
        self.real_row = {"merchant_id": "gmarket", "product_code": "100", "product_name": "TEST ONLY memory kit", "normal_price": 123000,
                         "discount_price": 0, "curreny": "KRW", "shipping_charge": "무료배송", "click_url": self.url}

    def test_repeated_category_entries_keep_their_different_prices_and_only_count_unique_catalog_matches(self):
        payload = {"success": True, "list_recommend": {"gmarket": [self.normal_row]},
                   "list_digital": {"gmarket": [dict(self.normal_row, p_price="125000")]}}
        report = reviewer.review(payload, "hotdeal", self.catalog)
        self.assertEqual([c["priceCandidate"] for c in report["candidates"]], [123000, 125000])
        self.assertEqual(report["recordCount"], 2)
        self.assertEqual(report["matchedCatalogCount"], 1)
        self.assertEqual(report["unmatchedCatalogIds"], [])
        self.assertFalse(report["readyForPublish"])
        self.assertTrue(all(not c["readyForPublish"] for c in report["candidates"]))
        self.assertTrue(all("verifiedKrwCurrency" in c["requiresVerification"] for c in report["candidates"]))

    def test_real_hotdeal_zero_discount_uses_normal_price_but_never_invents_verified_shipping_or_time(self):
        report = reviewer.review([self.real_row], "realhotdeal", self.catalog)
        candidate = report["candidates"][0]
        self.assertEqual(candidate["priceCandidate"], 123000)
        self.assertEqual(candidate["currencyAsProvided"], "KRW")
        self.assertEqual(candidate["catalogMatches"], ["fixture-kit"])
        for key in reviewer.REQUIRED_REVIEW:
            self.assertIn(key, candidate["requiresVerification"])
        for key in ("shippingFee", "checkedAt", "originalUrl", "affiliateUrl", "click_url"):
            self.assertNotIn(key, candidate)
        self.assertNotIn(self.url, json.dumps(report))

    def test_non_krw_and_invalid_amounts_remain_unverified_without_coercing_boolean_prices(self):
        for price in (True, False, "", "12.5", -1, {}, None):
            row = dict(self.real_row, discount_price=price, curreny="USD", normal_price=None)
            candidate = reviewer.review([row], "realhotdeal", self.catalog)["candidates"][0]
            self.assertIsNone(candidate["priceCandidate"])
            self.assertEqual(candidate["currencyAsProvided"], "USD")
            self.assertIn("verifiedKrwCurrency", candidate["requiresVerification"])
            self.assertIn("validIntegerPrice", candidate["requiresVerification"])

    def test_only_exact_catalog_urls_and_unambiguous_documented_long_targets_match(self):
        from urllib.parse import urlencode
        long_url = "https://click.linkprice.com/click.php?" + urlencode({"m": "gmarket", "a": "TEST_ONLY", "tu": self.url})
        self.assertEqual(reviewer.catalog_target(long_url, "gmarket"), self.url)
        for value in (long_url + "&tu=" + self.url, long_url.replace("m=gmarket", "m=11st"),
                      long_url.replace("/click.php", "/different"), "http://item.gmarket.co.kr/Item?goodsCode=100",
                      "https://user:password@item.gmarket.co.kr/Item?goodsCode=100", self.url + "&different-option=1"):
            row = dict(self.normal_row, target_url=value)
            report = reviewer.review({"success": True, "list_recommend": {"gmarket": [row]}}, "hotdeal", self.catalog)
            self.assertEqual(report["matchedCatalogCount"], 0)
            self.assertEqual(report["unmatchedCatalogIds"], ["fixture-kit"])

    def test_error_responses_and_changed_shapes_cannot_be_mistaken_for_empty_success(self):
        for payload in ({"success": False}, {"success": "true", "list_recommend": {}}, {"success": True},
                        {"success": True, "list_recommend": []}, {"success": True, "list_recommend": {"gmarket": {}}}):
            with self.assertRaises(reviewer.ReviewError):
                reviewer.review(payload, "hotdeal", self.catalog)
        with self.assertRaises(reviewer.ReviewError):
            reviewer.review({"error-message": "PRIVATE DIAGNOSTIC"}, "realhotdeal", self.catalog)
        empty = reviewer.review({"success": True, "list_recommend": {}}, "hotdeal", self.catalog)
        self.assertEqual(empty["recordCount"], 0)
        self.assertEqual(empty["unmatchedCatalogIds"], ["fixture-kit"])

    def test_json_duplicate_keys_nan_and_html_are_rejected(self):
        path = self.root / "response.json"
        for text in ('{"success":true,"success":false}', '[NaN]', '<html>PRIVATE DIAGNOSTIC</html>'):
            path.write_text(text, encoding="utf-8")
            with self.assertRaises(reviewer.ReviewError):
                reviewer.read_response(path)
        with patch.object(reviewer, "MAX_BYTES", 5):
            with self.assertRaises(reviewer.ReviewError):
                reviewer.read_response(path)
        with patch.object(reviewer, "MAX_RECORDS", 1):
            with self.assertRaises(reviewer.ReviewError):
                reviewer.review([self.real_row, self.real_row], "realhotdeal", self.catalog)

    def test_report_output_cannot_overwrite_price_input_public_data_or_other_private_configuration(self):
        report = reviewer.review([self.real_row], "realhotdeal", self.catalog)
        for relative in ("ops/collector/input/products.csv", "src/content/prices/ram.json", "ops/private/affiliate-config.local.json",
                         "ops/private/linkprice-review/../admin-access.local.json"):
            with self.assertRaises(reviewer.ReviewError):
                reviewer.write_report(report, self.root / relative, self.root)
        destination = self.root / "ops/private/linkprice-review/report.local.json"
        reviewer.write_report(report, destination, self.root)
        self.assertEqual(json.loads(destination.read_text(encoding="utf-8")), report)

    def test_invalid_cli_input_preserves_an_existing_report_and_omits_private_values_from_diagnostics(self):
        (self.root / "ops/collector").mkdir(parents=True)
        (self.root / "ops/collector/catalog.json").write_text(json.dumps(self.catalog), encoding="utf-8")
        source = self.root / "response.json"
        source.write_text('<html>PRIVATE DIAGNOSTIC https://secret.example/?token=PRIVATE_TOKEN</html>', encoding="utf-8")
        destination = self.root / "ops/private/linkprice-review/report.local.json"
        destination.parent.mkdir(parents=True)
        destination.write_text('"PREVIOUS REPORT"', encoding="utf-8")
        output = io.StringIO()
        with patch.object(reviewer, "repo_root", return_value=self.root), contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            code = reviewer.main(["--input", str(source), "--kind", "hotdeal", "--output", str(destination)])
        self.assertEqual(code, 1)
        self.assertEqual(destination.read_text(encoding="utf-8"), '"PREVIOUS REPORT"')
        for private in ("PRIVATE DIAGNOSTIC", "PRIVATE_TOKEN", "secret.example"):
            self.assertNotIn(private, output.getvalue())

    def test_complete_cli_flow_writes_only_a_review_and_leaves_operating_files_unchanged(self):
        files = {"ops/collector/catalog.json": json.dumps(self.catalog), "ops/collector/input/products.csv": "EXISTING PRICE INPUT",
                 "src/content/prices/ram.json": '"EXISTING PUBLIC PRICE"', "ops/private/affiliate-config.local.json": '"EXISTING PRIVATE CONFIG"'}
        for name, text in files.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        source = self.root / "response.TEST-ONLY.json"
        source.write_text(json.dumps({"success": True, "list_recommend": {"gmarket": [self.normal_row]}}), encoding="utf-8")
        output = io.StringIO()
        with patch.object(reviewer, "repo_root", return_value=self.root), contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            code = reviewer.main(["--input", str(source), "--kind", "hotdeal"])
        self.assertEqual(code, 0)
        report = json.loads((self.root / "ops/private/linkprice-review/report.local.json").read_text(encoding="utf-8"))
        self.assertEqual(report["matchedCatalogCount"], 1)
        self.assertFalse(report["readyForPublish"])
        self.assertFalse(report["candidates"][0]["readyForPublish"])
        for name, text in files.items():
            self.assertEqual((self.root / name).read_text(encoding="utf-8"), text)
        self.assertNotIn(self.url, output.getvalue())


if __name__ == "__main__":
    unittest.main()
