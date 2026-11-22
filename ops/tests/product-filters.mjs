import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CATEGORY_FACETS, readProductFilters, productFacetValues, productFacetOptions, matchesProduct, matchesProductSearch, productSearchHref, legacyProductsHref, indexProductOffers, searchProducts } from '../../src/lib/productFilters.ts';

const products=JSON.parse(fs.readFileSync(new URL('../../src/content/products/catalog.json',import.meta.url),'utf8')).products;
const offers=fs.readdirSync(new URL('../../src/content/prices/',import.meta.url)).filter(n=>n.endsWith('.json')).flatMap(n=>JSON.parse(fs.readFileSync(new URL('../../src/content/prices/'+n,import.meta.url),'utf8')).items||[]);
const index=indexProductOffers(products,offers);
const base={id:'sample',name:'B850M AM5 DDR5 RTX5090 32GB',category:'motherboard',brand:'Example',kind:'model',features:[],specifications:[],listings:[],lifecycle:'unknown'};

test('different hardware categories expose relevant facets',()=>{
  assert.equal(Object.keys(CATEGORY_FACETS).length,12);
  assert.ok(CATEGORY_FACETS.motherboard.some(f=>f.key==='chipset'));
  assert.deepEqual(CATEGORY_FACETS.cpu.map(f=>f.key), ['memory','socket','graphics']);
  assert.ok(CATEGORY_FACETS.ram.some(f=>f.key==='modules'));
  assert.ok(CATEGORY_FACETS.psu.some(f=>f.key==='wattage'));
});
test('all registered CPUs and boards have model-specific socket and memory details',()=>{
  for(const product of products.filter(p=>p.category==='cpu'||p.category==='motherboard')){
    const facts=productFacetValues(product);
    assert.ok(facts.socket?.length, product.id);
    assert.ok(facts.memory?.length, product.id);
    assert.ok(product.sources.some(s=>[ 'manufacturer-specifications', 'retailer-listing' ].includes(s.kind) && s.observedAt), product.id);
  }
  const cpus=products.filter(p=>p.category==='cpu');
  const options=productFacetOptions(cpus,index,CATEGORY_FACETS.cpu[0]);
  assert.deepEqual(options,{values:[['DDR4',5],['DDR5',14]],unknown:0});
  const forMemory=value=>searchProducts(cpus,index,readProductFilters({memory:value},'cpu'),offers,30).items.map(p=>p.id);
  for(const cpu of ['reviewed-intel-core-i5-14600k-bulk-cynex','reviewed-intel-core-i5-14600kf-bulk-cynex','intel-core-i7-14700k']){
    assert.ok(forMemory('DDR4').includes(cpu));
    assert.ok(forMemory('DDR5').includes(cpu));
  }
  assert.ok(!forMemory('DDR5').includes('reviewed-amd-5800x3d-anniversary-retailer'));
  assert.ok(!forMemory('DDR4').includes('curated-amd-ryzen-7-9800x3d-multipack'));
  const kf=cpus.find(p=>p.id==='reviewed-intel-core-i5-14600kf-bulk-cynex');
  assert.deepEqual(productFacetValues(kf).graphics,['absent']);
  assert.ok(matchesProduct(kf,[],readProductFilters({cores:'14'},'cpu')));
});
test('documented case clearances and exact PSU wattage appear in catalog filters',()=>{
  const get=id=>products.find(product=>product.id===id);
  const whiteG10=get('distributor-seorin-1000009068');
  assert.deepEqual(productFacetValues(whiteG10).gpuLength,['420']);
  assert.ok(productFacetValues(whiteG10).boardSupport.includes('ATX'));
  assert.ok(whiteG10.specifications.some(s=>s.label==='최대 CPU 쿨러 높이'&&s.value==='182 mm'));
  const b12=get('maker-seasonic-psu-bf40f678a1b53ee6');
  const facts=productFacetValues(b12);
  assert.deepEqual(facts.wattage,['550']);
  assert.deepEqual(facts.modular,['고정 케이블']);
  assert.deepEqual(facts.efficiency,['BRONZE']);
  const bare=get('maker-thermalright-cooler-9f1852598c610728');
  assert.deepEqual(productFacetValues(bare).heatsinkHeight,['32']);
  assert.equal(productFacetValues(bare).height,undefined);
});
test('a name alone cannot establish sockets, memory, capacities or compatibility',()=>{
  assert.deepEqual(productFacetValues(base),{});
  assert.ok(matchesProduct(base,[],readProductFilters({socket:'__unknown'},'motherboard')));
  assert.ok(!matchesProduct(base,[],readProductFilters({socket:'AM5'},'motherboard')));
});
test('explicit labeled specifications and safe dated evidence provide facets',()=>{
  const source={url:'https://example.com/product',observedAt:'2026-01-01T00:00:00Z'};
  const p={...base,specifications:[{label:'CPU 소켓',value:'AM5'},{label:'메모리 규격',value:'DDR5'},{label:'칩셋',value:'AMD B850'}],facts:[{key:'wireless',value:'present',source}]};
  assert.deepEqual(productFacetValues(p),{wireless:['present'],memory:['DDR5'],socket:['AM5'],chipset:['AMD B850']});
  for(const observedAt of [null,'bad','2099-01-01']) assert.deepEqual(productFacetValues({...base,facts:[{key:'socket',value:'AM5',source:{...source,observedAt}}]}),{});
  for(const url of ['http://example.com/x','https://u:p@example.com/x','https://example.com:8443/x']) assert.deepEqual(productFacetValues({...base,facts:[{key:'socket',value:'AM5',source:{...source,url}}]}),{});
});
test('capacity, module count and clock stay separate; ATX version is not size',()=>{
  const p={...base,category:'ram',specifications:[{label:'판매 총 용량',value:'32GB'},{label:'모듈 수·용량',value:'16GB×2'},{label:'속도·타이밍',value:'DDR5-6000 CL30'}]};
  assert.deepEqual(productFacetValues(p),{memory:['DDR5'],capacity:['32'],modules:['2'],speed:['6000'],latency:['30']});
  const psu=productFacetValues({...base,category:'psu',specifications:[{label:'판매 구성 표기',value:'850W 80PLUS GOLD 풀모듈러 ATX3.1'}]});
  assert.deepEqual(psu,{wattage:['850'],efficiency:['GOLD'],modular:['풀모듈러'],atx:['3.1']});
});
test('search combines normalized words within one offer, without mixing sellers',()=>{
  const p={...base,name:'Sample'};
  assert.ok(matchesProductSearch(p,[{name:'ＰＥＥＲＬＥＳＳ',seller:'Black Shop'}],'peerless black'));
  assert.ok(!matchesProductSearch(p,[{name:'peerless',seller:'One'},{name:'other',seller:'Black Shop'}],'peerless black'));
});
test('GPU state and unknown facts remain distinct',()=>{
  const p={...base,category:'gpu'};
  assert.ok(matchesProduct(p,[],readProductFilters({},'gpu')));
  assert.ok(!matchesProduct(p,[{condition:'refurbished'}],readProductFilters({},'gpu')));
  assert.ok(matchesProduct(p,[{condition:'refurbished'}],readProductFilters({condition:'refurbished'},'gpu')));
  assert.ok(!matchesProduct(p,[],readProductFilters({condition:'refurbished'},'gpu')));
});
test('legacy URLs preserve relevant filters and cannot redirect off-site',()=>{
  assert.equal(legacyProductsHref({category:'ram',q:'DDR5 & kit',brand:'KLEVV',catalogPage:'2'}),'/prices/ram?q=DDR5+%26+kit&brand=KLEVV&page=2');
  assert.equal(legacyProductsHref({category:'https://evil.invalid',next:'https://evil.invalid'}),'/prices');
  const href=productSearchHref('ram',{memory:'DDR5',modules:'2',chipset:'wrong',socket:'wrong',q:'32GB'},3);
  const u=new URL(href,'https://bluedeal.co.kr');assert.equal(u.searchParams.get('modules'),'2');assert.equal(u.searchParams.get('chipset'),null);assert.equal(u.searchParams.get('page'),'3');
  assert.equal(readProductFilters({page:['2','3']}).page,1);
});
test('every catalog item remains reachable and price records retain their owners',()=>{
  const found=[];
  const filters=readProductFilters({condition:'all'});
  const first=searchProducts(products,index,filters,offers);
  for(let page=1;page<=first.totalPages;page++)found.push(...searchProducts(products,index,{...filters,page},offers).items.map(p=>p.id));
  assert.equal(new Set(found).size,products.length);assert.equal(found.length,products.length);
  assert.equal([...index.values()].reduce((sum,v)=>sum+v.length,0),offers.length);
  const missing=searchProducts(products,index,readProductFilters({priceState:'missing'}),offers,10000);
  assert.ok(missing.items.length);assert.ok(missing.items.every(p=>p.listings.length===0));
});
