import test from 'node:test';
import assert from 'node:assert/strict';
import { getRegisteredOutboundLink, normalizeOutboundUrl, resolveAffiliateUrl } from '../../src/lib/affiliate.ts';

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

test('verified Ohou product links remain ordinary links with strict domain boundaries',()=>{
  const originalUrl='https://store.ohou.se/goods/4100098';
  assert.deepEqual(resolveAffiliateUrl({merchant:'ohou',originalUrl,code:'fixture'}),{merchant:'ohou',url:originalUrl,mode:'passthrough'});
  assert.equal(normalizeOutboundUrl('https://store.ohou.se.evil.invalid/goods/4100098'),null);
  assert.equal(normalizeOutboundUrl('https://evil.ohou.se/goods/4100098'),null);
  assert.equal(normalizeOutboundUrl('https://user:secret@store.ohou.se/goods/4100098'),null);
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

function withMappings(entries, run) {
  const previous=process.env.AFFILIATE_LINKS_JSON;
  process.env.AFFILIATE_LINKS_JSON=typeof entries==='string'?entries:JSON.stringify(entries);
  try { run(); } finally {
    if(previous===undefined)delete process.env.AFFILIATE_LINKS_JSON;
    else process.env.AFFILIATE_LINKS_JSON=previous;
  }
}
const source='https://item.gmarket.co.kr/Item?goodsCode=FIXTURE001';
const issued={merchant:'gmarket',provider:'linkprice',originalUrl:source,affiliateUrl:'https://app.ac/FIXTURE01'};
const resolve=(originalUrl=source,merchant='gmarket')=>resolveAffiliateUrl({merchant,originalUrl,code:'stable-code'});

test('newly reviewed stores keep ordinary links until an exact issued mapping exists',()=>{
  withMappings([],()=>{
    for(const [merchant,originalUrl] of [['darkflash','https://darkflash.co.kr/product/detail.html?product_no=785'],['ssg','https://www.ssg.com/item/itemView.ssg?itemId=123&siteNo=6004']]){
      assert.deepEqual(resolveAffiliateUrl({merchant,originalUrl,code:'fixture'}),{merchant,url:originalUrl,mode:'passthrough'});
    }
    assert.equal(normalizeOutboundUrl('https://darkflash.co.kr.example.invalid/product/detail.html?product_no=785'),null);
  });
});

test('verified mappings change only the destination, preserving canonical product codes and source identity',()=>{
  withMappings([issued],()=>{
    assert.deepEqual(resolve(),{merchant:'gmarket',url:issued.affiliateUrl,mode:'registered-affiliate'});
    assert.equal(resolve(source.replace('FIXTURE001','FIXTURE002')).mode,'passthrough');
    assert.equal(resolve(source+'&option=2').mode,'passthrough');
    assert.equal(resolve(source,'11st'),null);
    // Shared network hosts cannot be submitted as ordinary merchant URLs.
    assert.equal(normalizeOutboundUrl(issued.affiliateUrl),null);
  });
});

const directIssued=(originalUrl=source,merchant='gmarket')=>'https://click.linkprice.com/click.php?m='+merchant+'&a=A000000000&l=9999&l_cd1=TEST_ONLY&l_cd2=0&tu='+encodeURIComponent(originalUrl);

test('official LinkPrice long links preserve issued tracking and require the exact registered product and merchant',()=>{
  for(const [merchant,advertiser,originalUrl] of [
    ['gmarket','gmarket',source],
    ['11st','11st','https://www.11st.co.kr/products/FIXTURE001'],
    ['auction','auction','https://itempage3.auction.co.kr/DetailView.aspx?itemno=F123456789'],
    ['lotteon','lotteon','https://www.lotteon.com/p/product/FIXTURE001'],
    ['ssg','emart','https://www.ssg.com/item/itemView.ssg?itemId=123&siteNo=6004'],
  ]){
    const affiliateUrl=directIssued(originalUrl,advertiser);
    withMappings([{merchant,provider:'linkprice',originalUrl,affiliateUrl}],()=>{
      assert.deepEqual(resolve(originalUrl,merchant),{merchant,url:affiliateUrl,mode:'registered-affiliate'});
      assert.equal(normalizeOutboundUrl(affiliateUrl),null);
    });
    withMappings([{merchant,provider:'linkprice',originalUrl,affiliateUrl:directIssued(originalUrl,'ssglive')}],()=>{
      assert.equal(resolve(originalUrl,merchant).mode,'passthrough');
    });
  }
});

test('official 11st feed preserves its authorized source marker',()=>{
  const originalUrl='https://www.11st.co.kr/product/SellerProductDetail.tmall?method=getSellerProductDetail&prdNo=123';
  const affiliateUrl=directIssued(originalUrl.replace('https:', 'http:'),'11st')+'&s=mpage';
  const mapping={merchant:'11st',provider:'linkprice',originalUrl,affiliateUrl};
  withMappings([mapping],()=>assert.equal(resolve(originalUrl,'11st').url,affiliateUrl));
  for(const s of ['&s=mpage','x','&redirect=https://example.invalid']){
    withMappings([{...mapping,affiliateUrl:affiliateUrl+s}],()=>assert.equal(resolve(originalUrl,'11st').mode,'passthrough'));
  }
  withMappings([{...issued,affiliateUrl:directIssued()+'&s=mpage'}],()=>assert.equal(resolve().mode,'passthrough'));
});

test('long LinkPrice links reject substituted products, ambiguous parameters and unapproved endpoints',()=>{
  const valid=directIssued();
  const badTargets=[
    directIssued(source.replace('FIXTURE001','FIXTURE002')),
    directIssued('https://www.11st.co.kr/products/FIXTURE001'),
    directIssued(source,'11st'),
    valid+'&tu='+encodeURIComponent(source),valid+'&m=gmarket',valid+'&a=TEST_OTHER',
    valid+'&redirect=https://evil.invalid',valid.replace('click.linkprice.com','click.linkprice.com.evil.invalid'),
    valid.replace('/click.php','/other.php'),valid.replace('https:','http:'),
    valid.replace('https://','https://u:p@'),valid.replace('.com/','.com:8443/'),valid+'#fragment',
    valid.replace('a=A000000000','a='),valid.replace(encodeURIComponent(source),encodeURIComponent(encodeURIComponent(source))),
  ];
  for(const affiliateUrl of badTargets)withMappings([{...issued,affiliateUrl}],()=>assert.equal(resolve().mode,'passthrough'));
});

test('invalid, duplicate and unrelated issued targets fall back safely to the original merchant',()=>{
  const badTargets=['https://app.ac.evil.invalid/FIXTURE01','https://evilapp.ac/FIXTURE01',
    'http://app.ac/FIXTURE01','https://u:p@app.ac/FIXTURE01','https://app.ac:8443/FIXTURE01',
    'https://app.ac/FIXTURE01?redirect=https://evil.invalid','https://app.ac/FIXTURE01#x',
    'https://app.ac/FIXTURE\n01','javascript:alert(1)','https://www.gmarket.co.kr/'];
  for(const affiliateUrl of badTargets)withMappings([{...issued,affiliateUrl}],()=>assert.equal(resolve().mode,'passthrough',affiliateUrl));
  for(const entries of ['{broken','null','{}',[issued,issued],[{...issued,provider:'coupang'}],Array(101).fill(issued)]){
    withMappings(entries,()=>assert.equal(resolve().mode,'passthrough'));
  }
});

test('native provider mappings preserve official tracking but cannot cross merchant boundaries',()=>{
  for(const [merchant,originalUrl,affiliateUrl] of [
    ['coupang','https://www.coupang.com/vp/products/123','https://link.coupang.com/a/FIXTURE?subid=TEST%2BVALUE&z=2&a=1'],
    ['aliexpress','https://www.aliexpress.com/item/123.html','https://s.click.aliexpress.com/e/_FIXTURE01'],
  ]){
    withMappings([{merchant,provider:merchant,originalUrl,affiliateUrl}],()=>{
      assert.deepEqual(resolve(originalUrl,merchant),{merchant,url:affiliateUrl,mode:'registered-affiliate'});
    });
    withMappings([{merchant,provider:merchant,originalUrl,affiliateUrl:issued.affiliateUrl}],()=>assert.equal(resolve(originalUrl,merchant).mode,'passthrough'));
  }
});

test('manual issued links resolve by a unique server-side code without publishing invented product facts',()=>{
  const row={code:'ali-fixture',merchant:'aliexpress',provider:'aliexpress',originalUrl:'https://s.click.aliexpress.com/e/_FIXTURE01',affiliateUrl:'https://s.click.aliexpress.com/e/_FIXTURE01'};
  withMappings([row],()=>{
    assert.deepEqual(getRegisteredOutboundLink(row.code),{code:row.code,merchant:row.merchant,originalUrl:row.originalUrl});
    assert.equal(getRegisteredOutboundLink('unknown'),null);
    assert.equal(getRegisteredOutboundLink('../ali-fixture'),null);
  });
  for(const entries of [[row,row],[{...row,affiliateUrl:'https://evil.invalid/'}],[{...row,merchant:'coupang'}],[{...row,originalUrl:'https://evil.invalid/'}]]){
    withMappings(entries,()=>assert.equal(getRegisteredOutboundLink(row.code),null));
  }
});
