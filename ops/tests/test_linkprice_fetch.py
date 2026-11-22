"""Official API review fetches cannot publish, leak identifiers, or follow redirects."""
import contextlib
from email.message import Message
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "collector"))
import fetch_linkprice_review as fetcher
sys.path.pop(0)


class Response(io.BytesIO):
    def __init__(self, body, content_type="application/json"):
        super().__init__(body)
        self.headers = Message()
        self.headers["Content-Type"] = content_type


# Replace only the Python mapping. Clearing/restoring the process environment on
# Windows drops empty Git config values and breaks unrelated child-process tests.
class LinkPriceFetchTests(unittest.TestCase):
    def setUp(self):
        base = Path(__file__).resolve().parents[2] / ".test-tmp"
        base.mkdir(exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(prefix="linkprice-fetch-", dir=base)
        self.root = Path(self.directory.name)
        self.addCleanup(self.directory.cleanup)
        self.assertTrue(self.root.resolve().is_relative_to(base.resolve()))
        self.identifier = "A123456789"
        self.url = "https://item.gmarket.co.kr/Item?goodscode=100"
        self.normal = {"success": True, "list_recommend": {"gmarket": [{"p_code": "100", "p_name": "TEST ONLY", "p_price": 123000, "target_url": self.url}]}, "list_food": []}
        self.real = [{"merchant_id": "gmarket", "product_code": 100, "product_name": "TEST ONLY", "normal_price": 123000, "discount_price": 0, "currency": "KRW", "click_url": self.url}]
        for name, text in {"ops/collector/catalog.json": json.dumps({"products": [{"id": "fixture-kit", "sourceUrl": self.url}]}),
                           "ops/collector/input/products.csv": "EXISTING PRICES", "src/content/prices/ram.json": "PUBLIC PRICES"}.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")

    def config(self, urls):
        path = self.root / "ops/private/affiliate-config.local.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps([{"provider": "linkprice", "affiliateUrl": value} for value in urls]), encoding="utf-8")
        return path

    def test_one_registered_account_is_reused_without_exposing_or_modifying_configuration(self):
        self.config([f"https://click.linkprice.com/click.php?a={self.identifier}&m=gmarket", f"https://click.linkprice.com/click.php?m=11st&a={self.identifier}"])
        with patch.object(os, "environ", {}):
            self.assertEqual(fetcher.account_id(self.root), self.identifier)

    def test_ambiguous_accounts_deceptive_hosts_duplicate_parameters_and_invalid_environment_are_rejected(self):
        for urls in ([f"https://click.linkprice.com.evil.invalid/click.php?a={self.identifier}"],
                     [f"https://user:PRIVATE_PASSWORD@click.linkprice.com/click.php?a={self.identifier}"],
                     [f"https://click.linkprice.com/click.php?a={self.identifier}&a="],
                     [f"https://click.linkprice.com/click.php?a={self.identifier}", "https://click.linkprice.com/click.php?a=A987654321"]):
            self.config(urls)
            with patch.object(os, "environ", {}), self.assertRaises(fetcher.FetchReviewError):
                fetcher.account_id(self.root)
        with patch.object(os, "environ", {"LINKPRICE_AFFILIATE_ID": "PRIVATE_TOKEN/invalid"}), self.assertRaises(fetcher.FetchReviewError):
            fetcher.account_id(self.root)

    def test_requests_use_only_fixed_official_endpoints_without_cookies_passwords_or_redirect_following(self):
        with patch.object(fetcher, "build_opener") as builder:
            builder.return_value.open.return_value = Response(b"[]", "text/html")
            body, mime = fetcher.fetch_body(self.identifier, "realhotdeal")
            request = builder.return_value.open.call_args.args[0]
            self.assertEqual(request.full_url, f"https://api.linkprice.com/ci/hotdeal/data/{self.identifier}")
            self.assertEqual(builder.return_value.open.call_args.kwargs["timeout"], 20)
            self.assertNotIn("Cookie", request.headers)
            self.assertNotIn("Authorization", request.headers)
            self.assertEqual((body, mime), (b"[]", "text/html"))
            self.assertIsInstance(builder.call_args.args[0], fetcher.NoRedirect)
        self.assertIsNone(fetcher.NoRedirect().redirect_request(None, None, 302, "", {}, "https://elsewhere.invalid/PRIVATE_TOKEN"))

    def test_http_errors_timeouts_and_oversized_responses_do_not_include_private_request_details(self):
        for error in (HTTPError("https://private.invalid/PRIVATE_TOKEN", 403, "PRIVATE_DIAGNOSTIC", {}, None), URLError("PRIVATE_TOKEN"), TimeoutError("PRIVATE_TOKEN")):
            with patch.object(fetcher, "build_opener") as builder:
                builder.return_value.open.side_effect = error
                with self.assertRaises(fetcher.FetchReviewError) as caught:
                    fetcher.fetch_body(self.identifier, "hotdeal")
                self.assertNotIn("PRIVATE", str(caught.exception))
                self.assertNotIn(self.identifier, str(caught.exception))
        with patch.object(fetcher, "MAX_BYTES", 3), patch.object(fetcher, "build_opener") as builder:
            builder.return_value.open.return_value = Response(b"1234")
            with self.assertRaises(fetcher.FetchReviewError):
                fetcher.fetch_body(self.identifier, "hotdeal")

    def test_invalid_identifier_or_endpoint_is_rejected_before_network_access(self):
        with patch.object(fetcher, "build_opener") as builder:
            for identifier, kind in (("PRIVATE_TOKEN", "hotdeal"), (self.identifier, "https://elsewhere.invalid")):
                with self.assertRaises(fetcher.FetchReviewError):
                    fetcher.fetch_body(identifier, kind)
            builder.assert_not_called()

    def test_redirected_private_output_directory_is_rejected_before_fetch(self):
        def resolved(path, *args, **kwargs):
            return self.root / "elsewhere" if path.name == "linkprice-review" else path.absolute()
        with patch.object(Path, "resolve", resolved), patch.object(fetcher, "fetch_body") as fetch:
            with self.assertRaises(fetcher.FetchReviewError):
                fetcher.collect_review(self.root, "hotdeal", self.identifier)
            fetch.assert_not_called()

    def test_complete_cli_fetches_both_shapes_into_private_reviews_without_touching_prices_or_printing_identifiers(self):
        config = self.config([f"https://click.linkprice.com/click.php?a={self.identifier}&m=gmarket"])
        before = {name: (self.root / name).read_bytes() for name in ("ops/collector/input/products.csv", "src/content/prices/ram.json", "ops/private/affiliate-config.local.json")}
        output = io.StringIO()
        with patch.object(os, "environ", {}), patch.object(fetcher, "repo_root", return_value=self.root), patch.object(fetcher, "fetch_body", side_effect=[(json.dumps(self.normal).encode(), "application/json"), (json.dumps(self.real).encode(), "text/html")]), contextlib.redirect_stdout(output):
            self.assertEqual(fetcher.main([]), 0)
        files = list((self.root / "ops/private/linkprice-review").glob("*.review.local.json"))
        self.assertEqual(len(files), 2)
        for path in files:
            report = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(report["matchedCatalogCount"], 1)
            self.assertFalse(report["readyForPublish"])
            self.assertIn("retrievedAt", report)
            self.assertNotIn("checkedAt", report)
            self.assertNotIn("checkedAt", report["candidates"][0])
            self.assertNotIn(self.identifier, json.dumps(report))
        for name, value in before.items():
            self.assertEqual((self.root / name).read_bytes(), value)
        self.assertEqual(config.read_bytes(), before["ops/private/affiliate-config.local.json"])
        for private in (self.identifier, self.url, "click.linkprice.com"):
            self.assertNotIn(private, output.getvalue())

    def test_html_or_duplicate_json_preserves_previous_reports_and_logs_no_response_values(self):
        self.config([f"https://click.linkprice.com/click.php?a={self.identifier}"])
        previous = self.root / "ops/private/linkprice-review/previous.review.local.json"
        previous.parent.mkdir(parents=True)
        previous.write_text('"PREVIOUS"', encoding="utf-8")
        for body in (b"<html>PRIVATE_TOKEN</html>", b'{"success":true,"success":false}'):
            output = io.StringIO()
            with patch.object(os, "environ", {}), patch.object(fetcher, "repo_root", return_value=self.root), patch.object(fetcher, "fetch_body", return_value=(body, "text/html")), contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                self.assertEqual(fetcher.main(["--kind", "hotdeal"]), 1)
            self.assertEqual(previous.read_text(encoding="utf-8"), '"PREVIOUS"')
            self.assertNotIn("PRIVATE_TOKEN", output.getvalue())
            self.assertNotIn(self.identifier, output.getvalue())


if __name__ == "__main__":
    unittest.main()
