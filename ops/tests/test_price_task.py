"""Exercise task prerequisites and runner in isolated folders; never register a task."""
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[2]
POWERSHELL = os.environ.get('BLUEDEAL_TEST_POWERSHELL') or shutil.which('pwsh')


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


@unittest.skipUnless(POWERSHELL and shutil.which('git') and os.name == 'nt', 'Windows PowerShell and Git required')
class PriceTaskTests(unittest.TestCase):
    def setUp(self):
        base = REPO / '.test-tmp'
        base.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='price-task-', dir=base)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.assertTrue(self.root.resolve().is_relative_to(base.resolve()))
        self.ops = self.root / 'ops/collector'
        self.ops.mkdir(parents=True)
        for name in ('PriceTaskRuntime.psm1', 'run_scheduled_prices.ps1'):
            shutil.copyfile(REPO / 'ops/collector' / name, self.ops / name)
        shutil.copyfile(REPO / '.gitignore', self.root / '.gitignore')
        for command in (['init', '-b', 'main'], ['add', '.'], ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'TEST ONLY task fixture']):
            subprocess.run(['git', *command], cwd=self.root, capture_output=True, check=True)
        self.head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=self.root).decode().strip()
        self.state = self.ops / 'state'
        self.state.mkdir()
        self.private = self.root / 'ops/private'
        self.private.mkdir()

    def ps(self, command):
        return subprocess.run([POWERSHELL, '-NoProfile', '-Command', command], cwd=self.root, capture_output=True, timeout=20)

    def activation(self):
        module = quote(self.ops / 'PriceTaskRuntime.psm1')
        return self.ps(f"Import-Module {module} -Force; try {{ [void](Test-PriceTaskActivation -RepoRoot {quote(self.root)}); exit 0 }} catch {{ exit 3 }}")

    def reports(self, **changes):
        report = dict(status='verified', mode='feed', sourceValidated=True, deploymentVerified=True,
                      priceCommit=self.head, verifiedAt=datetime.now(timezone.utc).isoformat())
        report.update(changes)
        (self.state / 'last-successful-publish.json').write_text(json.dumps(report), encoding='utf-8')
        self.deployment = dict(status='verified', expectedCommit=self.head, observedCommit=self.head,
                               expectedSnapshotHash='a' * 64, observedSnapshotHash='a' * 64)
        self.save_deployment()

    def save_deployment(self):
        (self.state / 'last-deployment-check.json').write_text(json.dumps(self.deployment), encoding='utf-8')

    def test_activation_requires_actual_recent_feed_publish_and_exact_live_commit(self):
        self.assertNotEqual(self.activation().returncode, 0)
        self.reports()
        result = self.activation()
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors='replace'))
        for change in ({'mode': 'manual'}, {'deploymentVerified': False}, {'sourceValidated': False},
                       {'priceCommit': 'b' * 40}, {'status': 'uploaded-unverified'},
                       {'verifiedAt': (datetime.now(timezone.utc) - timedelta(hours=27)).isoformat()},
                       {'verifiedAt': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()}):
            with self.subTest(change=change):
                self.reports(**change)
                self.assertNotEqual(self.activation().returncode, 0)

    def test_activation_rejects_wrong_observed_commit_or_price_hash(self):
        for change in ({'observedCommit': 'b' * 40}, {'observedSnapshotHash': 'b' * 64}, {'status': 'timeout'}):
            with self.subTest(change=change):
                self.reports()
                self.deployment.update(change)
                self.save_deployment()
                self.assertNotEqual(self.activation().returncode, 0)

    def test_runtime_pins_stable_local_executables_and_preserves_existing_configuration(self):
        module = quote(self.ops / 'PriceTaskRuntime.psm1')
        root = quote(self.root)
        result = self.ps(f"Import-Module {module} -Force; $runtime=Get-PriceTaskRuntime -RepoRoot {root}; Save-PriceTaskRuntime -RepoRoot {root} -Runtime $runtime; $runtime | ConvertTo-Json -Compress")
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors='replace'))
        config_path = self.private / 'task-runtime.local.json'
        original = config_path.read_bytes()
        config = json.loads(original)
        self.assertNotIn('WindowsApps', config['powershell'])
        self.assertEqual(Path(config['npm']).name.lower(), 'npm.cmd')
        self.assertTrue(all(Path(config[key]).is_file() for key in ('powershell', 'node', 'npm', 'python', 'git')))
        self.assertEqual(self.ps(f"Import-Module {module} -Force; $r=Get-PriceTaskRuntime -RepoRoot {root}; Save-PriceTaskRuntime -RepoRoot {root} -Runtime $r").returncode, 0)
        self.assertEqual(config_path.read_bytes(), original)

    def configure(self, url='https://feed.example.test/snapshot?private=TEST-ONLY', token='TEST-ONLY-TOKEN'):
        (self.private / 'price-feed.local.json').write_text(json.dumps({'url': url, 'token': token}), encoding='utf-8')

    def publisher(self, status):
        script = """param([switch]$FromFeed,[switch]$ValidateOnly,[switch]$Publish,[string]$NpmCommand)
$record = @{runId=[Guid]::NewGuid().ToString('N');status='STATUS';deploymentVerified=($Publish -and 'STATUS' -eq 'verified');fromFeed=[bool]$FromFeed;validate=[bool]$ValidateOnly;publish=[bool]$Publish;npmCommand=$NpmCommand}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'state/last-publish.json'), ($record | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
if ('STATUS' -eq 'uploaded-unverified') { exit 1 }; exit 0
""".replace('STATUS', status)
        (self.ops / 'publish_prices.ps1').write_text(script, encoding='utf-8-sig')

    def runner(self, validate=False):
        return self.ps(f"& {quote(self.ops / 'run_scheduled_prices.ps1')} {'-ValidateOnly' if validate else ''}; exit $LASTEXITCODE")

    def report(self):
        return json.loads((self.state / 'last-scheduled-run.json').read_text())

    def test_missing_config_fails_without_publishing_or_exposing_values(self):
        result = self.runner()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.report()['reasonCode'], 'TASK_CONFIG_MISSING')
        self.assertFalse((self.state / 'last-publish.json').exists())

    def test_invalid_feed_urls_are_rejected_before_publisher_and_never_logged(self):
        for url in ('http://feed.example.test/SECRET', 'https://user:SECRET@feed.example.test/',
                    'https://feed.example.test:444/SECRET', 'https://feed.example.test/#SECRET', 'https://127.0.0.1/SECRET'):
            with self.subTest(url=url):
                self.configure(url)
                result = self.runner()
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(self.report()['reasonCode'], 'TASK_CONFIG_INVALID')
                self.assertNotIn(b'SECRET', result.stdout + result.stderr)
                self.assertNotIn('SECRET', json.dumps(self.report()))

    def test_validate_runner_uses_publisher_git_and_feed_preflight(self):
        self.configure()
        self.publisher('validated')
        result = self.runner(validate=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors='replace'))
        self.assertEqual(self.report()['status'], 'validated')
        publisher = json.loads((self.state / 'last-publish.json').read_text())
        self.assertTrue(publisher['fromFeed'])
        self.assertTrue(publisher['validate'])
        self.assertFalse(publisher['publish'])
        self.assertEqual(Path(publisher['npmCommand']).name.lower(), 'npm.cmd')

    def test_upload_without_production_verification_remains_unverified(self):
        self.configure()
        self.publisher('uploaded-unverified')
        result = self.runner()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.report()['status'], 'uploaded-unverified')
        self.assertTrue(self.report()['publisherRunId'])
        self.assertNotIn('TEST-ONLY', json.dumps(self.report()))

    def test_runner_restores_original_environment_even_on_publisher_failure(self):
        self.configure()
        self.publisher('uploaded-unverified')
        result = self.ps(f"$p=$env:PATH; $env:BLUEDEAL_PRICE_FEED_URL='OLD-URL'; $env:BLUEDEAL_PRICE_FEED_TOKEN='OLD-TOKEN'; & {quote(self.ops / 'run_scheduled_prices.ps1')}; $same=($env:PATH -ceq $p -and $env:BLUEDEAL_PRICE_FEED_URL -ceq 'OLD-URL' -and $env:BLUEDEAL_PRICE_FEED_TOKEN -ceq 'OLD-TOKEN'); if ($same) {{ exit 0 }} else {{ exit 4 }}")
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors='replace'))
