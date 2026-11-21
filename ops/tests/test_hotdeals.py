"""Historical research checks: synthetic HTML, disposable DB, no live requests."""
from datetime import datetime,timedelta
import importlib
import json
from pathlib import Path
import sys
import tempfile
import threading
from unittest.mock import patch
import unittest
from urllib.parse import parse_qs,urlsplit

MODULES=Path(__file__).resolve().parents[1]/'hotdeals'
sys.path.insert(0,str(MODULES))
from parsers import KST,classify,candidate_key,detail_posted_at,interpret,model_hints,obvious_non_pc,posted_interval,price_hint,quasarzone
from robots import RobotsPolicy
from store import Store
from crawler import CrawlLock,CrawlStop,crawl
from report import csv_text,export,render
from research import ensure_job,six_month_window
import server as local_server

NOW=datetime(2026,11,18,21,30,tzinfo=KST)


def fixture(post_id='100',title='[TEST SHOP] AMD 라이젠 9800X3D',date='26.06.20',price='￦399,000',page=1,next_=True,ended=False):
    return f'''<html><body><input name="page" value="{page}">
    <div class="v2-list-row v2-list-row--hotdeal {'is-done' if ended else ''}">
    <span class="v2-badge">PC/하드웨어</span><a class="subject-link" href="/bbs/qb_saleinfo/views/{post_id}">{title}</a>
    <span class="v2-list-row__price">{price}</span><span class="v2-list-row__ship">배송비 무료</span>
    <span class="v2-list-row__time">{date}</span><span class="user-nick-wrap" data-id="NOT_TO_BE_SAVED">SYNTHETIC USER</span></div>
    {f'<a href="/bbs/qb_saleinfo?page={page+1}">다음</a>' if next_ else ''}</body></html>'''


class ParserTests(unittest.TestCase):
    def test_categories_and_bundles_do_not_turn_complete_pc_into_cpu_offer(self):
        cases={'AMD 라이젠7 9800X3D':'cpu','MSI B850M 박격포':'motherboard','KLEVV DDR5-6000 32GB(16GBx2)':'ram','DDR5 AMD EXPO 6000 32GB':'ram','ASRock 1200W 80PLUS 골드':'psu','9800X3D RTX5070 조립PC':'fullpc','9800X3D 반본체':'halfpc','AMD 9800X3D + MSI B850M':'bundle','9800X3D CPU 공랭 쿨러':'cooler','파워컬러 RX9070XT':'gpu','990 EVO Plus 1TB SSD':'ssd','어항 케이스':'case','LG 27U421A 모니터':'other','노트북 DDR5 32GB RTX5070':'other','65W 파워뱅크 충전기':'other'}
        for title,expected in cases.items():
            with self.subTest(title=title):self.assertEqual(classify(title)[0],expected)
    def test_capacity_and_kit_are_preserved_in_candidate_grouping(self):
        self.assertNotEqual(candidate_key('DDR5 32GB 16GBx2','ram'),candidate_key('DDR5 48GB 24GBx2','ram'))
        self.assertEqual(candidate_key('[TEST A] DDR5 32GB 16GBx2','ram'),candidate_key('[TEST B] DDR5 32GB 16GBx2','ram'))
    def test_ram_speed_is_not_a_cpu_model_hint(self):
        self.assertNotIn('6000',model_hints('AMD EXPO DDR5-6000 32GB'))
    def test_price_requires_one_explicit_currency_and_one_nonzero_amount(self):
        self.assertEqual(price_hint('￦399,000')['price_amount'],'399000')
        self.assertEqual(price_hint('$129.95')['currency'],'USD')
        for value in ['399000','-1,000원','0원','100,000~200,000원','$10 / 15000원','19.9만원','1e5원','299,000원부터','가격별상이']:
            with self.subTest(value=value): self.assertIsNone(price_hint(value)['price_amount'])
        self.assertFalse(price_hint('399000원')['is_current_price'])
    def test_relative_time_remains_an_interval(self):
        lower,upper,precision=posted_interval('4시간 전',NOW)
        self.assertEqual(datetime.fromisoformat(lower),NOW-timedelta(hours=5))
        self.assertEqual(datetime.fromisoformat(upper),NOW-timedelta(hours=4))
        self.assertEqual(precision,'relative_hour')
    def test_exact_day_and_bad_dates(self):
        lower,upper,precision=posted_interval('26.05.18',NOW)
        self.assertEqual(lower,'2026-05-18T00:00:00+09:00')
        self.assertEqual(precision,'day')
        self.assertEqual(datetime.fromisoformat(upper)-datetime.fromisoformat(lower),timedelta(days=1))
        self.assertEqual(posted_interval('26.02.31',NOW),(None,None,'unknown'))
    def test_calendar_months_clamp_day_and_preserve_fixed_job_window(self):
        start,end=six_month_window(datetime(2024,8,31,10,tzinfo=KST))
        self.assertEqual(start,datetime(2024,2,29,tzinfo=KST));self.assertEqual(end.day,31)
    def test_month_day_keeps_inference_visible_and_handles_year_rollover(self):
        lower,_,precision=posted_interval('05.18',NOW)
        self.assertEqual(lower,'2026-05-18T00:00:00+09:00');self.assertEqual(precision,'day-year-inferred')
        lower,_,precision=posted_interval('12.31',NOW)
        self.assertTrue(lower.startswith('2025-12-31'));self.assertEqual(precision,'day-year-inferred')
    def test_detail_anchor_uses_article_date_not_comment_or_other_post(self):
        html='<script type="application/ld+json">'+json.dumps({'@graph':[{'@type':'Comment','datePublished':'2026-01-01T00:00:00+09:00'},{'@type':'DiscussionForumPosting','url':'https://quasarzone.com/bbs/qb_saleinfo/views/100','datePublished':'2026-05-17T10:00:00+09:00'}]})+'</script>'
        self.assertEqual(detail_posted_at(html,'https://quasarzone.com/bbs/qb_saleinfo/views/100'),datetime(2026,5,17,10,tzinfo=KST))
        self.assertIsNone(detail_posted_at(html,'https://quasarzone.com/bbs/qb_saleinfo/views/999'))
    def test_only_regular_rows_no_author_metadata_and_canonical_post_url(self):
        rows,next_=quasarzone(fixture(ended=True),NOW)
        self.assertEqual(len(rows),1);self.assertTrue(rows[0]['ended'])
        self.assertEqual(rows[0]['post_url'],'https://quasarzone.com/bbs/qb_saleinfo/views/100')
        self.assertNotIn('NOT_TO_BE_SAVED',json.dumps(rows));self.assertNotIn('SYNTHETIC USER',json.dumps(rows))
        self.assertEqual(parse_qs(urlsplit(next_).query)['page'],['2'])
    def test_duplicate_layout_and_partner_without_date_do_not_duplicate_posts(self):
        html=fixture()+fixture()+fixture(post_id='101').replace('<span class="v2-list-row__time">26.06.20</span>','')
        rows,_=quasarzone(html,NOW);self.assertEqual(len(rows),1)
    def test_pagination_query_on_subject_link_does_not_drop_posts(self):
        html=fixture().replace('/views/100"','/views/100?page=2"')
        rows,_=quasarzone(html,NOW,current_page=2)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['post_url'],'https://quasarzone.com/bbs/qb_saleinfo/views/100')
    def test_raffle_and_multiple_offers_do_not_claim_one_purchase_price(self):
        row=quasarzone(fixture(title='B850M 메인보드 래플',price='￦0'),NOW)[0][0]
        self.assertEqual(row['offer_kind'],'raffle');self.assertIsNone(row['price_amount'])
        row=quasarzone(fixture(title='DDR5 메모리 외 다수 상품 모음',price='￦777'),NOW)[0][0]
        self.assertEqual(row['offer_kind'],'multiple');self.assertIsNone(row['price_amount'])
        row=quasarzone(fixture(title='7800X3D_RAM 32GB / 9800X3D_RAM 32GB 반본체',price='￦1,847,670'),NOW)[0][0]
        self.assertEqual(row['offer_kind'],'multiple');self.assertIsNone(row['price_amount'])
    def test_truncated_titles_do_not_merge_unseen_options(self):
        one=quasarzone(fixture(title='DDR5 6000 RAM 패키지 ...'),NOW)[0][0]
        two=quasarzone(fixture(post_id='101',title='DDR5 6000 RAM 패키지 ...'),NOW)[0][0]
        self.assertTrue(one['title_truncated']);self.assertNotEqual(one['candidate_key'],two['candidate_key'])
    def test_mini_pc_is_a_complete_pc_and_obvious_food_is_not_pc_candidate(self):
        self.assertEqual(classify('MINI PC 7735HS 32GB 1TB')[0],'fullpc')
        self.assertTrue(obvious_non_pc('[TEST SHOP] 26년 햅쌀 백미 10kg'))


class RobotsTests(unittest.TestCase):
    def test_wildcards_longest_rule_and_comment_endpoint_block(self):
        text='User-agent: *\nDisallow: /bbs/*/\nAllow: /bbs/*/views/\nDisallow: /bbs/*/views/*/\nDisallow: /bbs/*/views/*?*commid=\nAllow: /\n'
        policy=RobotsPolicy(text,'BLUEDEAL-Research/0.1')
        self.assertTrue(policy.allowed('https://example.invalid/bbs/qb_saleinfo?page=2'))
        self.assertTrue(policy.allowed('https://example.invalid/bbs/qb_saleinfo/views/123'))
        self.assertFalse(policy.allowed('https://example.invalid/bbs/qb_saleinfo/views/123/link'))
        self.assertFalse(policy.allowed('https://example.invalid/bbs/qb_saleinfo/views/123?commid=7'))
    def test_other_agents_allow_rule_cannot_override_default_deny(self):
        p=RobotsPolicy('User-agent: *\nDisallow: /\nUser-agent: Googlebot\nAllow: /','BLUEDEAL-Research/0.1')
        self.assertFalse(p.allowed('https://example.invalid/bbs/jirum'))
    def test_equal_rules_allow_wins_end_anchor_and_encoded_unreserved(self):
        p=RobotsPolicy('User-agent: *\nDisallow: /x\nAllow: /x\nDisallow: /a$\nDisallow: /%7Eprivate','research')
        self.assertTrue(p.allowed('https://example.invalid/x'))
        self.assertFalse(p.allowed('https://example.invalid/a'))
        self.assertTrue(p.allowed('https://example.invalid/ab'))
        self.assertFalse(p.allowed('https://example.invalid/~private'))
    def test_specific_groups_merge_and_delay_applies(self):
        p=RobotsPolicy('User-agent: *\nDisallow: /\nUser-agent: research\nDisallow: /one\nCrawl-delay: 9\nUser-agent: research\nDisallow: /two','research/0.1')
        self.assertTrue(p.allowed('https://example.invalid/ok'))
        self.assertFalse(p.allowed('https://example.invalid/one'))
        self.assertFalse(p.allowed('https://example.invalid/two'));self.assertEqual(p.delay,9)


class StoreTests(unittest.TestCase):
    def setUp(self):
        base=Path(__file__).resolve().parents[2]/'.test-tmp';base.mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(prefix='hotdeals-',dir=base);self.path=Path(self.temp.name)
        self.assertTrue(self.path.resolve().is_relative_to(base.resolve()));self.addCleanup(self.temp.cleanup)
        self.store=Store(self.path);self.addCleanup(self.store.close)
        self.job=self.store.new_job(datetime(2026,5,18,tzinfo=KST),NOW,['quasarzone'])
    def rows(self,**kw):return quasarzone(fixture(**kw),NOW)[0]
    def test_no_duplicate_posts_or_observations_and_no_current_price(self):
        rows=self.rows();self.store.ingest_page(self.job['id'],'quasarzone',1,rows,mode='import')
        rows[0]['observed_at']=(NOW+timedelta(seconds=5)).isoformat()
        self.store.ingest_page(self.job['id'],'quasarzone',1,rows,mode='import')
        self.assertEqual(len(self.store.records(self.job['id'])),1)
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM observations').fetchone()[0],1)
        self.assertIsNone(self.store.records(self.job['id'])[0]['current_price'])
        self.assertFalse(self.store.summary(self.job['id'])['all_sources_window_complete'])
    def test_changed_community_price_is_separate_observation_not_live_price(self):
        self.store.ingest_page(self.job['id'],'quasarzone',1,self.rows(),mode='import')
        self.store.ingest_page(self.job['id'],'quasarzone',1,self.rows(price='￦388,000'),mode='import')
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM observations').fetchone()[0],2)
        self.assertIsNone(self.store.records(self.job['id'])[0]['merchant_verified_at'])
    def test_two_old_pages_required_not_one_pinned_or_old_post(self):
        self.store.ingest_page(self.job['id'],'quasarzone',1,self.rows(date='26.05.17'))
        self.assertEqual(self.store.progress(self.job['id'])[0]['state'],'running')
        self.store.ingest_page(self.job['id'],'quasarzone',2,self.rows(post_id='101',date='26.05.16'))
        self.assertTrue(self.store.summary(self.job['id'])['all_sources_window_complete'])
    def test_unknown_date_never_becomes_completed_coverage(self):
        self.store.ingest_page(self.job['id'],'quasarzone',1,self.rows(date='unknown'),has_next=False)
        self.assertEqual(self.store.progress(self.job['id'])[0]['state'],'date-review-needed')
        self.assertFalse(self.store.summary(self.job['id'])['all_sources_window_complete'])
    def test_repeated_page_halts_instead_of_fake_progress(self):
        self.store.ingest_page(self.job['id'],'quasarzone',1,self.rows())
        self.assertEqual(self.store.ingest_page(self.job['id'],'quasarzone',2,self.rows()),'pagination-stalled')
        self.assertEqual(self.store.progress(self.job['id'])[0]['next_page'],2)
    def test_import_does_not_advance_live_cursor_or_shift_window(self):
        self.store.ingest_page(self.job['id'],'quasarzone',100,self.rows(),mode='import')
        self.assertEqual(self.store.progress(self.job['id'])[0]['next_page'],1)
        self.assertEqual(ensure_job(self.store)['since'],self.job['since'])
        with self.assertRaises(ValueError):ensure_job(self.store,since='2026-06-01')
    def test_empty_input_and_mixed_origin_do_not_remove_saved_data(self):
        self.store.ingest_page(self.job['id'],'quasarzone',1,self.rows(),mode='import')
        before=self.store.records(self.job['id'])
        for rows in [[],[dict(self.rows()[0],source='ppomppu')]]:
            with self.assertRaises(ValueError):self.store.ingest_page(self.job['id'],'quasarzone',2,rows)
        self.assertEqual(self.store.records(self.job['id']),before)
    def test_file_lock_prevents_parallel_crawlers(self):
        with CrawlLock(self.path):
            with self.assertRaises(ValueError):
                with CrawlLock(self.path):pass
    def test_spreadsheet_formulas_and_html_are_escaped_and_current_queue_empty(self):
        rows=self.rows();rows[0]['title']='<script>bad()</script> TEST';self.store.ingest_page(self.job['id'],'quasarzone',1,rows,mode='import')
        export(self.store,self.job['id'])
        html=(self.path/'exports/report.html').read_text(encoding='utf-8')
        self.assertNotIn('<script>',html);self.assertIn('&lt;script&gt;',html)
        self.assertNotIn('NOT_TO_BE_SAVED',html)
        self.assertIn("'=CMD",csv_text(['title'],[{'title':'=CMD'}]))
        import csv
        with (self.path/'exports/verification-queue.csv').open(encoding='utf-8-sig',newline='') as f:
            row=next(csv.DictReader(f));self.assertEqual(row['current_price'],'');self.assertEqual(row['checked_at'],'')
    def test_network_denial_stops_and_resume_starts_at_unfinished_page(self):
        calls=[]
        class Fake:
            fail=True
            def __init__(self,*_):pass
            def load_robots(self):return RobotsPolicy('User-agent: *\nAllow: /','test')
            def get(self,url):
                page=int(parse_qs(urlsplit(url).query)['page'][0]);calls.append(page)
                if self.fail and page==2:raise CrawlStop('HTTP 403')
                return fixture(post_id=str(100+page),date={1:'26.06.20',2:'26.05.17',3:'26.05.16'}[page],page=page)
        first=crawl(self.store,self.job['id'],transport_factory=Fake,max_pages=5)
        self.assertEqual(calls,[1,2]);self.assertEqual(first['sources'][0]['next_page'],2)
        self.assertFalse(first['all_sources_window_complete'])
        Fake.fail=False
        result=crawl(self.store,self.job['id'],transport_factory=Fake,max_pages=5)
        self.assertEqual(calls,[1,2,2,3]);self.assertTrue(result['all_sources_window_complete'])
    def test_robots_denial_sends_no_page_requests(self):
        class Fake:
            def __init__(self,*_):pass
            def load_robots(self):return RobotsPolicy('User-agent: *\nDisallow: /','research')
            def get(self,url):raise AssertionError('No page fetch permitted')
        result=crawl(self.store,self.job['id'],transport_factory=Fake)
        self.assertEqual(result['sources'][0]['state'],'robots-denied')
    def test_reclassification_preserves_observation_time_and_current_price_unknown(self):
        rows=self.rows(title='B850M 메인보드 래플',price='￦20,000')
        rows[0]['offer_kind']='listing';rows[0]['price_amount']='20000'
        self.store.ingest_page(self.job['id'],'quasarzone',1,rows,mode='import')
        self.store.reclassify(self.job['id'])
        saved=self.store.records(self.job['id'])[0]
        self.assertEqual(saved['observed_at'],rows[0]['observed_at']);self.assertIsNone(saved['price_amount']);self.assertIsNone(saved['current_price'])
    def test_interpretation_change_does_not_add_a_price_observation_on_revisit(self):
        rows=self.rows(title='B850M 메인보드 래플',price='￦20,000')
        rows[0]['offer_kind']='listing';rows[0]['price_amount']='20000'
        self.store.ingest_page(self.job['id'],'quasarzone',1,rows,mode='import')
        self.store.reclassify(self.job['id'])
        self.store.ingest_page(self.job['id'],'quasarzone',1,self.rows(title='B850M 메인보드 래플',price='￦20,000'),mode='import')
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM observations').fetchone()[0],1)


class LocalServerTests(unittest.TestCase):
    def setUp(self):
        base=Path(__file__).resolve().parents[2]/'.test-tmp';base.mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(prefix='hotdeal-ui-',dir=base);self.path=Path(self.temp.name)
        self.assertTrue(self.path.resolve().is_relative_to(base.resolve()));self.addCleanup(self.temp.cleanup)
        self.http,self.app=local_server.create_server(self.path,0)
        self.port=self.http.server_port;self.origin=f'http://127.0.0.1:{self.port}'
        self.thread=threading.Thread(target=self.http.serve_forever,daemon=True);self.thread.start();self.addCleanup(self.cleanup_http)
    def cleanup_http(self):
        self.app.stop.set()
        if self.app.running():self.app.worker.join(timeout=2)
        self.http.shutdown();self.thread.join(timeout=2);self.http.server_close()
    def request(self,method,path,body=None,headers=None):
        from http.client import HTTPConnection
        connection=HTTPConnection('127.0.0.1',self.port,timeout=4)
        try:
            connection.request(method,path,body=body,headers=headers or {})
            response=connection.getresponse();return response.status,dict(response.getheaders()),response.read()
        finally:connection.close()
    def test_root_and_exports_are_local_no_store_and_csv_has_utf8_bom(self):
        status,headers,body=self.request('GET','/')
        self.assertEqual(status,200);self.assertEqual(headers['Cache-Control'],'no-store')
        self.assertIn('6개월 전체 수집은 아직 완료되지 않았습니다.'.encode(),body)
        status,headers,body=self.request('GET','/exports/deals.csv')
        self.assertEqual(status,200);self.assertTrue(body.startswith(b'\xef\xbb\xbf'))
        self.assertEqual(self.request('GET','/exports/../../README.md')[0],404)
    def test_cross_origin_and_missing_csrf_cannot_start_collection(self):
        headers={'Origin':'https://example.invalid','Content-Type':'application/x-www-form-urlencoded'}
        self.assertEqual(self.request('POST','/start','csrf=bad',headers)[0],403)
        headers['Origin']=self.origin
        self.assertEqual(self.request('POST','/start','csrf=bad',headers)[0],403)
        self.assertFalse(self.app.running())
        self.assertEqual(self.request('GET','/',headers={'Host':'evil.invalid'})[0],403)
    def test_start_and_stop_controls_work_without_any_external_request(self):
        from urllib.parse import urlencode
        entered=threading.Event()
        def fake_crawl(store,job_id,stop):entered.set();stop.wait(2)
        body=urlencode({'csrf':self.app.csrf});headers={'Origin':self.origin,'Content-Type':'application/x-www-form-urlencoded'}
        with patch.object(local_server,'crawl',fake_crawl):
            self.assertEqual(self.request('POST','/start',body,headers)[0],303)
            self.assertTrue(entered.wait(2));self.assertTrue(self.app.running())
            self.assertEqual(self.request('POST','/stop',body,headers)[0],303)
            self.app.worker.join(timeout=3);self.assertFalse(self.app.running())


if __name__=='__main__':unittest.main()
