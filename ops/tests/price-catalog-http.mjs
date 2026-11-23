// Read-only checks for the actual prices entry point, including unpriced products.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.BLUEDEAL_CATALOG_TEST_URL ?? 'http://127.0.0.1:3100';
const catalog = JSON.parse(await fs.readFile(new URL('../../src/content/products/catalog.json', import.meta.url), 'utf8'));
const categories = ['ram', 'cpu', 'ssd', 'motherboard', 'gpu', 'cooler', 'psu', 'case', 'hdd', 'halfpc', 'fullpc', 'bundle'];
const outbound=JSON.parse(await fs.readFile(new URL('../../src/content/outbound.generated.json',import.meta.url),'utf8'));
const ids = html => [...html.matchAll(/data-product-id="([a-z0-9-]+)"/g)].map(match => match[1]);
let requests = 0;
async function get(route, status = 200) {
  const response = await fetch(base + route, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(25000) });
  requests++;
  assert.equal(response.status, status, route);
  return response.text();
}

const hub = await get('/prices');
assert.ok(hub.includes('상품·가격비교'));
assert.ok(hub.includes('등록 상품·옵션·제품군'));
assert.ok(hub.includes('판매처 가격 기록'));
for (const category of categories) assert.ok(hub.includes(`href="/prices/${category}"`), category);

const seen = [];
await Promise.all(categories.map(async category => {
  const expected = catalog.products.filter(product => product.category === category);
  const found = [];
  for (let page = 1; page <= Math.max(1, Math.ceil(expected.length / 12)); page++) {
    const html = await get(`/prices/${category}?condition=all&page=${page}`);
    assert.ok(html.includes('id="registered-products"'), category);
    assert.ok(html.includes('id="price-records"'), category);
    found.push(...ids(html));
    if (!expected.length) assert.ok(html.includes('상품 목록부터 수집하고 있습니다'), category);
  }
  assert.deepEqual(found.sort(), expected.map(product => product.id).sort(), category);
  seen.push(...found);
}));
assert.equal(new Set(seen).size, catalog.products.length);

const facetNames = {cpu:['memory','socket','graphics'],motherboard:['socket','chipset','formFactor','memory','wireless'],ram:['memory','capacity','modules','speed','latency'],gpu:['chip','capacity','condition'],ssd:['capacity','interface','formFactor','dram'],hdd:['capacity','formFactor','rpm','recording'],psu:['wattage','formFactor','efficiency','modular','atx'],case:['caseType','boardSupport','gpuLength'],cooler:['coolerType','socket','height','radiator','led'],fullpc:['os','components'],halfpc:['os','components'],bundle:['components']};
for (const [category,names] of Object.entries(facetNames)) {
  const html = await get(`/prices/${category}`);
  assert.equal((html.match(/aria-label="상품 검색과 필터"/g)||[]).length,1);
  for (const name of names) assert.ok(html.includes(`name="${name}"`),`${category}/${name}`);
  assert.equal(html.includes('name="chipset"'),category==='motherboard');
  assert.ok(!html.includes('사양 확인 중'),category);
}
const cpu = await get('/prices/cpu');
assert.ok(cpu.indexOf('name="memory"') < cpu.indexOf('name="socket"'));
assert.ok(!cpu.includes('name="cores"'));
const memorySelect = cpu.match(/<select name="memory"[^>]*>(.*?)<\/select>/)?.[1]?.replaceAll("<!-- -->", "") ?? "";
assert.ok(memorySelect.includes('<option value="DDR4">DDR4 (5)</option>'));
assert.ok(memorySelect.includes('<option value="DDR5">DDR5 (14)</option>'));
const ddr4 = ids(await get('/prices/cpu?memory=DDR4'));
assert.equal(ddr4.length, 5);
assert.ok(ddr4.includes('reviewed-amd-5800x3d-anniversary-retailer'));
assert.ok(ddr4.includes('reviewed-intel-core-i5-14600k-bulk-cynex'));
assert.ok(!ddr4.includes('curated-amd-ryzen-7-9800x3d-multipack'));
const am5 = ids(await get('/prices/cpu?memory=DDR5&socket=AM5'));
assert.equal(am5.length, 9);
assert.ok(am5.includes('curated-amd-ryzen-7-9800x3d-multipack'));
const i7 = await get('/products/intel-core-i7-14700k');
assert.ok(i7.indexOf('data-spec-summary="memory"') < i7.indexOf('id="product-prices"'));
assert.match(i7, /DDR4 · DDR5/);
assert.match(i7, /블루딜에 기록된 판매가는 아직 없습니다/);
assert.doesNotMatch(i7, /aria-label="판매처별 제휴 가격 링크"/);
assert.match(i7, /Vmin Shift/);
const global = await get('/prices?q=PEERLESS%20black');
assert.ok(ids(global).length>0);
assert.match(global, /<meta name="robots" content="noindex, nofollow"/);
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
const coolingItems=JSON.parse(await fs.readFile(new URL('../../src/content/prices/cooler.json',import.meta.url),'utf8')).items;
const coolingHtml=await get('/prices/cooler');
if(coolingItems.length){
  const liquidHtml=await get('/prices/cooler?q=CPU%20%EC%88%98%EB%9E%AD');
  const fanHtml=await get('/prices/cooler?q=%EC%8B%9C%EC%8A%A4%ED%85%9C%20%ED%8C%AC');
  for(const item of coolingItems){
    assert.equal(liquidHtml.includes(`id="${item.id}"`),item.spec.startsWith('CPU 수랭'));
    assert.equal(fanHtml.includes(`id="${item.id}"`),item.spec.startsWith('시스템 팬'));
  }
}
for(const item of coolingItems){
  assert.ok(coolingHtml.includes(`id="${item.id}"`));
  const response=await fetch(`${base}/go/${item.goCode}`,{redirect:'manual',signal:AbortSignal.timeout(25000)});requests++;
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),outbound[item.goCode].originalUrl);
}
const gpuItems=JSON.parse(await fs.readFile(new URL('../../src/content/prices/gpu.json',import.meta.url),'utf8')).items;
const systemItems=JSON.parse(await fs.readFile(new URL('../../src/content/prices/fullpc.json',import.meta.url),'utf8')).items;
const systemHtml=await get('/prices/fullpc');
for(const item of systemItems){
  assert.ok(systemHtml.includes(`id="${item.id}"`));
  const response=await fetch(`${base}/go/${item.goCode}`,{redirect:'manual',signal:AbortSignal.timeout(25000)});requests++;
  assert.equal(response.status,302);assert.ok(['www.lotteon.com','store.ohou.se','item.gmarket.co.kr','www.11st.co.kr'].includes(new URL(response.headers.get('location')).hostname));
}
const halfItems=JSON.parse(await fs.readFile(new URL('../../src/content/prices/halfpc.json',import.meta.url),'utf8')).items;
const halfHtml=await get('/prices/halfpc');
if(halfItems.length)assert.ok(!halfHtml.includes('가격표에 금액을 등록하지 않았습니다'));
for(const item of halfItems){
  assert.ok(halfHtml.includes(`id="${item.id}"`));
  assert.ok(halfHtml.includes('조건부 자동 쿠폰가'));
  const response=await fetch(`${base}/go/${item.goCode}`,{redirect:'manual',signal:AbortSignal.timeout(25000)});requests++;
  assert.equal(response.status,302);assert.ok(['item.gmarket.co.kr','www.11st.co.kr'].includes(new URL(response.headers.get('location')).hostname));
}
const caseItems=JSON.parse(await fs.readFile(new URL('../../src/content/prices/case.json',import.meta.url),'utf8')).items;
const caseHtml=await get('/prices/case');
for(const item of caseItems){
  assert.ok(caseHtml.includes(`id="${item.id}"`));
  assert.ok(caseHtml.includes('수량1'));
  const response=await fetch(`${base}/go/${item.goCode}`,{redirect:'manual',signal:AbortSignal.timeout(25000)});requests++;
  assert.equal(response.status,302);assert.equal(response.headers.get('location'),outbound[item.goCode].originalUrl);
}
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
