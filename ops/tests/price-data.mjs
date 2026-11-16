import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPrices, readPriceFilters, priceFreshness } from '../../src/lib/priceFilters.ts';

const ram = [
  {id: 'a', name: 'Fixture 32GB', price: 100000, shippingFee: 3000, capacityGB: 32, memoryType: 'DDR5'},
  {id: 'b', name: 'Fixture 48GB', price: 102000, shippingFee: 0, capacityGB: 48, memoryType: 'DDR5'},
  {id: 'c', name: 'Fixture unknown delivery', price: 50000, capacityGB: 32, memoryType: 'DDR4'},
];
const filters = search => readPriceFilters(search);

test('RAM filters use verified total kit capacity and memory type together', () => {
  assert.deepEqual(filterPrices(ram, 'ram', filters({capacity:'32', memory:'DDR5'})).map(i=>i.id), ['a']);
  assert.deepEqual(filterPrices(ram, 'ram', filters({capacity:'48'})).map(i=>i.id), ['b']);
  assert.equal(filterPrices(ram, 'ram', filters({capacity:'64'})).length, 0);
});

test('unknown delivery is never treated as free in either total-price order', () => {
  assert.deepEqual(filterPrices(ram, 'ram', filters({})).map(i=>i.id), ['b','a','c']);
  assert.deepEqual(filterPrices(ram, 'ram', filters({sort:'total-desc'})).map(i=>i.id), ['a','b','c']);
  assert.deepEqual(filterPrices(ram, 'ram', filters({sort:'price-asc'})).map(i=>i.id), ['c','a','b']);
  assert.deepEqual(ram.map(i=>i.id), ['a','b','c']);
});

test('SSD DRAM information stays unknown until explicitly verified', () => {
  const ssd = [{id:'s1',name:'DRAM model name only',price:1,capacityGB:1000},
    {id:'s2',name:'Fixture',price:2,capacityGB:2000,ssdDram:'present'},
    {id:'s3',name:'Fixture',price:3,capacityGB:1000,ssdDram:'absent'}];
  assert.deepEqual(filterPrices(ssd,'ssd',filters({dram:'unknown',capacity:'1000'})).map(i=>i.id),['s1']);
  assert.deepEqual(filterPrices(ssd,'ssd',filters({dram:'present'})).map(i=>i.id),['s2']);
  assert.deepEqual(filterPrices(ssd,'ssd',filters({dram:'absent'})).map(i=>i.id),['s3']);
});

test('GPU capacity filters combine with model search and never infer VRAM from a product name', () => {
  const gpu=[
    {id:'ti8',name:'Fixture RTX 5060 Ti 8GB',price:100,capacityGB:8},
    {id:'ti16',name:'Fixture RTX 5060 Ti 16GB',price:200,capacityGB:16},
    {id:'other16',name:'Fixture RTX 5070 Ti 16GB',price:300,capacityGB:16},
    {id:'unverified',name:'Fixture RTX 5060 Ti 16GB unverified',price:1},
  ];
  assert.deepEqual(filterPrices(gpu,'gpu',filters({capacity:'16'})).map(i=>i.id),['ti16','other16']);
  assert.deepEqual(filterPrices(gpu,'gpu',filters({q:'5060 Ti',capacity:'16'})).map(i=>i.id),['ti16']);
  assert.deepEqual(filterPrices(gpu,'gpu',filters({q:'5060 Ti',capacity:'8'})).map(i=>i.id),['ti8']);
  assert.equal(filterPrices(gpu,'gpu',filters({capacity:'32'})).length,0);
});

test('malformed filters are safely ignored and searches are bounded', () => {
  assert.deepEqual(filters({capacity:'-32',memory:'DDR99',dram:'guess',sort:'__proto__'}), {query:'',capacity:'',memory:'',dram:'',sort:'total-asc'});
  assert.equal(filters({q:['  FIXTURE  ','unused']}).query,'FIXTURE');
  assert.equal(filters({q:'a'.repeat(500)}).query.length,100);
  assert.equal(filterPrices(ram,'ram',filters({q:'not a product'})).length,0);
});

test('freshness uses actual verification time, including exact 24h boundary', () => {
  const now=Date.parse('2026-11-16T09:00:00Z');
  assert.equal(priceFreshness({checkedAt:'2026-11-16T08:00:00Z'},now),'recent');
  assert.equal(priceFreshness({checkedAt:'2026-11-15T09:00:00Z'},now),'stale');
  assert.equal(priceFreshness({checkedAt:'2026-11-17T09:00:00Z'},now),'unknown');
  assert.equal(priceFreshness({checkedAt:'invalid'},now),'unknown');
});
