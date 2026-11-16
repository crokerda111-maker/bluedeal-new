"""Collector checks using synthetic fixtures in a disposable directory only."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

MODULE_PATH = Path(__file__).resolve().parents[1] / "collector" / "build_prices.py"
SPEC = importlib.util.spec_from_file_location("build_prices", MODULE_PATH)
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)


class CollectorSmokeTests(unittest.TestCase):
    def setUp(self):
        base = Path(__file__).resolve().parents[2] / ".test-tmp"
        base.mkdir(exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(prefix="collector-", dir=base)
        self.root = Path(self.directory.name)
        # Check the resolved deletion target before registering recursive cleanup.
        self.assertTrue(self.root.resolve().is_relative_to(base.resolve()))
        self.addCleanup(self.directory.cleanup)
        self.input = self.root / "fixture.json"
        self.now = collector.parse_now("2026-11-16T00:00:00Z")
        self.rows = [
            {"category": "ram", "id": f"fixture-{i}", "name": f"TEST ONLY DDR5 {i}",
             "price": 10000 + i, "url": f"https://www.coupang.com/vp/products/{i}?fixture=1&subid=test"}
            for i in range(1, 4)
        ]

    def write_input(self, rows):
        self.input.write_text(json.dumps(rows), encoding="utf-8")

    def build(self, dry_run=False):
        with contextlib.redirect_stdout(io.StringIO()):
            return collector.build(self.input, self.root, self.now, dry_run)

    def snapshot(self):
        return {str(p.relative_to(self.root)): p.read_bytes()
                for p in self.root.rglob("*")
                if p.is_file() and p.relative_to(self.root).parts[0] in {"src", "ops"}}

    def test_three_ram_items_generate_stable_codes_and_preserve_tracking(self):
        self.write_input(self.rows)
        self.assertEqual(self.build(), 0)
        ram = json.loads((self.root / "src/content/prices/ram.json").read_text(encoding="utf-8"))
        outbound = json.loads((self.root / "src/content/outbound.generated.json").read_text(encoding="utf-8"))
        self.assertEqual(len(ram["items"]), 3)
        codes = [item["goCode"] for item in ram["items"]]
        for item in ram["items"]:
            self.assertNotIn("url", item)
            self.assertTrue(outbound[item["goCode"]]["originalUrl"].endswith("?fixture=1&subid=test"))
        self.build()
        again = json.loads((self.root / "src/content/prices/ram.json").read_text(encoding="utf-8"))
        self.assertEqual(codes, [item["goCode"] for item in again["items"]])

    def test_invalid_row_preserves_all_previous_output(self):
        self.write_input(self.rows)
        self.build()
        previous = self.snapshot()
        self.write_input(self.rows + [{**self.rows[0], "id": "bad-host", "url": "https://www.coupang.com.example.invalid/product"}])
        with self.assertRaises(ValueError):
            self.build()
        self.assertEqual(previous, self.snapshot())

    def test_dry_run_writes_no_output(self):
        self.write_input(self.rows)
        self.assertEqual(self.build(dry_run=True), 0)
        self.assertEqual(self.snapshot(), {})

    def test_missing_input_preserves_existing_output(self):
        self.write_input(self.rows)
        self.build()
        previous = self.snapshot()
        self.input = self.root / "missing.csv"
        with self.assertRaises(FileNotFoundError):
            self.build()
        self.assertEqual(previous, self.snapshot())


if __name__ == "__main__":
    unittest.main()
