"""Check publisher guards in a disposable Git repository, without a remote."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[2]


@unittest.skipUnless(shutil.which("pwsh") and shutil.which("git"), "PowerShell and Git required")
class PublishGuardTests(unittest.TestCase):
    def setUp(self):
        base = REPO / ".test-tmp"
        base.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="publish-", dir=base)
        self.root = Path(self.temp.name)
        self.assertTrue(self.root.resolve().is_relative_to(base.resolve()))
        self.addCleanup(self.temp.cleanup)
        ops = self.root / "ops/collector"
        ops.mkdir(parents=True)
        shutil.copyfile(REPO / "ops/collector/publish_prices.ps1", ops / "publish_prices.ps1")
        (ops / "ingest_snapshot.py").write_text("from pathlib import Path\nPath('UNEXPECTED_BUILDER_RUN').write_text('bad')\n", encoding="utf-8")
        (self.root / "notes.txt").write_text("original", encoding="utf-8")
        self.git("init", "-b", "main")
        self.git("add", ".")
        self.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "TEST ONLY")

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.root, stderr=subprocess.DEVNULL)

    def publish(self):
        result = subprocess.run(["pwsh", "-NoProfile", "-File", str(self.root / "ops/collector/publish_prices.ps1"), "-Publish"], cwd=self.root, capture_output=True, timeout=15)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / "UNEXPECTED_BUILDER_RUN").exists())

    def test_unrelated_staged_change_is_never_committed(self):
        (self.root / "notes.txt").write_text("user staged edit", encoding="utf-8")
        self.git("add", "notes.txt")
        before = self.git("diff", "--cached")
        self.publish()
        self.assertEqual(self.git("diff", "--cached"), before)

    def test_unrelated_unstaged_change_stops_before_generation(self):
        (self.root / "notes.txt").write_text("user working edit", encoding="utf-8")
        self.publish()
        self.assertEqual((self.root / "notes.txt").read_text(encoding="utf-8"), "user working edit")

    def test_feature_branch_is_not_published(self):
        self.git("switch", "-c", "test-branch")
        self.publish()
        self.assertEqual(self.git("branch", "--show-current").decode().strip(), "test-branch")
