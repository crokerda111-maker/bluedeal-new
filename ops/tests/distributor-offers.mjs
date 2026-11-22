import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {linkDistributorOffers} from '../catalog/distributor-review.mjs';
const review=JSON.parse(fs.readFileSync(new URL('../../src/content/products/distributor-retail-reviewed.json',import.meta.url),'utf8'));
const catalog=JSON.parse(fs.readFileSync(new URL('../../src/content/products/catalog.json',import.meta.url),'utf8')).products;
const prices=['ssd','psu','case','cooler'].map(category=>JSON.parse(fs.readFileSync(new URL('../../src/content/prices/'+category+'.json',import.meta.url),'utf8')));
test('every reviewed merchant quote belongs to exactly one selected product',()=>{
  const result=linkDistributorOffers(catalog,review.links,prices);
  for(const link of review.links){const owners=result.filter(p=>p.listings.some(l=>l.id===link.listingId));assert.equal(owners.length,1);assert.equal(owners[0].id,link.productId);assert.equal(owners[0].domesticState,'listing-observed');}
});
test('unknown quotes, wrong owners, categories and observation times cannot be linked',()=>{
  const product={id:'a',category:'ssd',kind:'model',domesticState:'unverified',listings:[]};
  const quote={id:'q',source:'서린 공식몰',seller:'서린씨앤아이',checkedAt:'2026-11-22T00:00:00Z',goCode:'abcdefgh'};
  const link={productId:'a',listingId:'q',checkedAt:quote.checkedAt};
  assert.throws(()=>linkDistributorOffers([product],[link],[]));
  assert.throws(()=>linkDistributorOffers([product],[{...link,checkedAt:'2026-11-21'}],[{category:'ssd',items:[quote]}]));
  assert.throws(()=>linkDistributorOffers([product],[link],[{category:'psu',items:[quote]}]));
  assert.throws(()=>linkDistributorOffers([product,{...product,id:'b',listings:[{id:'q'}]}],[link],[{category:'ssd',items:[quote]}]));
});
test('unverified personal discounts never replace the recorded ordinary price',()=>{
  for(const link of review.links){const offer=prices.flatMap(p=>p.items).find(p=>p.id===link.listingId);assert.ok(offer.price>0);assert.ok(offer.shippingFee>=0);assert.ok(offer.priceNote.includes('쿠폰'));assert.equal(offer.couponPrice,undefined);assert.equal(offer.cardPrice,undefined);}
});
