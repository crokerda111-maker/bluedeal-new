import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {formatKoreanDate} from '../../src/lib/postStorage.ts';

test('post timestamps use KST across midnight and explicit source offsets',()=>{
  assert.equal(formatKoreanDate('2026-11-16T15:05:00Z'),'2026-11-17 00:05');
  assert.equal(formatKoreanDate('2026-11-17T00:05:00+09:00'),'2026-11-17 00:05');
  assert.equal(formatKoreanDate('2026-11-16T07:05:00-08:00'),'2026-11-17 00:05');
});
test('invalid and timezone-free timestamps do not invent a publication time',()=>{
  for(const value of ['', 'invalid', '2026-11-16T15:05:00', '2026-11-16'])assert.equal(formatKoreanDate(value),'작성일 미확인');
});
test('server and browser host timezones cannot shift the displayed post day',()=>{
  const moduleUrl=new URL('../../src/lib/postStorage.ts',import.meta.url).href;
  const script=`import {formatKoreanDate} from ${JSON.stringify(moduleUrl)}; console.log(formatKoreanDate('2026-11-16T15:05:00Z'));`;
  for(const TZ of ['UTC','America/Los_Angeles','Asia/Seoul']){
    const result=execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],{env:{...process.env,TZ,NODE_NO_WARNINGS:'1'},encoding:'utf8',windowsHide:true});
    assert.equal(result.trim(),'2026-11-17 00:05');
  }
});
