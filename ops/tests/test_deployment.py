"""Deployment verification uses synthetic responses and disposable repositories."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "ops/collector"))
from price_snapshot import load_price_snapshot, read_snapshot_json
from verify_deployment import DeploymentReadError, safe_base, verify_deployment

SHA = "a" * 40
OLD = "b" * 40


class FakeClock:
    def __init__(self):
        self.now = 0

    def time(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.expected = load_price_snapshot(REPO)
        self.version = "9.9.9-test"
        self.clock = FakeClock()

    def run_check(self, reader, **kwargs):
        return verify_deployment(SHA, self.expected, self.version, reader=reader, clock=self.clock.time, sleep=self.clock.sleep, timeout=3, interval=1, **kwargs)

    def release(self, commit=SHA):
        return {"service": "BLUEDEAL", "version": self.version, "commit": commit}

    def live(self, commit=SHA):
        return {**copy.deepcopy(self.expected), "commit": commit, "version": self.version}

    def test_verified_requires_the_same_commit_and_complete_public_snapshot(self):
        calls = []
        def read(url, timeout):
            calls.append(url)
            self.assertGreater(timeout, 0)
            return self.release() if url.endswith("/api/version") else self.live()
        result = self.run_check(read)
        self.assertEqual(result["status"], "verified")
        self.assertEqual(result["attempts"], 1)
        self.assertEqual(len(calls), 2)
        self.assertEqual(result["expectedSnapshotHash"], result["observedSnapshotHash"])

    def test_alias_rollout_cannot_mix_new_version_and_old_price_data(self):
        reads = iter([self.release(), self.live(OLD), self.release(), self.live()])
        result = self.run_check(lambda *_: next(reads))
        self.assertEqual(result["status"], "verified")
        self.assertEqual(result["attempts"], 2)

    def test_old_commit_times_out_without_claiming_success(self):
        result = self.run_check(lambda *_: self.release(OLD))
        self.assertEqual(result["status"], "timeout")
        self.assertEqual(result["reasonCode"], "NOT_DEPLOYED_YET")
        self.assertEqual(result["observedCommit"], OLD)

    def test_different_prices_or_counts_never_pass(self):
        for change in ({"snapshotHash": "0" * 64}, {"itemCount": 999}, {"generatedAt": "DIFFERENT"}):
            with self.subTest(change=change):
                self.clock = FakeClock()
                live = {**self.live(), **change}
                result = self.run_check(lambda url, _: self.release() if url.endswith("/api/version") else live)
                self.assertEqual(result["status"], "timeout")
                self.assertEqual(result["reasonCode"], "PRICE_SNAPSHOT_MISMATCH")

    def test_protected_deployments_stop_without_retries_or_authentication(self):
        for code in ("HTTP_401", "HTTP_403"):
            with self.subTest(code=code):
                def read(*_):
                    raise DeploymentReadError(code)
                result = self.run_check(read)
                self.assertEqual(result["status"], "blocked")
                self.assertEqual(result["attempts"], 1)
                self.assertEqual(result["reasonCode"], "DEPLOYMENT_PROTECTED")

    def test_untrusted_response_text_is_not_recorded(self):
        def read(*_):
            raise DeploymentReadError("private-token=DO-NOT-LOG")
        result = self.run_check(read)
        self.assertEqual(result["reasonCode"], "READ_FAILED")
        self.assertNotIn("DO-NOT-LOG", json.dumps(result))

    def test_verification_origin_rejects_credentials_and_unrelated_hosts(self):
        for url in ("http://bluedeal.co.kr", "https://bluedeal.co.kr.evil.invalid", "https://u:p@bluedeal.co.kr", "https://bluedeal.co.kr/path", "https://bluedeal.co.kr?token=x"):
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    safe_base(url)
        self.assertEqual(safe_base("https://bluedeal.co.kr/"), "https://bluedeal.co.kr")
        self.assertEqual(safe_base("http://127.0.0.1:3456"), "http://127.0.0.1:3456")

    def test_committed_blobs_ignore_later_editor_changes(self):
        base = REPO / ".test-tmp"
        base.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base, prefix="committed-status-") as directory:
            root = Path(directory)
            self.assertTrue(root.resolve().is_relative_to(base.resolve()))
            (root / "package.json").write_text('{"version":"TEST-COMMITTED"}', encoding="utf-8")
            def git(*args):
                return subprocess.check_output(["git", *args], cwd=root, stderr=subprocess.DEVNULL).decode().strip()
            git("init", "-b", "main")
            git("add", ".")
            git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "TEST ONLY")
            commit = git("rev-parse", "HEAD")
            (root / "package.json").write_text('{"version":"USER-UNCOMMITTED"}', encoding="utf-8")
            self.assertEqual(read_snapshot_json(root, "package.json", commit)["version"], "TEST-COMMITTED")
            self.assertEqual(read_snapshot_json(root, "package.json")["version"], "USER-UNCOMMITTED")
