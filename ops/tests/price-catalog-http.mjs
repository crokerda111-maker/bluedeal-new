// Read-only checks for the actual prices entry point, including unpriced products.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.BLUEDEAL_CATALOG_TEST_URL ?? 'http://127.0.0.1:3100';
const catalog = JSON.parse(await fs.readFile(new URL('../../src/content/products/catalog.json', import.meta.url), 'utf8'));
const categories = ['ram', 'cpu', 'ssd', 'motherboard', 'gpu', 'cooler', 'psu', 'case', 'hdd', 'halfpc', 'fullpc'];
const ids = html => [...html.matchAll(/data-product-id="([a-z0-9-]+)"/g)].map(match => match[1]);
let requests = 0;
async function get(route, status = 200) {
  const response = await fetch(base + route, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(25000) });
  requests++;
  assert.equal(response.status, status, route);
  return response.text();
}

const hub = await get('/prices');
assert.ok(hub.includes('상품·가격현황'));
assert.ok(hub.includes('등록 상품·옵션·제품군'));
assert.ok(hub.includes('판매처 가격 기록'));
for (const category of categories) assert.ok(hub.includes(`href="/prices/${category}"`), category);

const seen = [];
await Promise.all(categories.map(async category => {
  const expected = catalog.products.filter(product => product.category === category);
  const found = [];
  for (let page = 1; page <= Math.max(1, Math.ceil(expected.length / 12)); page++) {
    const html = await get(`/prices/${category}${page > 1 ? `?catalogPage=${page}` : ''}`);
    assert.ok(html.includes('id="registered-products"'), category);
    assert.ok(html.includes('id="price-records"'), category);
    found.push(...ids(html));
    if (!expected.length) assert.ok(html.includes('상품 목록부터 수집하고 있습니다'), category);
  }
  assert.deepEqual(found.sort(), expected.map(product => product.id).sort(), category);
  seen.push(...found);
}));
assert.equal(new Set(seen).size, catalog.products.length);

const filtered = await get('/prices/cooler?catalogQ=PEERLESS%20black&catalogPage=2');
assert.ok(ids(filtered).length > 0);
for (const id of ids(filtered)) {
  const product = catalog.products.find(product => product.id === id);
  assert.equal(product.category, 'cooler');
  assert.match(product.name, /peerless/i);
  assert.match(product.name, /black/i);
}
const psus = await get('/prices/psu?catalogLifecycle=exclude-discontinued');
for (const id of ids(psus)) assert.notEqual(catalog.products.find(product => product.id === id).lifecycle, 'listed-discontinued');
assert.equal(ids(await get('/prices/cooler?catalogQ=NO_SUCH_PRODUCT_9383')).length, 0);
assert.deepEqual(ids(await get('/prices/cooler?catalogPage=-1')), ids(await get('/prices/cooler')));
await get('/prices/no-such-category', 404);

const prices = JSON.parse(await get('/api/prices/status'));
const gpuItems=JSON.parse(await fs.readFile(new URL('../../src/content/prices/gpu.json',import.meta.url),'utf8')).items;
const gpuStandard=await get('/prices/gpu');
const gpuRefurbished=await get('/prices/gpu?condition=refurbished');
const gpuAll=await get('/prices/gpu?condition=all');
for(const item of gpuItems){
  assert.equal(gpuStandard.includes(`id="${item.id}"`),item.condition!=='refurbished');
  assert.equal(gpuRefurbished.includes(`id="${item.id}"`),item.condition==='refurbished');
  assert.ok(gpuAll.includes(`id="${item.id}"`));
  if(item.condition==='refurbished'){
    assert.ok(gpuRefurbished.includes('리퍼·벌크 · 보증기간 별도 확인'));
    const response=await fetch(`${base}/go/${item.goCode}`,{redirect:'manual',signal:AbortSignal.timeout(25000)});requests++;
    assert.equal(response.status,302);assert.ok(response.headers.get('location').startsWith('https://www.redbitmall.com/goods/goods_view.php?goodsNo='));
  }
}
const contract = JSON.parse(await fs.readFile(new URL('../../src/content/priceSnapshot.schema.json', import.meta.url), 'utf8'));
const priceRecords = (await Promise.all(contract.categories.map(async category => JSON.parse(await fs.readFile(new URL(`../../src/content/prices/${category}.json`, import.meta.url), 'utf8')).items.length))).reduce((a, b) => a + b, 0);
assert.equal(prices.itemCount, priceRecords);
assert.equal(prices.categories.length, contract.categories.length);
const data = JSON.parse(await get('/api/products/status'));
assert.equal(data.catalogHash, catalog.catalogHash);
console.log(JSON.stringify({ base, requests, categories: categories.length, entriesReachableFromPrices: seen.length, uniqueEntries: new Set(seen).size, priceRecords, priceSnapshotHash: prices.snapshotHash, catalogHash: data.catalogHash, publicWrites: 0 }));
