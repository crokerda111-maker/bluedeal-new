"""Check publisher guards in a disposable Git repository, without a remote."""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[2]
POWERSHELL = os.environ.get('BLUEDEAL_TEST_POWERSHELL') or shutil.which('pwsh')


@unittest.skipUnless(POWERSHELL and shutil.which("git"), "PowerShell and Git required")
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
        shutil.copyfile(REPO / ".gitignore", self.root / ".gitignore")
        (ops / "ingest_snapshot.py").write_text("from pathlib import Path\nPath('UNEXPECTED_BUILDER_RUN').write_text('bad')\n", encoding="utf-8")
        (self.root / "notes.txt").write_text("original", encoding="utf-8")
        self.git("init", "-b", "main")
        self.git("add", ".")
        self.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "TEST ONLY")

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.root, stderr=subprocess.DEVNULL)

    def publish(self):
        result = subprocess.run([POWERSHELL, "-NoProfile", "-File", str(self.root / "ops/collector/publish_prices.ps1"), "-Publish"], cwd=self.root, capture_output=True, timeout=15)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / "UNEXPECTED_BUILDER_RUN").exists())

    def prepare_valid_price_fixture(self):
        prices = self.root / "src/content/prices"
        prices.mkdir(parents=True)
        for category in ("ram", "cpu", "ssd", "motherboard", "gpu", "cooler", "halfpc", "fullpc", "psu", "case", "hdd", "meta"):
            (prices / f"{category}.json").write_text('{"items": []}', encoding="utf-8")
        (self.root / "src/content/outbound.generated.json").write_text('{}', encoding="utf-8")
        (self.root / "ops/collector/ingest_snapshot.py").write_text("import sys\nfrom pathlib import Path\nif '--dry-run' not in sys.argv: Path('src/content/prices/ram.json').write_text('{\"items\": [\"TEST ONLY\"]}')\n", encoding="utf-8")
        (self.root / "ops/collector/verify_deployment.py").write_text("import json,sys\nfrom pathlib import Path\ncommit=sys.argv[sys.argv.index('--commit')+1]\nPath('ops/collector/state/observer-fixture.json').write_text(json.dumps({'commit':commit}))\n", encoding="utf-8")
        self.git("add", ".")
        self.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "TEST valid publisher fixture")
        self.git("config", "user.name", "Fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.remote = self.root / ".test-tmp/remote.git"
        self.remote.parent.mkdir()
        subprocess.check_output(["git", "init", "--bare", str(self.remote)], stderr=subprocess.DEVNULL)
        self.git("remote", "add", "origin", str(self.remote))
        self.git("push", "origin", "main")

    def invoke_with_build(self, build_body, flags="-Publish"):
        quote = lambda value: "'" + str(value).replace("'", "''") + "'"
        command = f"function npm {{ {build_body}; $global:LASTEXITCODE=0 }}; & {quote(self.root / 'ops/collector/publish_prices.ps1')} {flags}"
        return subprocess.run([POWERSHELL, "-NoProfile", "-Command", command], cwd=self.root, capture_output=True, timeout=25)

    def report(self):
        import json
        return json.loads((self.root / "ops/collector/state/last-publish.json").read_text(encoding="utf-8"))

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

    def test_source_saved_during_build_stops_before_staging_or_commit(self):
        price = self.root / "src/content/prices/ram.json"
        price.parent.mkdir(parents=True)
        price.write_text('{"items": []}', encoding="utf-8")
        builder = self.root / "ops/collector/ingest_snapshot.py"
        builder.write_text("from pathlib import Path\nPath('src/content/prices/ram.json').write_text('{\"items\": [\"TEST ONLY\"]}')\n", encoding="utf-8")
        self.git("add", ".")
        self.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "TEST publisher race")
        self.git("remote", "add", "origin", ".")
        before = self.git("rev-parse", "HEAD")
        quote = lambda value: "'" + str(value).replace("'", "''") + "'"
        script = f"function npm {{ Set-Content -LiteralPath {quote(self.root / 'notes.txt')} -Value 'user edit during build'; $global:LASTEXITCODE=0 }}; & {quote(self.root / 'ops/collector/publish_prices.ps1')} -Publish"
        result = subprocess.run([POWERSHELL, "-NoProfile", "-Command", script], cwd=self.root, capture_output=True, timeout=15)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("TEST ONLY", price.read_text(encoding="utf-8"), (result.stdout + result.stderr).decode("utf-8", errors="replace"))
        self.assertEqual((self.root / "notes.txt").read_text(encoding="utf-8").strip(), "user edit during build")
        self.assertEqual(self.git("diff", "--cached"), b"")
        self.assertEqual(self.git("rev-parse", "HEAD"), before)

    def test_user_commit_during_build_is_preserved_and_not_published_with_prices(self):
        self.prepare_valid_price_fixture()
        before = self.git("rev-parse", "HEAD")
        result = self.invoke_with_build("Set-Content -LiteralPath notes.txt -Value 'user commit'; git add notes.txt; git commit -m 'user edit during build' --only notes.txt")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotEqual(self.git("rev-parse", "HEAD"), before)
        self.assertEqual(self.git("log", "-1", "--format=%s").decode().strip(), "user edit during build")
        self.assertEqual(self.git("diff", "--cached"), b"")
        self.assertEqual(self.report()["reasonCode"], "GIT_CHANGED_DURING_BUILD")
        self.assertEqual(self.git("rev-parse", "origin/main"), before)

    def test_branch_switch_during_build_stops_before_price_commit(self):
        self.prepare_valid_price_fixture()
        before = self.git("rev-parse", "HEAD")
        result = self.invoke_with_build("git switch -c user-feature")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git("branch", "--show-current").decode().strip(), "user-feature")
        self.assertEqual(self.git("rev-parse", "HEAD"), before)
        self.assertEqual(self.git("diff", "--cached"), b"")
        self.assertEqual(self.report()["reasonCode"], "GIT_CHANGED_DURING_BUILD")

    def test_price_only_commit_is_verified_and_recorded_after_upload(self):
        self.prepare_valid_price_fixture()
        before = self.git("rev-parse", "HEAD")
        result = self.invoke_with_build("Write-Host 'TEST ONLY build success'")
        self.assertEqual(result.returncode, 0, (result.stdout + result.stderr).decode("utf-8", errors="replace"))
        head = self.git("rev-parse", "HEAD").decode().strip()
        self.assertNotEqual(head.encode(), before.strip())
        self.assertEqual(self.git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD").decode().splitlines(), ["src/content/prices/ram.json"])
        report = self.report()
        self.assertEqual(report["status"], "verified")
        self.assertTrue(report["deploymentVerified"])
        self.assertTrue(report["uploadSucceeded"])
        self.assertEqual(report["priceCommit"], head)
        self.assertTrue(report['verifiedAt'])
        import json
        successful = json.loads((self.root / 'ops/collector/state/last-successful-publish.json').read_text())
        self.assertEqual(successful['runId'], report['runId'])
        observer = json.loads((self.root / "ops/collector/state/observer-fixture.json").read_text())
        self.assertEqual(observer["commit"], head)

    def test_validate_only_checks_source_without_changing_price_files_or_commits(self):
        self.prepare_valid_price_fixture()
        before = self.git("rev-parse", "HEAD")
        result = self.invoke_with_build("throw 'BUILD SHOULD NOT RUN'", "-ValidateOnly")
        self.assertEqual(result.returncode, 0, (result.stdout + result.stderr).decode("utf-8", errors="replace"))
        self.assertEqual(self.git("rev-parse", "HEAD"), before)
        self.assertEqual(self.git("diff"), b"")
        self.assertEqual(self.report()["status"], "validated")
        self.assertFalse(self.report()["deploymentVerified"])

    def test_failed_deployment_check_never_claims_an_uploaded_price_is_verified(self):
        self.prepare_valid_price_fixture()
        verifier = self.root / "ops/collector/verify_deployment.py"
        verifier.write_text("raise SystemExit(2)\n", encoding="utf-8")
        self.git("add", str(verifier.relative_to(self.root)))
        self.git("commit", "-m", "TEST observer timeout")
        self.git("push", "origin", "main")
        result = self.invoke_with_build("Write-Host 'TEST ONLY build success'")
        self.assertNotEqual(result.returncode, 0)
        report = self.report()
        self.assertEqual(report["status"], "uploaded-unverified")
        self.assertEqual(report["reasonCode"], "DEPLOYMENT_PENDING")
        self.assertTrue(report["uploadSucceeded"])
        self.assertFalse(report["deploymentVerified"])
        self.assertFalse((self.root / 'ops/collector/state/last-successful-publish.json').exists())

    def test_unchanged_input_still_verifies_the_exact_current_deployment(self):
        self.prepare_valid_price_fixture()
        builder = self.root / 'ops/collector/ingest_snapshot.py'
        builder.write_text('pass\n', encoding='utf-8')
        self.git('add', str(builder.relative_to(self.root)))
        self.git('commit', '-m', 'TEST unchanged input')
        self.git('push', 'origin', 'main')
        before = self.git('rev-parse', 'HEAD')
        result = self.invoke_with_build("throw 'BUILD SHOULD NOT RUN'")
        self.assertEqual(result.returncode, 0, (result.stdout + result.stderr).decode('utf-8', errors='replace'))
        self.assertEqual(self.git('rev-parse', 'HEAD'), before)
        self.assertEqual(self.git('diff'), b'')
        report = self.report()
        self.assertTrue(report['uploadSkipped'])
        self.assertFalse(report['uploadSucceeded'])
        self.assertTrue(report['deploymentVerified'])
        self.assertEqual(report['priceCommit'], before.decode().strip())
