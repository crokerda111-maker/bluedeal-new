"""Catalog identity boundaries, read-only merge, and private export invariants."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('bluedeal_candidate_index',ROOT/'ops/maintenance/candidate_index.py')
catalog=importlib.util.module_from_spec(spec);spec.loader.exec_module(catalog)
TEMP=ROOT/'.test-tmp';TEMP.mkdir(exist_ok=True)


def row(post_id='1',observed='2026-11-18T20:00:00+09:00',title='Synthetic 9800X3D',archive='old',price='KRW 999999'):
    return {'source':'quasarzone','post_id':post_id,'post_url':'https://quasarzone.com/bbs/qb_saleinfo/views/'+post_id,'category':'cpu','title':title,'candidate_key':'title-candidate-only','observed_at':observed,'price_text':price,'_provenance':{'archive':archive,'job_id':1,'observed_at':observed,'window_status':'in-window'}}


class CatalogTests(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory(prefix='catalog-',dir=TEMP);self.root=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()

    def test_only_same_source_and_post_id_are_deduplicated(self):
        older=row();newer=row(observed='2026-11-20T17:00:00+09:00',archive='recent',price='KRW 888888')
        separate=row(post_id='2')
        result=catalog.merge_posts([newer,separate,older])
        self.assertEqual(len(result),2);self.assertEqual(result[0]['price_text'],'KRW 888888');self.assertEqual(len(result[0]['provenance']),2)
        self.assertEqual(result[0]['observed_at'],'2026-11-20T17:00:00+09:00')

    def test_same_titles_from_different_sources_are_not_the_same_post(self):
        a=row();b=row();b['source']='other-source'
        self.assertEqual(len(catalog.merge_posts([a,b])),2)

    def test_reported_price_and_title_group_never_become_verified_sku_or_current_price(self):
        candidate=catalog.review_entry(catalog.merge_posts([row()])[0])
        for field in ('current_price_krw','merchant_url','shipping_krw','price_checked_at','internal_model_id'):self.assertIsNone(candidate[field])
        self.assertFalse(candidate['manufacturer_sku_verified']);self.assertEqual(candidate['reported_price_text'],'KRW 999999')

    def test_ram_alias_requires_same_capacity_kit_speed_timings_and_color(self):
        item={'category':'ram','name':'KLEVV CRAS V RGB WHITE DDR5-6000 CL30 48GB','capacityGB':48,'moduleCapacityGB':24,'moduleCount':2,'memoryType':'DDR5'}
        kit={**item,'name':item['name']+'(24GB×2)'}
        self.assertTrue(catalog.equivalent_ram(item,kit))
        for changed in [{**kit,'capacityGB':32},{**kit,'moduleCount':1},{**kit,'memoryType':None},{**kit,'name':kit['name'].replace('6000','6400')},{**kit,'name':kit['name'].replace('WHITE','BLACK')},{**kit,'name':kit['name'].replace('CL30','CL32')}]:
            self.assertFalse(catalog.equivalent_ram(item,changed))

    def test_explicit_retailer_alias_is_validated_not_inferred_from_a_suffix(self):
        source=next(iter(catalog.LISTING_ALIASES));target=catalog.LISTING_ALIASES[source]
        data={'category':'ram','items':[{'id':target,'name':'AGI TURBOJET UD858 RGB 블랙 DDR5-6000 CL30 48GB(24GB×2)','capacityGB':48,'moduleCapacityGB':24,'moduleCount':2,'memoryType':'DDR5'}]}
        data['items'].append({**data['items'][0],'id':source})
        directory=self.root/'src/content/prices';directory.mkdir(parents=True);file=directory/'ram.json';file.write_text(json.dumps(data),encoding='utf-8')
        listings,models=catalog.baseline_models(self.root);self.assertEqual(len(listings),2);self.assertEqual(len(models),1)
        data['items'][1]['name']=data['items'][1]['name'].replace('48GB','32GB');file.write_text(json.dumps(data),encoding='utf-8')
        with self.assertRaises(ValueError):catalog.baseline_models(self.root)

    def create_archive(self,label,entries):
        file=self.root/f'ops/private/{label}/hotdeals.sqlite3';file.parent.mkdir(parents=True)
        db=sqlite3.connect(file)
        try:
            db.executescript('CREATE TABLE jobs(id INTEGER,since TEXT,until TEXT,state TEXT); CREATE TABLE deals(source TEXT,post_id TEXT,payload TEXT); CREATE TABLE job_posts(job_id INTEGER,source TEXT,post_id TEXT,window_status TEXT); CREATE TABLE progress(job_id INTEGER,source TEXT,state TEXT); INSERT INTO jobs VALUES(1,"2026-05-20T00:00:00+09:00","2026-11-20T17:00:00+09:00","partial"); INSERT INTO progress VALUES(1,"quasarzone","boundary-reached");')
            for entry in entries:
                db.execute('INSERT INTO deals VALUES(?,?,?)',(entry['source'],entry['post_id'],json.dumps(entry)))
                db.execute('INSERT INTO job_posts VALUES(?,?,?,?)',(1,entry['source'],entry['post_id'],'in-window'))
            db.commit()
        finally:db.close()
        return file

    def test_real_archive_merge_keeps_sources_read_only_and_exports_unknowns_blank(self):
        original=self.create_archive('hotdeal-research',[row(title='=SYNTHETIC()')]);before=original.read_bytes()
        self.create_archive('hotdeal-watch',[row(observed='2026-11-20T17:00:00+09:00',title='=SYNTHETIC()',archive='recent')])
        result=catalog.build_index(self.root);self.assertEqual(result['input_pc_post_rows'],2);self.assertEqual(result['unique_pc_posts'],1)
        self.assertEqual(result['duplicate_post_rows_removed'],1);self.assertEqual(original.read_bytes(),before)
        output=self.root/'ops/private/catalog-review';csv=(output/'candidate-queue.generated.csv').read_text(encoding='utf-8-sig')
        self.assertIn("'=SYNTHETIC()",csv);self.assertIn('unverified',csv)
        candidate=json.loads((output/'candidates.local.json').read_text(encoding='utf-8'))[0]
        self.assertIsNone(candidate['current_price_krw']);self.assertIsNone(candidate['price_checked_at']);self.assertEqual(len(candidate['provenance']),2)

    def test_absent_sources_do_not_create_fake_databases_or_claim_collection_done(self):
        result=catalog.build_index(self.root)
        self.assertEqual(result['state'],'sources-pending');self.assertEqual(result['unique_pc_posts'],0)
        self.assertFalse((self.root/'ops/private/hotdeal-watch/hotdeals.sqlite3').exists())


if __name__=='__main__':unittest.main()
