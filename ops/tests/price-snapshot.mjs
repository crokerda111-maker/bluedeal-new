import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {getPublicPriceSnapshot} from '../../src/lib/priceSnapshot.ts';

const root=new URL('../../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const contract=read('src/content/priceSnapshot.schema.json');
const meta=read('src/content/prices/meta.json');
const categories=contract.categories.map(key=>read(`src/content/prices/${key}.json`));
const outbound=read('src/content/outbound.generated.json');
const snapshot=(m=meta,c=categories,o=outbound)=>getPublicPriceSnapshot(m,c,o,contract);

test('public fingerprint is stable across input order without changing original price data',()=>{
  const before=JSON.stringify({meta,categories,outbound});
  const a=snapshot();
  const reordered=[...categories].reverse().map(category=>({...category,items:[...category.items].reverse()}));
  assert.equal(snapshot(meta,reordered,Object.fromEntries(Object.entries(outbound).reverse())).snapshotHash,a.snapshotHash);
  assert.equal(JSON.stringify({meta,categories,outbound}),before);
  assert.match(a.snapshotHash,/^[a-f0-9]{64}$/);
  assert.equal(a.itemCount,categories.reduce((n,c)=>n+c.items.length,0));
});

test('price, option, seller, delivery and real observation time changes cannot pass as the same deployment',()=>{
  const original=snapshot().snapshotHash;
  for(const [field,value] of [['price',999],['seller','DIFFERENT SELLER'],['shippingFee',987],['capacityGB',7],['moduleCount',3],['checkedAt','2026-11-17T00:00:00+09:00'],['priceNote','different terms']]){
    const changed=structuredClone(categories);changed.find(c=>c.items.length).items[0][field]=value;
    assert.notEqual(snapshot(meta,changed).snapshotHash,original,field);
  }
  const changed=structuredClone(outbound);const code=Object.keys(changed)[0];
  changed[code].originalUrl+='&different-option=1';
  assert.notEqual(snapshot(meta,categories,changed).snapshotHash,original);
  const renamed=structuredClone(outbound);renamed['DIFFERENT-ROUTE']=renamed[code];delete renamed[code];
  assert.notEqual(snapshot(meta,categories,renamed).snapshotHash,original);
});

test('status summaries do not expose original shopping URLs, account fields or redirect mappings',()=>{
  const status=snapshot();
  assert.deepEqual(Object.keys(status).sort(),['categories','generatedAt','itemCount','schedule','schemaVersion','service','snapshotHash','updatedAt']);
  const text=JSON.stringify(status);
  for(const forbidden of ['originalUrl','password','token','affiliateUrl','https://item.gmarket.co.kr'])assert.equal(text.includes(forbidden),false);
});

test('coupon and card conditions, dates and dependencies affect the deployment fingerprint',()=>{
  for(const [field,value] of [['instantPrice',100],['instantNote','members only'],['instantEndsAt','2026-11-28T04:00:00+09:00'],['couponPrice',123],['couponNote','changed eligibility'],['couponEndsOn','2026-11-25'],['cardPrice',111],['cardNote','changed card'],['cardEndsOn','2026-11-30'],['cardRequiresCoupon',true]]){
    const changed=structuredClone(categories);const item=changed.find(c=>c.category==='ram').items[0];item[field]=value;
    assert.notEqual(snapshot(meta,changed).snapshotHash,snapshot().snapshotHash,field);
  }
});

test('Python publisher and Node runtime produce identical fingerprints for Unicode and IEEE-754 number spellings',()=>{
  const fixtures=[{meta,categories,outbound,contract}];
  for(const value of [0,-0,1,1.2,1e-7,1e22]){
    const modified=structuredClone(categories);const item=modified.find(c=>c.items.length).items[0];
    item.change24hPct=value;item.name='가상 상호 운용 검사 🧪';
    fixtures.push({meta,categories:modified,outbound,contract});
  }
  const script='import json,sys; from price_snapshot import public_price_snapshot; rows=json.load(sys.stdin); print(json.dumps([public_price_snapshot(r["meta"],r["categories"],r["outbound"],r["contract"]) for r in rows],ensure_ascii=True))';
  const result=spawnSync('python',['-c',script],{input:JSON.stringify(fixtures),encoding:'utf8',windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONPATH:fileURLToPath(new URL('ops/collector',root))}});
  assert.equal(result.status,0,result.error?.code??'PYTHON_FINGERPRINT_FAILED');
  const python=JSON.parse(result.stdout);
  fixtures.forEach((row,index)=>assert.deepEqual(python[index],getPublicPriceSnapshot(row.meta,row.categories,row.outbound,row.contract)));
});

test('ambiguous categories and unsupported scalar objects are rejected',()=>{
  assert.throws(()=>snapshot(meta,[...categories,categories[0]]),/INVALID_PRICE_SNAPSHOT_CATEGORIES/);
  const changed=structuredClone(categories);changed.find(c=>c.items.length).items[0].price={amount:123};
  assert.throws(()=>snapshot(meta,changed),/INVALID_PRICE_SNAPSHOT_SCALAR/);
});
