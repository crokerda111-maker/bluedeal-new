import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyDistributorReview} from '../catalog/distributor-review.mjs';
const batch=JSON.parse(fs.readFileSync(new URL('../../src/content/products/distributor-reviewed.json',import.meta.url),'utf8'));
const catalog=JSON.parse(fs.readFileSync(new URL('../../src/content/products/catalog.json',import.meta.url),'utf8')).products;
const now=Date.now();
test('all reviewed options have stable unique identity, evidence and no invented prices or reviews',()=>{
  assert.equal(batch.additions.length,49);assert.equal(batch.enrichments.length,12);
  const added=new Set(batch.additions.map(p=>p.id));
  const original=catalog.filter(p=>!added.has(p.id));
  const result=applyDistributorReview(original,batch,now);
  assert.equal(result.length,original.length+49);
  assert.equal(new Set(result.map(p=>p.id)).size,result.length);
  for(const p of original)assert.deepEqual(result.find(x=>x.id===p.id).listings,p.listings);
  for(const p of batch.additions){assert.equal(p.reviewSummary,null);assert.equal(p.listings.length,0);assert.ok(p.facts.length>0);}
});
test('patches cannot alter identities, seller links, money or unknown products',()=>{
  const p={id:'sample',listings:[{id:'retained',pricePage:'/prices/ram'}],features:['original']};
  const source=batch.enrichments[0].sources;
  const attempt=extra=>applyDistributorReview([p],{schemaVersion:1,additions:[],enrichments:[{id:'sample',sources:source,...extra}]},now);
  for(const extra of [{listings:[]},{price:1},{brand:'changed'},{id:'absent'}])assert.throws(()=>attempt(extra));
  assert.deepEqual(p.features,['original']);
});
test('unsafe, undated and future source evidence cannot enter an export',()=>{
  for(const edit of [{url:'http://example.com'},{url:'https://a:b@example.com'},{url:'https://example.com?token=secret'},{observedAt:null},{observedAt:'2099-01-01'}]){
    const b=structuredClone(batch);Object.assign(b.additions[0].sources[0],edit);
    assert.throws(()=>applyDistributorReview(catalog.filter(p=>!p.id.startsWith('distributor-')),b,now));
  }
});
test('RAM kit counts and OC/colour variants remain explicit',()=>{
  for(const p of [...batch.additions,...batch.enrichments].filter(p=>p.facts?.some(f=>f.key==='modules'))){
    const facts=Object.fromEntries(p.facts.map(f=>[f.key,f.value]));
    assert.equal(facts.memory,'DDR5');assert.ok(Number(facts.modules)>0);assert.ok(Number(facts.capacity)>0);assert.ok(Number(facts.speed)>0);
  }
  assert.ok(batch.additions.some(p=>p.name.includes('BOLT V 화이트 패키지')&&!p.name.includes('AMD')));
  assert.ok(batch.enrichments.some(p=>p.id==='reviewed-klevv-bolt-v-white-amd-6400-cl32-32gb'));
});
