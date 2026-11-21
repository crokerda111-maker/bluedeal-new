"""Standalone scheduler and backup safety using disposable local fixtures."""
from datetime import datetime, timedelta
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'ops/maintenance'))
spec = importlib.util.spec_from_file_location('bluedeal_scheduled', ROOT/'ops/maintenance/scheduled.py')
scheduled = importlib.util.module_from_spec(spec); spec.loader.exec_module(scheduled)
NOW = datetime.fromisoformat('2026-11-20T19:40:00+09:00')
TEST_TEMP = ROOT/'.test-tmp'; TEST_TEMP.mkdir(exist_ok=True)


class ScheduledMaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='scheduled-maintenance-', dir=TEST_TEMP)
        self.root = Path(self.temp.name)
    def tearDown(self): self.temp.cleanup()

    def fake_runner(self, code=1, checked_at=NOW):
        def run(args):
            self.args = args
            scheduled.atomic_json(self.root/'ops/private/maintenance/last-health.local.json', {'checked_at':checked_at.isoformat(), 'state':'attention', 'failures':[], 'warnings':['PRICE_RECHECK_REQUIRED'], 'new_findings':[], 'recent':{'state':'complete'}})
            return code
        return run

    def test_attention_is_completed_program_run_and_does_not_call_ai(self):
        record = scheduled.execute('collect', root=self.root, now=NOW, health_runner=self.fake_runner())
        self.assertEqual(self.args,['--collect']); self.assertEqual(record['application_exit_code'],1)
        self.assertEqual(record['state'],'attention'); self.assertEqual(record['ai_calls'],0)
        self.assertEqual(record['collection_state'],'complete'); self.assertFalse(record['external_writes'])
        scheduled.save_run(record,self.root); scheduled.render_dashboard(self.root)
        self.assertTrue((self.root/'ops/private/maintenance/dashboard.html').is_file())

    def test_health_does_not_trigger_collection_and_stale_reports_fail(self):
        scheduled.execute('health',root=self.root,now=NOW,health_runner=self.fake_runner())
        self.assertEqual(self.args,[])
        with self.assertRaises(ValueError): scheduled.execute('health',root=self.root,now=NOW,health_runner=self.fake_runner(checked_at=NOW-timedelta(days=1)))

    def test_lock_contention_and_process_failure_are_distinct(self):
        busy = scheduled.execute('health',root=self.root,now=NOW,health_runner=lambda _:3)
        failed = scheduled.execute('health',root=self.root,now=NOW,health_runner=lambda _:2)
        self.assertEqual(busy['state'],'skipped'); self.assertEqual(failed['state'],'failed')

    def prepare_databases(self):
        databases=[]
        for name in ('hotdeal-research','hotdeal-watch'):
            path=self.root/f'ops/private/{name}/hotdeals.sqlite3';path.parent.mkdir(parents=True,exist_ok=True)
            db=sqlite3.connect(path)
            db.executescript('PRAGMA journal_mode=WAL; CREATE TABLE jobs(id INTEGER); CREATE TABLE deals(id INTEGER); CREATE TABLE job_posts(id INTEGER); INSERT INTO deals VALUES(123);')
            databases.append(db)
        scheduled.atomic_json(self.root/'ops/private/maintenance/last-health.local.json',{'state':'attention'})
        (self.root/'ops/private/.env.local').write_text('SYNTHETIC_SECRET_MUST_NOT_BE_BACKED_UP',encoding='utf-8')
        return databases

    def test_online_backup_preserves_committed_wal_and_only_allowlisted_files(self):
        databases=self.prepare_databases()
        try:
            result=scheduled.backup_data(self.root,NOW);self.assertEqual(result['state'],'ok')
            directory=self.root/'ops/private/maintenance/backups'/result['bundle']
            self.assertEqual({p.name for p in directory.iterdir()},{'hotdeal-research.sqlite3','hotdeal-watch.sqlite3','last-health.local.json','manifest.local.json'})
            for name in ('hotdeal-research','hotdeal-watch'):
                db=sqlite3.connect(directory/(name+'.sqlite3'))
                try:self.assertEqual(db.execute('SELECT id FROM deals').fetchone()[0],123)
                finally:db.close()
            for db in databases:self.assertEqual(db.execute('SELECT COUNT(*) FROM deals').fetchone()[0],1)
            manifest=json.loads((directory/'manifest.local.json').read_text(encoding='utf-8'))
            self.assertEqual(manifest['state'],'verified');self.assertFalse(manifest['automatic_deletion'])
        finally:
            for db in databases:db.close()

    def test_missing_sources_are_not_reported_as_a_successful_backup(self):
        result=scheduled.backup_data(self.root,NOW)
        self.assertEqual(result['state'],'attention'); self.assertIn('BACKUP_SOURCE_MISSING',result['warnings'])

    def test_storage_limit_holds_new_backup_without_deleting_old_backups(self):
        databases=self.prepare_databases()
        try:
            with patch.object(scheduled,'BACKUP_LIMIT_BYTES',0): result=scheduled.backup_data(self.root,NOW)
            self.assertIn('BACKUP_STORAGE_REVIEW',result['warnings']);self.assertFalse(result['automatic_deletion'])
            self.assertEqual(list((self.root/'ops/private/maintenance/backups').iterdir()),[])
        finally:
            for db in databases:db.close()

    def test_private_path_cannot_escape_the_named_store(self):
        with self.assertRaises(ValueError): scheduled.private_path(self.root,'../../outside')

    def test_dashboard_escapes_execution_metadata(self):
        scheduled.atomic_json(self.root/'ops/private/maintenance/scheduler/last-health.local.json',{'state':'failed','completed_at':'<script>bad()</script>'})
        scheduled.render_dashboard(self.root)
        page=(self.root/'ops/private/maintenance/dashboard.html').read_text(encoding='utf-8')
        self.assertNotIn('<script>bad()</script>',page);self.assertIn('&lt;script&gt;',page)


if __name__=='__main__':unittest.main()
