import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { searchCatalog, summarizeCatalog, catalogHref } from '../../src/lib/productCatalog.ts';

const catalog=JSON.parse(fs.readFileSync(new URL('../../src/content/products/catalog.json',import.meta.url),'utf8'));
const products=catalog.products;

test('every exported entry has stable unique page and management identifiers',()=>{
  assert.equal(products.length,catalog.entries);
  assert.equal(new Set(products.map(p=>p.id)).size,products.length);
  assert.equal(new Set(products.map(p=>p.referenceCode)).size,products.length);
  assert.ok(products.every(p=>/^[a-z0-9-]+$/.test(p.id)&&/^BD-[A-F0-9]{10}$/.test(p.referenceCode)));
});

test('case photos use exact catalog options and reviewed default components',()=>{
  const editorial=JSON.parse(fs.readFileSync(new URL('../../src/content/products/editorial.json',import.meta.url),'utf8')).entries;
  const reviews=JSON.parse(fs.readFileSync(new URL('../../src/content/fullPcReviews.json',import.meta.url),'utf8'));
  const cases=editorial.filter(entry=>entry.photo);
  const catalogIds=editorial.flatMap(entry=>entry.catalogIds??[]);
  const partNames=editorial.flatMap(entry=>entry.partNames??[]);
  assert.equal(new Set(catalogIds).size,catalogIds.length);
  assert.equal(new Set(partNames).size,partNames.length);
  assert.ok(catalogIds.every(id=>products.some(p=>p.id===id)));
  assert.ok(reviews.every(review=>cases.some(entry=>entry.partNames?.includes(review.parts.case))));
  const black=cases.find(entry=>entry.catalogIds?.includes('distributor-seorin-1000008774')).photo;
  const white=cases.find(entry=>entry.catalogIds?.includes('distributor-seorin-1000008773')).photo;
  assert.notEqual(black.src,white.src);
  assert.match(black.alt,/블랙/);
  assert.match(white.alt,/화이트/);
  const shopPhotos=JSON.parse(fs.readFileSync(new URL('../../src/content/products/casePhotos.json',import.meta.url),'utf8'));
  const detailedPhotos=new Set(cases.flatMap(entry=>entry.catalogIds??[]));
  assert.ok(Object.keys(shopPhotos).every(id=>products.some(p=>p.id===id&&p.category==='case')&&!detailedPhotos.has(id)));
  for(const [id,photo] of Object.entries(shopPhotos)){
    const product=products.find(p=>p.id===id);
    assert.equal(photo.alt,product.name+' 케이스 외관');
    assert.equal(photo.source,product.sources[0].url);
    assert.equal(new URL(photo.src).protocol,'https:');
  }
  for(const entry of cases){
    assert.equal(new URL(entry.photo.src).protocol,'https:');
    assert.equal(new URL(entry.photo.source).protocol,'https:');
    assert.ok(entry.advantage&&entry.caution);
  }
});

test('models, wattage options and families are counted separately',()=>{
  const summary=summarizeCatalog(products);
  assert.equal(summary.models+summary.outputOptions+summary.families,summary.entries);
  assert.equal(summary.discontinued,38);
  const reviewedCooling=JSON.parse(fs.readFileSync(new URL('../../src/content/products/reviewed-cooling.json',import.meta.url),'utf8'));
  const retail=JSON.parse(fs.readFileSync(new URL('../../src/content/products/distributor-retail-reviewed.json',import.meta.url),'utf8'));
  assert.equal(summary.categoryCounts.cooler,242+reviewedCooling.length+retail.additions.filter(p=>p.category==='cooler').length);
  const reviewedCpus=JSON.parse(fs.readFileSync(new URL('../../src/content/products/reviewed-cpus.json',import.meta.url),'utf8'));
  assert.equal(summary.categoryCounts.cpu,reviewedCpus.length+1); // Separate Intel issue dossier.
});

test('all pages of the catalog expose every entry exactly once',()=>{
  const ids=[];const first=searchCatalog(products,{});
  for(let page=1;page<=first.totalPages;page++) ids.push(...searchCatalog(products,{page:String(page)}).items.map(p=>p.id));
  assert.equal(ids.length,products.length);assert.equal(new Set(ids).size,products.length);
});

test('category, brand and excluded discontinued filter compose without implying stock',()=>{
  const psus=searchCatalog(products,{category:'psu',brand:'Seasonic',lifecycle:'exclude-discontinued'},1000);
  assert.equal(psus.total,53);
  assert.ok(psus.items.every(p=>p.lifecycle==='listed-current'&&p.domesticState==='unverified'));
});

test('Unicode-normalized multiple search terms match names and known features',()=>{
  const a=searchCatalog(products,{q:'ＰＥＥＲＬＥＳＳ black',category:'cooler'},1000);
  assert.ok(a.total>0);assert.ok(a.items.every(p=>p.name.toLowerCase().includes('peerless')&&p.name.toLowerCase().includes('black')));
  const b=searchCatalog(products,{q:'CPU 공랭',category:'cooler'},1000);
  assert.ok(b.total>0);
  assert.ok(b.items.every(p=>p.subtype==='cpu-air-cooler'));
  assert.ok(b.items.some(p=>p.id==='reviewed-thermalright-pa120-se-refurb-retailer'));
  assert.deepEqual(b.items.map(p=>p.id),searchCatalog(products,{q:'공랭 CPU',category:'cooler'},1000).items.map(p=>p.id));
});

test('invalid pages and duplicate query values are bounded and deterministic',()=>{
  for(const page of ['-1','1.5','Infinity','999999999999', ['2','3']]) assert.equal(searchCatalog(products,{page}).page,1);
  assert.equal(searchCatalog(products,{page:'999999'}).page,searchCatalog(products,{}).totalPages);
  assert.equal(searchCatalog(products,{category:'not-a-category'}).total,0);
  assert.equal(searchCatalog(products,{category:['cpu','gpu']}).total,products.length);
});

test('pagination links preserve filters and escape text as query parameters',()=>{
  const href=catalogHref({q:'RAM & DDR5',category:'ram',brand:'G.SKILL',lifecycle:''},2);
  const url=new URL(href,'https://bluedeal.co.kr');
  assert.equal(url.searchParams.get('q'),'RAM & DDR5');assert.equal(url.searchParams.get('page'),'2');
});

test('public records do not invent current prices, stock, ratings or reviewed buyer sentiment',()=>{
  for(const product of products){
    assert.equal(product.reviewSummary,null);
    assert.equal(product.reviewSources.length,0);
    for(const field of ['price','rating','score','stock','affiliateUrl','goCode','qualityScore']) assert.ok(!(field in product));
    assert.ok(product.sources.length>0);
    for(const source of product.sources){const url=new URL(source.url);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');}
  }
});

test('the reviewed Intel issue belongs only to the exact Intel model',()=>{
  const reviewed=products.filter(p=>p.issues.length);
  assert.equal(reviewed.length,1);assert.equal(reviewed[0].id,'intel-core-i7-14700k');
  assert.ok(reviewed[0].issues[0].conditions.includes('모든 개별 CPU'));
});

test('case families and mismatched PSU labels retain visible uncertainty',()=>{
  assert.ok(products.filter(p=>p.kind==='product-family').every(p=>p.notes.some(note=>note.includes('제품군'))));
  assert.ok(products.some(p=>p.category==='psu'&&p.notes.some(note=>note.includes('출력'))));
});
