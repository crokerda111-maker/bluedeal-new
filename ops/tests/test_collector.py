"""Collector checks using synthetic fixtures in a disposable directory only."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

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
             "price": 10000 + i, "checkedAt": "2026-11-15T23:55:00Z", "shippingFee": 0,
             "seller": "TEST SELLER", "url": f"https://www.coupang.com/vp/products/{i}?fixture=1&subid=test"}
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

    def test_first_observation_has_no_invented_history(self):
        self.write_input(self.rows)
        self.build()
        ram = json.loads((self.root / "src/content/prices/ram.json").read_text(encoding="utf-8"))
        for item in ram["items"]:
            self.assertIsNone(item["change24hPct"])
            self.assertIsNone(item["low7d"])
            self.assertIsNone(item["low30d"])

    def test_regeneration_does_not_refresh_checked_time_or_duplicate_history(self):
        self.write_input(self.rows)
        self.build()
        self.now = collector.parse_now("2026-11-16T10:00:00Z")
        self.build()
        ram = json.loads((self.root / "src/content/prices/ram.json").read_text(encoding="utf-8"))
        state = json.loads((self.root / "ops/collector/state/history.json").read_text(encoding="utf-8"))
        self.assertEqual(ram["updatedAt"], "2026-11-15T23:55:00Z")
        self.assertEqual(ram["generatedAt"], "2026-11-16T00:00:00Z")
        self.assertEqual(ram["items"][0]["shippingFee"], 0)
        self.assertTrue(all(len(points) == 1 for points in state.values()))

    def test_invalid_observations_preserve_output(self):
        self.write_input(self.rows)
        self.build()
        previous = self.snapshot()
        for field, value in [("checkedAt", ""), ("checkedAt", "2026-11-16T01:00:00Z"),
                             ("checkedAt", "2026-11-15T23:55:00"), ("shippingFee", -1),
                             ("price", "12만원"), ("price", 10000.9), ("price", "1e5"),
                             ("officialUrl", "javascript:alert(1)"),
                             ("url", "https://www.coupang.com:8443/product"),
                             ("url", "https://www.coupang.com/pro\nduct")]:
            with self.subTest(field=field, value=value):
                self.write_input([{**self.rows[0], field: value}])
                with self.assertRaises(ValueError):
                    self.build()
                self.assertEqual(previous, self.snapshot())

    def test_history_requires_period_coverage_and_recent_24h_reference(self):
        points = [{"at": "2026-11-15T00:00:00Z", "price": 100000},
                  {"at": "2026-11-16T00:00:00Z", "price": 90000}]
        self.assertEqual(collector.history_values(points, self.now), (None, None, -10.0))
        points[0]["at"] = "2026-11-14T00:00:00Z"
        self.assertIsNone(collector.history_values(points, self.now)[2])
        points += [{"at": "2026-10-17T00:00:00Z", "price": 110000},
                   {"at": "2026-11-09T00:00:00Z", "price": 95000}]
        self.assertEqual(collector.history_values(points, self.now), (90000, 90000, None))

    def test_verified_ram_attributes_and_unknown_ssd_dram(self):
        ram = {**self.rows[0], "capacityGB": "48", "moduleCapacityGB": "24", "moduleCount": "2", "memoryType": "DDR5"}
        ssd = {**self.rows[1], "category": "ssd", "capacityGB": "2000"}
        self.write_input([ram, ssd])
        self.build()
        data = json.loads((self.root / "src/content/prices/ram.json").read_text(encoding="utf-8"))
        self.assertEqual(data["items"][0]["capacityGB"], 48)
        data = json.loads((self.root / "src/content/prices/ssd.json").read_text(encoding="utf-8"))
        self.assertEqual(data["items"][0]["ssdDram"], "unknown")
        previous = self.snapshot()
        self.write_input([{**ram, "capacityGB": "32"}])
        with self.assertRaises(ValueError):
            self.build()
        self.assertEqual(previous, self.snapshot())

    def test_empty_or_malformed_snapshot_cannot_remove_existing_prices(self):
        self.write_input(self.rows)
        self.build()
        previous = self.snapshot()
        for rows in ([], [None, self.rows[0]]):
            self.write_input(rows)
            with self.assertRaises(ValueError):
                self.build()
            self.assertEqual(previous, self.snapshot())

    def test_write_failure_rolls_back_already_replaced_files(self):
        self.write_input(self.rows)
        self.build()
        previous = self.snapshot()
        self.write_input([{**row, "price": row["price"] + 100} for row in self.rows])
        original = Path.replace
        calls = 0
        def failing_replace(source, target):
            nonlocal calls
            calls += 1
            if calls == 3:
                raise OSError("TEST ONLY simulated disk failure")
            return original(source, target)
        with patch.object(Path, "replace", failing_replace):
            with self.assertRaises(OSError):
                self.build()
        self.assertEqual(previous, self.snapshot())
        self.assertFalse(list(self.root.rglob("*.tmp")))

    def test_running_job_lock_prevents_concurrent_output_changes(self):
        self.write_input(self.rows)
        self.build()
        lock = self.root / "ops/collector/state/build.lock"
        lock.write_text("TEST ONLY busy", encoding="utf-8")
        previous = self.snapshot()
        with self.assertRaises(ValueError):
            self.build()
        self.assertEqual(previous, self.snapshot())


if __name__ == "__main__":
    unittest.main()
