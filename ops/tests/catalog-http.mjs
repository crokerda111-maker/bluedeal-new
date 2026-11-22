import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BLUEDEAL_CATALOG_TEST_URL??'http://127.0.0.1:3100';
const data=JSON.parse(await fs.readFile(new URL('../../src/content/products/catalog.json',import.meta.url),'utf8'));
const status=await fetch(base+'/api/products/status').then(r=>r.json());
assert.equal(status.catalogHash,data.catalogHash);assert.equal(status.entries,data.products.length);
const get=async route=>{const response=await fetch(base+route,{redirect:'manual'});return {status:response.status,location:response.headers.get('location'),html:await response.text()};};
const home=await get('/products');assert.equal(home.status,308);assert.equal(home.location,'/prices');
const psus=await get('/products?category=psu&lifecycle=exclude-discontinued');assert.equal(psus.status,308);assert.equal(psus.location,'/prices/psu?lifecycle=exclude-discontinued');
const empty=await get('/prices?q=NO_SUCH_PRODUCT_9383');assert.ok(empty.html.includes('조건에 맞는 등록 상품이 없습니다'));
assert.equal((await get('/products/not-an-existing-product')).status,404);
const queue=[...data.products];let checked=0;
await Promise.all(Array.from({length:6},async()=>{while(queue.length){const product=queue.shift();const page=await get('/products/'+product.id);assert.equal(page.status,200,product.id);assert.ok(page.html.includes(product.referenceCode),product.id);assert.ok(page.html.includes('id=\"product-prices\"'),product.id);assert.ok(page.html.includes('후기 경향은 아직 검토하지 않았습니다'),product.id);checked++;}}));
const sample=data.products[0];const form=await get('/contact/write?from=products&product='+sample.id);
assert.equal(form.status,200);assert.ok(form.html.includes(sample.referenceCode));assert.ok(form.html.includes('상품 정보 수정'));
assert.ok(form.html.includes('비공개'));
console.log(JSON.stringify({status:'passed',productPages:checked,catalogHash:data.catalogHash,filter:true,empty:true,unknown404:true,feedbackContext:true,publicWrites:0}));
