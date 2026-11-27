import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPcBuild, calculateSavings, DRAFT_SCORE_POLICY, readCostScenario, qualityTier} from '../../src/lib/valueAssessment.ts';

// Synthetic quotes and ratings test the policy, not real products or recommendations.
const NOW=Date.parse('2026-11-19T21:00:00+09:00');
const evidence=(kind='retailer')=>({label:'Synthetic evidence',url:'https://example.com/evidence',kind,checkedAt:'2026-11-19T20:00:00+09:00'});
const quote=amountKRW=>({amountKRW,stock:'in-stock',basis:'retailer-confirmed',source:evidence()});
const reviewed={...DRAFT_SCORE_POLICY,status:'reviewed'};
function fixture(){
  return {kind:'fullpc',gpuMode:'dedicated',gpuScopeEvidence:[],
    lines:['cpu','motherboard','ram','storage','gpu','psu','case','cooler'].map(slot=>({id:slot,slot,skuId:`fixture-${slot}`,referenceSkuId:`fixture-${slot}`,variantMatched:true,quantity:1,orderId:'shared',referencePrice:quote(100000),issueApplicability:{},issueEvidence:{},mitigationVerified:[],dossier:{skuId:`fixture-${slot}`,name:slot,slot,strengths:[],findings:[],reviewCoverage:'selected-sources-reviewed',quality:{score:80,reasoning:'Synthetic test',sources:[evidence('review-lab')]}}})),
    referenceOrders:[{id:'shared',shipping:quote(3000)}],deliveredPcPrice:quote(750000),referenceServiceCosts:[quote(50000)],conditions:{sameOsAndWarranty:true,compatibilityChecked:true,evidence:[evidence()]},serviceAssessment:{score:70,sources:[evidence()]}};
}
function finding(build,changes={}){
  build.lines[0].dossier.findings=[{id:'issue',title:'Synthetic issue',summary:'Test only',affectedSkuIds:['fixture-cpu'],conditions:'Exact fixture only',confidence:'manufacturer-confirmed',severity:'high',resolution:'mitigation-available',action:'Verify mitigation',sources:[evidence('manufacturer')],...changes}];
  return build.lines[0];
}

test('savings use DIY delivered denominator, include fees once, and allow negative savings',()=>{
  const result=assessPcBuild(fixture(),NOW,reviewed);
  assert.equal(result.comparison.referenceTotalKRW,853000);
  assert.equal(result.comparison.savingsPct,12.08);
  assert.deepEqual(result.breakdown,{partsKRW:800000,shippingKRW:3000,servicesKRW:50000});
  assert.equal(result.status,'ready');
  assert.equal(calculateSavings(1000000,1100000).savingsPct,-10);
});
test('draft methodology never emits a public overall score',()=>{
  const result=assessPcBuild(fixture(),NOW);
  assert.equal(result.overallScore,null); assert.equal(result.status,'methodology-review');
});
test('affiliate commission metadata has no effect on scores',()=>{
  const a=fixture(), b=fixture(); b.affiliateCommission=999; b.lines[0].commission=80;
  assert.deepEqual(assessPcBuild(a,NOW,reviewed),assessPcBuild(b,NOW,reviewed));
});
test('missing essential components, option mismatch, incompatible OS or warranty stop comparison',()=>{
  for(const change of [b=>b.lines.pop(),b=>b.lines[0].variantMatched=false,b=>b.conditions.sameOsAndWarranty=false,b=>b.conditions.compatibilityChecked=false,b=>b.lines.push({...b.lines[0]})]){
    const build=fixture();change(build);const result=assessPcBuild(build,NOW,reviewed);
    assert.equal(result.overallScore,null);assert.equal(result.comparison,null);
  }
});
test('unverified, old, future, sold out, missing and malformed quotes cannot pass as current prices',()=>{
  for(const change of [q=>q.basis='community-reported',q=>q.stock='out-of-stock',q=>q.stock='unknown',q=>q.source=null,q=>q.source.checkedAt='2026-11-17T20:00:00+09:00',q=>q.source.checkedAt='2026-11-20T20:00:00+09:00',q=>q.source.checkedAt='2026-11-19',q=>q.source.url='javascript:alert(1)',q=>q.amountKRW=NaN,q=>q.amountKRW=1.5,q=>q.amountKRW=-1]){
    const b=fixture();change(b.lines[0].referencePrice);assert.equal(assessPcBuild(b,NOW,reviewed).comparison,null);
  }
});
test('shipping groups require one explicit quote, including free shipping',()=>{
  const b=fixture();b.referenceOrders[0].shipping=quote(0);assert.equal(assessPcBuild(b,NOW,reviewed).breakdown.shippingKRW,0);
  b.referenceOrders.push({...b.referenceOrders[0]});assert.equal(assessPcBuild(b,NOW,reviewed).comparison,null);
  b.referenceOrders=[];assert.equal(assessPcBuild(b,NOW,reviewed).comparison,null);
});
test('quantity counts kit quantities and missing services never imply free service',()=>{
  const b=fixture();b.lines[2].quantity=2;assert.equal(assessPcBuild(b,NOW,reviewed).breakdown.partsKRW,900000);
  b.referenceServiceCosts=[];assert.equal(assessPcBuild(b,NOW,reviewed).comparison,null);
  b.referenceServiceCosts=[quote(0)];assert.notEqual(assessPcBuild(b,NOW,reviewed).comparison,null);
});
test('GPU inclusion and integrated or half PC scope need explicit evidence',()=>{
  const b=fixture();b.kind='halfpc';assert.equal(assessPcBuild(b,NOW,reviewed).comparison,null);
  b.gpuMode='excluded';b.lines=b.lines.filter(l=>l.slot!=='gpu');assert.equal(assessPcBuild(b,NOW,reviewed).comparison,null);
  b.gpuScopeEvidence=[evidence()];assert.notEqual(assessPcBuild(b,NOW,reviewed).comparison,null);
  b.kind='fullpc';assert.equal(assessPcBuild(b,NOW,reviewed).comparison,null);
  b.gpuMode='integrated';assert.notEqual(assessPcBuild(b,NOW,reviewed).comparison,null);
});
test('unknown quality or wrong dossier cannot be averaged away as high quality',()=>{
  const b=fixture();b.lines[0].dossier.quality.score=null;const r=assessPcBuild(b,NOW,reviewed);
  assert.equal(r.axes.quality,null);assert.equal(r.overallScore,null);assert.equal(r.componentGrades[0].tier,null);
  b.lines[0].dossier.quality.score=90;b.lines[0].dossier.slot='ram';assert.equal(assessPcBuild(b,NOW,reviewed).componentGrades[0].tier,null);
});
test('serious applicable issues hold recommendation even for cheap PCs',()=>{
  const b=fixture();const line=finding(b);line.issueApplicability.issue='affected';
  const r=assessPcBuild(b,NOW,reviewed);assert.equal(r.status,'issue-hold');assert.equal(r.overallScore,null);assert.notEqual(r.comparison,null);
  line.mitigationVerified=['issue'];assert.equal(assessPcBuild(b,NOW,reviewed).status,'issue-hold');
  line.issueEvidence.issue=[evidence('retailer')];assert.equal(assessPcBuild(b,NOW,reviewed).status,'ready');
});
test('unknown applicability and unsupported exclusions or resolved claims need evidence',()=>{
  const b=fixture();const line=finding(b);
  assert.equal(assessPcBuild(b,NOW,reviewed).overallScore,null);
  line.issueApplicability.issue='not-affected';assert.equal(assessPcBuild(b,NOW,reviewed).overallScore,null);
  line.issueEvidence.issue=[evidence()];assert.notEqual(assessPcBuild(b,NOW,reviewed).overallScore,null);
  line.dossier.findings[0].resolution='resolved';line.dossier.findings[0].sources=[];assert.equal(assessPcBuild(b,NOW,reviewed).overallScore,null);
});
test('unconfirmed community reports do not automatically downgrade a product',()=>{
  const b=fixture();finding(b,{confidence:'community-report'});const r=assessPcBuild(b,NOW,reviewed);
  assert.equal(r.status,'ready');assert.equal(r.caveats.length,1);
});
test('out of scope issue cannot condemn a different SKU',()=>{
  const b=fixture();finding(b,{affectedSkuIds:['different-sku']});assert.equal(assessPcBuild(b,NOW,reviewed).status,'ready');
});
test('invalid weights, impossible sums and missing prices cannot emit a score',()=>{
  const b=fixture();assert.equal(assessPcBuild(b,NOW,{...reviewed,weights:{price:-10,quality:90,service:20}}).overallScore,null);
  b.lines.forEach(l=>l.referencePrice=quote(100000000));assert.equal(assessPcBuild(b,NOW,reviewed).overallScore,null);
  b.deliveredPcPrice=null;assert.equal(assessPcBuild(b,NOW,reviewed).comparison,null);
  for(const value of [NaN,Infinity,0,-1,1.5]) assert.equal(calculateSavings(value,100),null);
  assert.equal(qualityTier(null),null);
});
const scenario=()=>Object.fromEntries([['calculate','1'],['mode','halfpc'],['matched','yes'],...['cpu','motherboard','ram','storage','psu','case'].map(k=>[k,'100000']),['gpu','0'],['cooler','0'],['shipping','3000'],['services','50000'],['pc','600000']]);
test('manual scenarios are strict arithmetic with explicit zeroes and conditions',()=>{
  const q=scenario(),r=readCostScenario(q);assert.equal(r.result.referenceTotalKRW,653000);assert.equal(r.result.savingsPct,8.12);
  for(const change of [q=>q.matched='',q=>delete q.shipping,q=>q.cpu=['1','2'],q=>q.cpu='1e6',q=>q.cpu='-100',q=>q.pc='1.5',q=>q.gpu='200000']){
    const query=scenario();change(query);assert.equal(readCostScenario(query).result,null);
  }
  assert.equal(readCostScenario({}).submitted,false);assert.equal(readCostScenario({}).result,null);
});

test('manual comparison includes verified-option upgrades as user costs and accepts a delivered DIY quote',()=>{
  const query={calculate:'1',matched:'yes',pc:'2299000',referenceTotal:'2500000',ramUpgrade:'150000',ssdUpgrade:'30000',otherUpgrade:'50000'};
  const result=readCostScenario(query);
  assert.equal(result.upgradeKRW,230000);
  assert.equal(result.result.deliveredPcTotalKRW,2529000);
  assert.equal(result.result.savingsKRW,-29000);
  assert.equal(result.result.savingsPct,-1.16);
  assert.equal(readCostScenario({...query,cpu:'700000'}).result.referenceTotalKRW,2500000);
  for(const invalid of [{ramUpgrade:'-100'},{ssdUpgrade:['100','200']},{otherUpgrade:'1.5'},{referenceTotal:'0'},{pc:'100000000'}]) {
    assert.equal(readCostScenario({...query,...invalid}).result,null);
  }
});
