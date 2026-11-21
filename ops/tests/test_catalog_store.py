"""Private catalog import preserves identity uncertainty and operator decisions."""
import json
from contextlib import contextmanager
from pathlib import Path
import sqlite3
import tempfile
import unittest

from ops.catalog.store import bootstrap, merchant_identity

ROOT = Path(__file__).resolve().parents[2]
TEMP = ROOT / '.test-tmp'
TEMP.mkdir(exist_ok=True)


class CatalogStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='catalog-store-', dir=TEMP)
        self.root = Path(self.tmp.name)
        (self.root / 'src/content/prices').mkdir(parents=True)
        (self.root / 'ops/collector').mkdir(parents=True)
        self.items = [{'id': 'synthetic-ram', 'name': 'Synthetic RAM DDR5-6000 CL30 32GB',
                       'capacityGB': 32, 'moduleCapacityGB': 16, 'moduleCount': 2, 'memoryType': 'DDR5',
                       'price': 999999, 'goCode': 'DO-NOT-IMPORT', 'checkedAt': '2026-11-18T01:00:00Z',
                       'officialUrl': 'https://manufacturer.example.invalid/product'}]
        self.catalog = [{'id': 'synthetic-ram', 'category': 'ram', 'seller': 'Synthetic seller',
                         'capacityGB': 32, 'moduleCapacityGB': 16, 'moduleCount': 2, 'memoryType': 'DDR5',
                         'sourceUrl': 'https://item.gmarket.co.kr/Item?goodsCode=1'}]
        self.save()

    def tearDown(self): self.tmp.cleanup()

    def save(self):
        (self.root / 'src/content/prices/ram.json').write_text(json.dumps({'category': 'ram', 'items': self.items}), encoding='utf-8')
        (self.root / 'ops/collector/catalog.json').write_text(json.dumps({'products': self.catalog}), encoding='utf-8')

    @contextmanager
    def connect(self):
        database = sqlite3.connect(self.root / 'ops/private/catalog/catalog.sqlite3')
        try:
            with database:
                yield database
        finally:
            database.close()

    def test_import_creates_separate_identity_records_without_current_price_or_affiliate_claim(self):
        result = bootstrap(self.root)
        self.assertEqual((result['parts'], result['variants'], result['listings']), (1, 1, 1))
        self.assertEqual((result['price_observations'], result['benefit_versions'], result['affiliate_routes']), (0, 0, 0))
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT manufacturer_part_number,identity_state FROM parts').fetchone(), (None, 'curated-unverified'))
            self.assertEqual(db.execute('SELECT source_observed_at,verified_at FROM evidence').fetchone(), (None, None))
            payload = db.execute('SELECT payload_json FROM evidence').fetchone()[0]
            self.assertNotIn('DO-NOT-IMPORT', payload)
            self.assertNotIn('999999', payload)
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_repeat_import_is_idempotent_and_does_not_refresh_evidence_time(self):
        first = bootstrap(self.root)
        with self.connect() as db: before = db.execute('SELECT * FROM evidence').fetchall()
        self.assertEqual(bootstrap(self.root), first)
        with self.connect() as db: self.assertEqual(db.execute('SELECT * FROM evidence').fetchall(), before)

    def test_operator_verified_fields_are_not_overwritten(self):
        bootstrap(self.root)
        with self.connect() as db:
            db.execute("UPDATE parts SET display_name='Verified operator name',manufacturer_part_number='VERIFIED-MPN',identity_state='manufacturer-verified'")
            db.execute("UPDATE listings SET verification_state='verified'")
        bootstrap(self.root)
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT display_name,manufacturer_part_number FROM parts').fetchone(), ('Verified operator name', 'VERIFIED-MPN'))
            self.assertEqual(db.execute('SELECT verification_state FROM listings').fetchone()[0], 'verified')

    def test_changed_seller_stops_for_review_and_rolls_back_import(self):
        bootstrap(self.root)
        self.catalog[0]['seller'] = 'Changed seller'; self.save()
        with self.assertRaisesRegex(ValueError, 'REQUIRES_REVIEW'): bootstrap(self.root)
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT seller FROM listings').fetchone()[0], 'Synthetic seller')
            self.assertEqual(db.execute('SELECT count(*) FROM evidence').fetchone()[0], 1)

    def test_mismatched_options_or_missing_listing_reject_before_database_creation(self):
        self.catalog[0]['capacityGB'] = 48; self.save()
        with self.assertRaisesRegex(ValueError, 'OPTION_MISMATCH'): bootstrap(self.root)
        self.assertFalse((self.root / 'ops/private/catalog/catalog.sqlite3').exists())
        self.catalog = []; self.save()
        with self.assertRaisesRegex(ValueError, 'CATALOG_MISMATCH'): bootstrap(self.root)

    def test_unknown_schema_is_not_automatically_migrated_or_replaced(self):
        bootstrap(self.root)
        with self.connect() as db:
            db.execute('DROP TABLE schema_version'); db.execute('CREATE TABLE schema_version(version INTEGER)')
            db.execute('INSERT INTO schema_version VALUES(99)')
        with self.assertRaisesRegex(ValueError, 'UNSUPPORTED_CATALOG_SCHEMA'): bootstrap(self.root)
        with self.connect() as db: self.assertEqual(db.execute('SELECT version FROM schema_version').fetchone()[0], 99)

    def test_source_files_are_preserved_byte_for_byte(self):
        files = [self.root / 'src/content/prices/ram.json', self.root / 'ops/collector/catalog.json']
        before = [file.read_bytes() for file in files]
        bootstrap(self.root)
        self.assertEqual([file.read_bytes() for file in files], before)

    def test_only_explicit_official_merchant_product_urls_are_accepted(self):
        self.assertEqual(merchant_identity('https://item.gmarket.co.kr/Item?goodscode=123'), ('gmarket', '123'))
        self.assertEqual(merchant_identity('https://www.11st.co.kr/products/456'), ('11st', '456'))
        for url in ('https://item.gmarket.co.kr.evil.invalid/Item?goodsCode=1',
                    'https://user:password@item.gmarket.co.kr/Item?goodsCode=1',
                    'https://item.gmarket.co.kr/Item?goodsCode=1&affiliate=FAKE',
                    'https://www.11st.co.kr/products/456?tracking=FAKE'):
            with self.assertRaises(ValueError): merchant_identity(url)


if __name__ == '__main__': unittest.main()
