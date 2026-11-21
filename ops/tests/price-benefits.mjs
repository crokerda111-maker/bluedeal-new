import test from 'node:test';
import assert from 'node:assert/strict';
import { priceBenefits } from '../../src/lib/priceBenefits.ts';
import { filterPrices, readPriceFilters } from '../../src/lib/priceFilters.ts';

const offer={id:'fixture',name:'Fixture',price:400000,shippingFee:3000,couponPrice:376000,couponNote:'당일 발급 쿠폰',couponStartsOn:'2026-11-20',couponEndsOn:'2026-11-25',cardPrice:366000,cardNote:'쿠폰+대상 카드',cardRequiresCoupon:true,cardEndsOn:'2026-11-30'};

test('a coupon+card quote expires at the earlier coupon deadline in Korea time',()=>{
  assert.equal(priceBenefits(offer,Date.parse('2026-11-21T12:00:00+09:00'))[1].endsOn,'2026-11-25');
  assert.ok(priceBenefits(offer,Date.parse('2026-11-25T23:59:59+09:00')).every(q=>q.state==='observed'));
  assert.ok(priceBenefits(offer,Date.parse('2026-11-26T00:00:00+09:00')).every(q=>q.state==='expired'));
});
test('coupon-only dates do not expire an independent card quote',()=>{
  const quotes=priceBenefits({...offer,cardRequiresCoupon:false},Date.parse('2026-11-27T00:00:00+09:00'));
  assert.equal(quotes[0].state,'expired');assert.equal(quotes[1].state,'observed');
});
test('conditional offers never replace baseline sorting or imply universally available discounts',()=>{
  const items=[offer,{id:'other',name:'Other',price:390000,shippingFee:3000}];
  assert.deepEqual(filterPrices(items,'motherboard',readPriceFilters({})).map(i=>i.id),['other','fixture']);
  assert.equal(offer.price,400000);
  assert.equal(priceBenefits({...offer,couponNote:undefined,cardNote:undefined},Date.now()).length,0);
});
