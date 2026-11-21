// Local HTTP integration checks for the server-rendered calculator. No outbound clicks.
import assert from 'node:assert/strict';
const base=process.env.BLUEDEAL_CATALOG_TEST_URL??'http://127.0.0.1:3000';
async function read(path){const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.text();}
const empty=await read('/evaluate');
assert.match(empty,/PC 구매 판단/);assert.match(empty,/name="robots" content="noindex, nofollow"/);
assert.equal((empty.match(/id="cost-/g)||[]).length,11);
assert.match(empty,/name="matched"/);assert.doesNotMatch(empty,/직접 입력한 조건의 계산 결과/);
assert.match(empty,/Intel Core i7-14700K/);assert.match(empty,/품질 점수: 검토 중/);
assert.match(empty,/제조사 공지/);assert.match(empty,/https:\/\/www.intel.com/);
console.log('PASS empty calculator, noindex, labels, source cards and unknown score');
const p=new URLSearchParams({calculate:'1',mode:'halfpc',matched:'yes',cpu:'100000',motherboard:'100000',ram:'100000',storage:'100000',gpu:'0',psu:'100000',case:'100000',cooler:'0',shipping:'3000',services:'50000',pc:'600000'});
const valid=await read('/evaluate?'+p);
assert.match(valid,/본체가 53,000원 저렴합니다/);assert.match(valid,/8.12/);assert.match(valid,/653,000원/);
assert.doesNotMatch(valid,/입력값을 확인해 주세요/);
console.log('PASS manual scenario form request to server arithmetic to rendered result');
p.set('pc','700000');const expensive=await read('/evaluate?'+p);assert.match(expensive,/본체가 47,000원 더 비쌉니다/);assert.match(expensive,/-7.2/);
console.log('PASS negative savings remain visible');
p.delete('shipping');const incomplete=await read('/evaluate?'+p);assert.match(incomplete,/입력값을 확인해 주세요/);assert.doesNotMatch(incomplete,/직접 입력한 조건의 계산 결과/);
p.set('cpu','<script>alert(1)</script>');p.append('ram','300000');const invalid=await read('/evaluate?'+p);assert.doesNotMatch(invalid,/<script>alert\(1\)<\/script>/);assert.doesNotMatch(invalid,/직접 입력한 조건의 계산 결과/);
console.log('PASS missing fees, duplicate inputs and malformed amounts are rejected');
assert.match(await read('/prices'),/href="\/evaluate"/);
console.log('PASS price hub links to PC evaluation');
