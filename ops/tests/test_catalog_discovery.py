"""Synthetic manufacturer lists, guarded transport and honest coverage accounting."""
from contextlib import closing
from datetime import datetime, timezone
from email.message import Message
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
import urllib.error

from ops.catalog.discovery import ingest, parse_source
from ops.catalog.public_fetch import PublicFetch, SourceStopped, USER_AGENT

ROOT = Path(__file__).resolve().parents[2]
TEMP = ROOT / '.test-tmp'
TEMP.mkdir(exist_ok=True)


COOLERS = b'''<a class="product-card-item product_cat-dual-towers post-1 instock" href="https://www.thermalright.com/product/fictional-black/" data-color="black"><h3 class="product-card-name">Fictional BLACK</h3></a>
<a class="product-card-item product_cat-ssd-cooler post-2" href="https://www.thermalright.com/product/fictional-ssd/"><h3 class="product-card-name">Fictional SSD Cooler</h3></a>'''
PSUS = b'''<li><a href="/power-supplies/filter/product_cat-focus-series/">FOCUS Series</a><div class="product-list"><a class="item" href="https://seasonic.com/fictional-current/"><span class="s-title">Fictional ATX 3.1</span><div class="wattage"><span>750 W</span><span>850 W</span></div></a></div></li>
<li><a href="https://seasonic.com/discontinued-products/">Discontinued Products</a><div class="product-list"><a class="item" href="https://seasonic.com/fictional-old/"><span class="s-title">Fictional-750</span><div class="wattage"><span>750 W</span><span>850 W</span></div></a></div></li>'''
CASES = b'''<a href="/products/cases/fictional-series/fictional/"><p>Explore Fictional</p></a>
<a href="/products/cases/fictional-series/fictional/fictional-white/"><button>01</button><button>02</button><p>Fictional</p><p>Cases</p></a>'''


class DiscoveryParserTests(unittest.TestCase):
    def test_cooler_model_options_and_accessories_are_distinct_without_stock_claim(self):
        rows = parse_source('thermalright-cooler', COOLERS)
        self.assertEqual(len(rows), 2)
        self.assertEqual([row['attributes']['subtype'] for row in rows], ['cpu-air-cooler', 'ssd-heatsink'])
        self.assertTrue(all('price' not in row and 'availability' not in row for row in rows))

    def test_psu_output_options_and_discontinued_status_are_separate(self):
        rows = parse_source('seasonic-psu', PSUS)
        self.assertEqual(len(rows), 4)
        self.assertEqual([row['lifecycle'] for row in rows], ['listed-current'] * 2 + ['listed-discontinued'] * 2)
        self.assertTrue(rows[-1]['attributes']['name_wattage_conflict'])
        self.assertTrue(all(row['item_kind'] == 'listed-wattage-option' for row in rows))

    def test_case_family_is_not_multiplied_by_unverified_option_buttons(self):
        rows = parse_source('fractal-case', CASES)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['display_name'], 'Fictional')
        self.assertEqual(rows[0]['item_kind'], 'product-family')
        self.assertTrue(rows[0]['attributes']['exact_variants_pending'])

    def test_duplicate_identical_cards_deduplicate_but_conflicting_identity_stops(self):
        self.assertEqual(len(parse_source('thermalright-cooler', COOLERS + COOLERS)), 2)
        changed = COOLERS.replace(b'Fictional BLACK', b'Changed Name')
        with self.assertRaisesRegex(ValueError, 'CONFLICTING_SOURCE_IDENTITY'):
            parse_source('thermalright-cooler', COOLERS + changed)

    def test_empty_changed_or_challenge_pages_are_not_successful_catalogs(self):
        with self.assertRaises(ValueError): parse_source('thermalright-cooler', b'<html>No products here</html>')
        with self.assertRaises(SourceStopped): parse_source('asrock-board', b'<script src="/_Incapsula_Resource?example"></script>')

    def test_cross_origin_product_link_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'PRODUCT_URL'):
            parse_source('thermalright-cooler', COOLERS.replace(b'www.thermalright.com', b'fake.example.invalid'))


class DiscoveryIngestTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='manufacturer-ingest-', dir=TEMP)
        self.root = Path(self.tmp.name)
        self.directory = self.root / 'ops/private/catalog'
        self.probes = self.directory / 'source-probes'
        self.probes.mkdir(parents=True)
        with closing(sqlite3.connect(self.directory / 'catalog.sqlite3')) as db:
            db.executescript((ROOT / 'ops/catalog/schema.sql').read_text(encoding='utf-8'))
        self.records = []
        for source, raw in [('thermalright-cooler', COOLERS), ('seasonic-psu', PSUS), ('fractal-case', CASES)]:
            (self.probes / (source + '.html')).write_bytes(raw)
            self.records.append({'source': source, 'url': 'https://manufacturer.example.invalid/catalog', 'state': 'fetched',
                                 'retrieved_at': '2026-11-20T12:00:00+00:00', 'sha256': hashlib.sha256(raw).hexdigest()})
        self.save()

    def save(self):
        (self.probes / 'manifest.local.json').write_text(json.dumps(self.records), encoding='utf-8')

    def tearDown(self): self.tmp.cleanup()

    def test_ingestion_counts_source_entries_without_claiming_domestic_skus_or_prices(self):
        result = ingest(self.root)
        self.assertEqual(result['manufacturer_list_entries'], 7)
        self.assertEqual(result['listed_discontinued_psu_options'], 2)
        self.assertEqual(result['listed_current_psu_options'], 2)
        self.assertEqual(result['domestic_confirmed'], 0)
        self.assertEqual(result['price_observations'], 0)
        self.assertIsNone(result['unique_verified_domestic_skus'])
        with closing(sqlite3.connect(self.directory / 'catalog.sqlite3')) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM parts').fetchone()[0], 0)
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_repeat_parse_preserves_observed_times_operator_flags_and_history(self):
        ingest(self.root)
        with closing(sqlite3.connect(self.directory / 'catalog.sqlite3')) as db:
            db.execute("UPDATE manufacturer_items SET domestic_state='confirmed' WHERE source_id='fractal-case'")
            db.commit()
            original = db.execute('SELECT first_seen_at,last_seen_at FROM manufacturer_items').fetchall()
        result = ingest(self.root)
        self.assertEqual(result['domestic_confirmed'], 1)
        with closing(sqlite3.connect(self.directory / 'catalog.sqlite3')) as db:
            self.assertEqual(db.execute('SELECT first_seen_at,last_seen_at FROM manufacturer_items').fetchall(), original)
            self.assertEqual(db.execute('SELECT count(*) FROM manufacturer_item_observations').fetchone()[0], 7)

    def test_mutated_raw_snapshot_is_rejected_before_any_catalog_changes(self):
        (self.probes / 'fractal-case.html').write_bytes(b'Changed data')
        with self.assertRaisesRegex(ValueError, 'HASH_MISMATCH'): ingest(self.root)
        with closing(sqlite3.connect(self.directory / 'catalog.sqlite3')) as db:
            self.assertFalse(db.execute("SELECT name FROM sqlite_master WHERE name='manufacturer_items'").fetchall())

    def test_blocked_sources_are_reported_and_never_create_models(self):
        self.records.append({'source': 'blocked-board', 'url': 'https://manufacturer.example.invalid/', 'state': 'http-403-stopped', 'retrieved_at': '2026-11-20T12:00:00+00:00'})
        self.save()
        result = ingest(self.root)
        self.assertEqual(result['sources'][-1]['stored_items'], 0)
        self.assertEqual(result['sources'][-1]['state'], 'http-403-stopped')


class Response(io.BytesIO):
    def __init__(self, body, kind='text/html'):
        super().__init__(body)
        self.headers = Message(); self.headers['Content-Type'] = kind


class Opener:
    def __init__(self, responses): self.responses = list(responses); self.requests = []
    def open(self, request, timeout):
        self.requests.append(request)
        response = self.responses.pop(0)
        if isinstance(response, Exception): raise response
        return response


class ManufacturerTransportTests(unittest.TestCase):
    def client(self, responses):
        self.opener = Opener(responses)
        self.delays = []
        return PublicFetch('https://manufacturer.example.invalid', opener=self.opener, wait=self.delays.append, clock=lambda: 0)

    def test_robots_denial_prevents_product_request(self):
        client = self.client([Response(b'User-agent: *\nDisallow: /', 'text/plain')])
        client.robots()
        with self.assertRaisesRegex(SourceStopped, 'robots-denied'): client.get(client.origin + '/products')
        self.assertEqual(len(self.opener.requests), 1)

    def test_honest_user_agent_and_delay_apply_without_cookie_or_authorization(self):
        client = self.client([Response(b'User-agent: *\nCrawl-delay: 5', 'text/plain'), Response(b'<html>Model</html>')])
        client.robots(); client.get(client.origin + '/products')
        self.assertEqual(self.delays, [5])
        headers = dict(self.opener.requests[-1].header_items())
        self.assertEqual(headers['User-agent'], USER_AGENT)
        self.assertNotIn('Authorization', headers); self.assertNotIn('Cookie', headers)

    def test_cross_origin_redirect_stops_before_second_request(self):
        error = urllib.error.HTTPError('https://manufacturer.example.invalid/robots.txt', 302, 'redirect', {'Location': 'https://other.example.invalid/robots.txt'}, None)
        client = self.client([error])
        with self.assertRaisesRegex(SourceStopped, 'cross-origin'): client.robots()
        self.assertEqual(len(self.opener.requests), 1)

    def test_200_challenge_and_http_rate_limit_are_not_retried(self):
        client = self.client([Response(b'<script src="/_Incapsula_Resource?example"></script>')])
        with self.assertRaisesRegex(SourceStopped, 'access-challenge'): client.robots()
        error = urllib.error.HTTPError('https://manufacturer.example.invalid/robots.txt', 429, 'limit', {}, None)
        client = self.client([error])
        with self.assertRaisesRegex(SourceStopped, '429'): client.robots()
        self.assertEqual(len(self.opener.requests), 1)

    def test_robots_flag_cannot_be_used_for_a_product_url(self):
        client = self.client([])
        with self.assertRaisesRegex(SourceStopped, 'invalid-robots-request'):
            client.get(client.origin + '/products', is_robots=True)


if __name__ == '__main__': unittest.main()
