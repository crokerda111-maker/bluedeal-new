"""Publication boundaries: only selected factual fields, no private attributes."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from ops.catalog.export_site import export, feature_data, public_url

ROOT=Path(__file__).resolve().parents[2]
TEMP=ROOT/'.test-tmp'
TEMP.mkdir(exist_ok=True)


class PublicCatalogExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='public-catalog-',dir=TEMP)
        self.root=Path(self.tmp.name)
        (self.root/'src/content/prices').mkdir(parents=True)
        (self.root/'ops/collector').mkdir(parents=True)
        item={'id':'synthetic-ram','name':'Synthetic RAM','spec':'Synthetic option','officialUrl':'https://manufacturer.example.invalid/model',
              'capacityGB':32,'moduleCapacityGB':16,'moduleCount':2,'memoryType':'DDR5','price':123456,'shippingFee':3000,
              'checkedAt':'2026-11-18T12:00:00Z','source':'Synthetic merchant','goCode':'DO_NOT_EXPORT_GOCODE','adminPassword':'DO_NOT_EXPORT_PASSWORD'}
        (self.root/'src/content/prices/ram.json').write_text(json.dumps({'category':'ram','items':[item]}),encoding='utf-8')
        (self.root/'ops/collector/catalog.json').write_text(json.dumps({'products':[{'id':'synthetic-ram','seller':'Synthetic seller','sourceUrl':'https://item.gmarket.co.kr/Item?goodsCode=1'}]}),encoding='utf-8')
        self.private=self.root/'ops/private/catalog';self.private.mkdir(parents=True)
        with closing(sqlite3.connect(self.private/'catalog.sqlite3')) as db:
            db.executescript((ROOT/'ops/catalog/schema.sql').read_text(encoding='utf-8'))
            db.executescript((ROOT/'ops/catalog/discovery.sql').read_text(encoding='utf-8'))
            attrs={'subtype':'cpu-air-cooler','manufacturer_list_fields':{'data-color':'black','PRIVATE_TOKEN':'DO_NOT_EXPORT_TOKEN'},'account':'DO_NOT_EXPORT_ACCOUNT'}
            db.execute('INSERT INTO manufacturer_sources VALUES(?,?,?,?,?,?,?)',('synthetic','https://manufacturer.example.invalid','parsed-list-only','2026-11-20T12:00:00Z','2026-11-20T12:01:00Z','hash',1))
            db.execute('INSERT INTO manufacturer_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',('synthetic','model1','Synthetic brand','cooler','model','Synthetic cooler','https://manufacturer.example.invalid/cooler',json.dumps(attrs),'unknown','2026-11-20T12:00:00Z','2026-11-20T12:00:00Z',None,'unknown'))
            db.commit()

    def tearDown(self):self.tmp.cleanup()

    def test_export_does_not_publish_private_attributes_or_current_price_claims(self):
        result=export(self.root);self.assertEqual(result['baseCatalogEntries'],2)
        text=(self.private/'public-catalog.base.local.json').read_text(encoding='utf-8')
        self.assertNotIn('DO_NOT_EXPORT',text)
        data=json.loads(text)
        for product in data['products']:
            self.assertNotIn('price',product);self.assertNotIn('stock',product);self.assertIsNone(product['reviewSummary'])
        history=json.loads((self.private/'workbook-merchants.local.json').read_text(encoding='utf-8'))
        self.assertEqual(history[0]['recordedPriceKRW'],123456)
        self.assertEqual(history[0]['observedAt'],'2026-11-18T12:00:00Z')

    def test_original_database_and_price_files_are_unchanged(self):
        files=[self.private/'catalog.sqlite3',self.root/'src/content/prices/ram.json']
        before=[file.read_bytes() for file in files]
        export(self.root)
        self.assertEqual(before,[file.read_bytes() for file in files])

    def test_model_urls_reject_credentials_and_private_queries(self):
        for url in ['http://manufacturer.example.invalid/','https://user:password@manufacturer.example.invalid/','https://manufacturer.example.invalid/?token=synthetic-secret','javascript:alert(1)']:
            with self.assertRaises(ValueError):public_url(url)

    def test_unknown_manufacturer_category_is_not_silently_published(self):
        with self.assertRaises(ValueError):feature_data({'category':'unknown','attributes_json':'{}'})


if __name__=='__main__':unittest.main()
