"""Recurring operations: no production writes, no live network in these tests."""
from datetime import datetime, timedelta
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('bluedeal_maintenance',ROOT/'ops/maintenance/run.py')
maintenance=importlib.util.module_from_spec(spec);spec.loader.exec_module(maintenance)
NOW=datetime.fromisoformat('2026-11-19T21:00:00+09:00')
TEST_TEMP=ROOT/'.test-tmp';TEST_TEMP.mkdir(exist_ok=True)


class MaintenanceTests(unittest.TestCase):
    def test_price_age_uses_actual_per_item_time_and_preserves_sold_out_history(self):
        items=[{'id':'boundary','checkedAt':(NOW-timedelta(hours=24)).isoformat()},
               {'id':'old','checkedAt':(NOW-timedelta(hours=25)).isoformat()},
               {'id':'unknown','checkedAt':''},{'id':'future','checkedAt':(NOW+timedelta(hours=1)).isoformat()},
               {'id':'no-zone','checkedAt':'2026-11-19T20:00:00'},
               {'id':'sold','availability':'out-of-stock','checkedAt':'2020-01-01T00:00:00+09:00'}]
        before=json.dumps(items); result=maintenance.price_age(items,NOW)
        self.assertEqual(result,{'total':6,'stale':1,'unknown_time':3,'sold_out':1,'recheck':['old','unknown','future','no-zone']})
        self.assertEqual(before,json.dumps(items))

    def mock_fetch(self,changes=None):
        self.version={'service':'BLUEDEAL','version':'0.0.1','commit':'a'*40}
        self.snapshot={**self.version,'schemaVersion':1,'snapshotHash':'b'*64,'itemCount':8,'categories':[{'category':category,'itemCount':1} for category in sorted(maintenance.CATEGORIES)]}
        def fetch(route):
            response={'status':200,'type':'text/html','body':b'<main id="main-content"></main>'}
            if route.startswith('/api/'):
                response={'status':200,'type':'application/json','body':json.dumps(self.version if route=='/api/version' else self.snapshot).encode()}
            return changes(route,response) if changes else response
        return fetch

    def test_public_read_failure_and_login_html_do_not_pass(self):
        def changes(route,response):
            if route=='/api/version': return {'status':200,'type':'text/html','body':b'Login'}
            if route=='/prices': raise OSError('Do not log this body or credential')
            return response
        result=maintenance.production_health(NOW,self.mock_fetch(changes))
        self.assertIn('PUBLIC_ENDPOINT:/api/version',result['failures']);self.assertIn('PUBLIC_ENDPOINT:/prices',result['failures'])
        self.assertNotIn('credential',json.dumps(result))

    def test_matching_deployed_snapshot_is_required_before_reading_price_age(self):
        fetch=self.mock_fetch()
        with patch.object(maintenance,'load_price_snapshot',return_value={'snapshotHash':'c'*64}),patch.object(maintenance,'read_snapshot_json') as read:
            result=maintenance.production_health(NOW,fetch)
            self.assertIn('DEPLOYED_PRICE_SNAPSHOT_MISMATCH',result['failures']);read.assert_not_called()
        with patch.object(maintenance,'load_price_snapshot',return_value={'snapshotHash':'b'*64}),patch.object(maintenance,'read_snapshot_json',return_value={'items':[{'id':'sample','checkedAt':NOW.isoformat()}]}):
            result=maintenance.production_health(NOW,fetch)
            self.assertEqual(result['failures'],[]);self.assertEqual(result['price_freshness']['total'],8)

    def test_api_release_mismatch_and_malformed_category_are_failures(self):
        fetch=self.mock_fetch();self.snapshot['commit']='c'*40
        self.assertIn('RELEASE_MISMATCH',maintenance.production_health(NOW,fetch)['failures'])
        self.snapshot['categories'][0]['category']='../../private'
        self.assertIn('SNAPSHOT_CONTRACT',maintenance.production_health(NOW,fetch)['failures'])

    def test_missing_archive_does_not_create_a_database(self):
        with tempfile.TemporaryDirectory(prefix='maintenance-',dir=TEST_TEMP) as folder:
            path=Path(folder)/'missing.sqlite3'
            self.assertEqual(maintenance.archive_health(path),{'state':'missing'});self.assertFalse(path.exists())

    def test_report_identifies_new_findings_without_repeating_them(self):
        report={'checked_at':NOW.isoformat(),'state':'attention','failures':[],'warnings':['PRICE_RECHECK_REQUIRED'],'production':{'checks':[],'price_freshness':None}}
        with tempfile.TemporaryDirectory(prefix='maintenance-',dir=TEST_TEMP) as folder:
            directory=Path(folder);maintenance.save_report(report,directory)
            self.assertEqual(report['new_findings'],['PRICE_RECHECK_REQUIRED'])
            maintenance.save_report(report,directory);self.assertEqual(report['new_findings'],[])
            self.assertTrue((directory/'report.html').is_file());self.assertEqual(len((directory/'history.jsonl').read_text().splitlines()),2)

    def test_corrupt_previous_report_is_recorded_instead_of_stopping_monitoring(self):
        report={'checked_at':NOW.isoformat(),'state':'ok','failures':[],'warnings':[],'production':{'checks':[],'price_freshness':None}}
        with tempfile.TemporaryDirectory(prefix='maintenance-',dir=TEST_TEMP) as folder:
            directory=Path(folder);(directory/'last-health.local.json').write_text('broken',encoding='utf-8')
            maintenance.save_report(report,directory)
            self.assertEqual(report['state'],'attention');self.assertIn('LOCAL_HEALTH_REPORT_UNREADABLE',report['new_findings'])
            self.assertEqual(json.loads((directory/'last-health.local.json').read_text(encoding='utf-8'))['state'],'attention')

    def test_crawler_network_failure_is_distinct_from_a_provider_denial(self):
        import sys
        sys.path.insert(0,str(ROOT/'ops/hotdeals'))
        from crawler import NetworkPause,crawl
        from store import Store
        class OfflineTransport:
            def __init__(self,*args):pass
            def load_robots(self):raise NetworkPause('Synthetic local network error')
        with tempfile.TemporaryDirectory(prefix='maintenance-',dir=TEST_TEMP) as folder:
            store=Store(folder)
            try:
                job=store.new_job(NOW-timedelta(days=7),NOW,['quasarzone'])
                crawl(store,job['id'],transport_factory=OfflineTransport)
                self.assertEqual(store.progress(job['id'])[0]['state'],'network-paused')
            finally:store.close()


class FakeStore:
    def __init__(self,state=None,until=None):
        self.state=state;self.until=until or (NOW-timedelta(days=1)).isoformat();self.created=[];self.closed=False
    def latest_job(self):return {'id':1,'until':self.until} if self.state else None
    def progress(self,job_id):return [{'source':'quasarzone','state':self.state}]
    def new_job(self,since,until,sources):self.created.append((since,until,sources));self.state='pending';return {'id':2,'until':until.isoformat()}
    def summary(self,job_id):return {'all_sources_window_complete':self.state=='boundary-reached','job':{'id':job_id}}
    def close(self):self.closed=True


class RecentWatchTests(unittest.TestCase):
    def run_watch(self,store):
        self.calls=[]
        def collect(target,job_id,**options):self.calls.append((job_id,options));target.state='boundary-reached'
        return maintenance.recent_collection(NOW,store_factory=lambda _:store,collect=collect,exporter=lambda target,job:target.summary(job))

    def test_first_watch_creates_separate_seven_day_window_and_rate_limit(self):
        store=FakeStore();result=self.run_watch(store)
        self.assertEqual(result['state'],'complete');self.assertTrue(store.closed)
        since,until,sources=store.created[0]
        self.assertEqual(since.isoformat(),'2026-11-12T00:00:00+09:00');self.assertEqual(until,NOW);self.assertEqual(sources,['quasarzone'])
        self.assertEqual(self.calls,[(2,{'max_pages':20,'delay':3,'only_sources':['quasarzone']})])
        self.assertNotEqual(maintenance.RECENT,maintenance.ARCHIVE.parent)

    def test_recent_completion_does_not_refetch_and_old_completion_starts_a_new_watch(self):
        store=FakeStore('boundary-reached',NOW.isoformat());self.assertEqual(self.run_watch(store)['state'],'recently-completed');self.assertEqual(self.calls,[])
        store=FakeStore('boundary-reached');self.run_watch(store);self.assertEqual(len(store.created),1)

    def test_page_budget_resumes_existing_window(self):
        store=FakeStore('page-budget-paused');self.run_watch(store)
        self.assertEqual(store.created,[]);self.assertEqual(self.calls[0][0],1)

    def test_network_pause_can_resume_without_clearing_a_provider_block(self):
        store=FakeStore('network-paused');self.run_watch(store)
        self.assertEqual(store.created,[]);self.assertEqual(self.calls[0][0],1)

    def test_access_or_parser_blocks_are_not_retried_by_scheduler(self):
        for state in maintenance.STOPPED:
            store=FakeStore(state);self.assertEqual(self.run_watch(store)['state'],'review-required')
            self.assertEqual(self.calls,[]);self.assertEqual(store.created,[]);self.assertTrue(store.closed)


if __name__=='__main__':unittest.main()
