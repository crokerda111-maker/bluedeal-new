import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOutboundUrl, resolveAffiliateUrl } from '../../src/lib/affiliate.ts';

test('allowed merchant domains never accept deceptive boundaries, credentials or ports', () => {
  for (const url of ['https://www.coupang.com.evil.invalid/p', 'https://evilcoupang.com/p',
    'https://user:password@www.coupang.com/p', 'https://www.coupang.com:8443/p',
    'javascript:alert(1)', 'https://www.coupang.com/pa\nth']) {
    assert.equal(normalizeOutboundUrl(url), null, url);
  }
  assert.equal(normalizeOutboundUrl('http://www.coupang.com:80/vp/products/1'), 'https://www.coupang.com/vp/products/1');
});

test('issued short links preserve tracking values and parameter order', () => {
  const originalUrl='https://link.coupang.com/a/FIXTURE?subid=TEST%2BVALUE&z=2&a=1';
  assert.deepEqual(resolveAffiliateUrl({merchant:'coupang',originalUrl,code:'fixture'}),
    {merchant:'coupang',url:originalUrl,mode:'already-affiliate'});
  assert.equal(resolveAffiliateUrl({merchant:'gmarket',originalUrl,code:'fixture'}),null);
});

test('ordinary product URLs are not claimed as commission-enabled by adding a tag', () => {
  const previous=process.env.COUPANG_LPTAG;
  process.env.COUPANG_LPTAG='TEST_ONLY';
  try {
    const originalUrl='https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3';
    assert.deepEqual(resolveAffiliateUrl({merchant:'coupang',originalUrl,code:'fixture'}),
      {merchant:'coupang',url:originalUrl,mode:'passthrough'});
  } finally {
    if(previous===undefined) delete process.env.COUPANG_LPTAG;
    else process.env.COUPANG_LPTAG=previous;
  }
});
