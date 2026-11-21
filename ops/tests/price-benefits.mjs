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

test('an instant quote ends at the exact Korea-time cutoff, not midnight',()=>{
  const instant={...offer,instantPrice:350000,instantNote:'일부 회원 적용',instantEndsAt:'2026-11-28T04:00:00+09:00'};
  const before=priceBenefits(instant,Date.parse('2026-11-28T03:59:59+09:00'))[0];
  assert.equal(before.kind,'instant');assert.equal(before.state,'observed');
  assert.equal(before.endsAt,instant.instantEndsAt);assert.equal(before.endsOn,undefined);
  assert.equal(priceBenefits(instant,Date.parse('2026-11-28T04:00:00+09:00'))[0].state,'expired');
  assert.deepEqual(filterPrices([instant,{id:'other',name:'Other',price:390000,shippingFee:3000}],'cpu',readPriceFilters({})).map(i=>i.id),['other','fixture']);
});

test('combined card quotes respect an exact coupon cutoff',()=>{
  const mixed={...offer,couponEndsOn:undefined,couponEndsAt:'2026-11-25T04:00:00+09:00'};
  const quotes=priceBenefits(mixed,Date.parse('2026-11-25T04:00:00+09:00'));
  assert.ok(quotes.every(q=>q.state==='expired'));
  assert.equal(quotes[1].endsAt,mixed.couponEndsAt);assert.equal(quotes[1].endsOn,undefined);
});
