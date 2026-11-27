// Exercises the real Next.js HTTP routes against disposable, local-only KV data.
// Run after `npm run build`. No production credentials or services are used.
import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { load } from 'cheerio';
import reservedPorts from 'next/dist/lib/helpers/get-reserved-port.js';
import { assertBrowserHeaders } from './browser-headers.mjs';
import { assertPublicMetadata, assertExcludedMetadata } from './page-metadata.mjs';
import { getPublicPriceSnapshot } from '../../src/lib/priceSnapshot.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const generatedLinks = JSON.parse(await readFile(new URL('../../src/content/outbound.generated.json', import.meta.url), 'utf8'));
const preview = process.argv.includes('--preview');
const affiliatePreview = preview && process.argv.includes('--affiliate-preview');
let affiliatePreviewBase;
const servers = new Set();
const children = new Set();
const results = [];

async function listen(server) {
  // Windows can allocate a port (for example 6000) rejected by Next.js and Fetch.
  for (let attempt = 0; attempt < 10; attempt++) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    if (!reservedPorts.isPortIsReserved(port)) return port;
    await new Promise(resolve => server.close(resolve));
  }
  throw new Error('Could not allocate a non-reserved local test port');
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  await exited;
  children.delete(child);
}

function cleanup() {
  for (const child of children) child.kill();
  for (const server of servers) server.close();
}
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

async function startApp(env = {}) {
  const probe = http.createServer();
  const port = await listen(probe);
  await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: root,
    env: {
      ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
      ADMIN_PASSWORD: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '',
      UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '',
      VERCEL_GIT_COMMIT_SHA: '',
      AFFILIATE_LINKS_JSON: '',
      VERCEL: '', BLUEDEAL_GOOGLE_WRITE_LOGIN: '0', BLUEDEAL_GOOGLE_MEMBER_LOGIN: '0',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  children.add(child);
  let logs = '';
  child.stdout.on('data', chunk => { logs = (logs + chunk).slice(-4000); });
  child.stderr.on('data', chunk => { logs = (logs + chunk).slice(-4000); });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next.js exited: ${logs}`);
    try {
      const response = await fetch(`${base}/api/admin/status`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return { child, base };
    } catch { /* server is starting */ }
    await delay(200);
  }
  throw new Error(`Next.js did not become ready: ${logs}`);
}

async function mockKv() {
  const controls = { unavailable: false, partial: false, malformed: false, truncated: false, slowHardware: false, invalidAuthCounter: false, nowMs: Date.now() };
  const requests = [];
  const values = new Map();
  const hashes = new Map();
  const sorted = new Map();
  const expires = new Map();
  const token = randomBytes(24).toString('hex');
  function command([name, ...args]) {
    const [key, value] = args;
    if (expires.has(key) && expires.get(key) <= controls.nowMs) {
      values.delete(key); sorted.delete(key); expires.delete(key);
    }
    switch (String(name).toUpperCase()) {
      case 'GET': return values.get(key) ?? null;
      case 'MGET': return args.map(item => values.get(item) ?? null);
      case 'SCAN': return ['0', [...values.keys()].filter(item => item.startsWith(args[2].slice(0, -1)))];
      case 'HGET': return hashes.get(key)?.get(value) ?? null;
      case 'HSET':
      case 'HSETNX': {
        const fields = hashes.get(key) ?? new Map();
        const exists = fields.has(value);
        if (name === 'HSET') fields.set(value, args[2]);
        else if (!exists) fields.set(value, args[2]);
        hashes.set(key, fields);
        return Number(!exists);
      }
      case 'HDEL': return Number(hashes.get(key)?.delete(value) ?? false);
      case 'SET': {
        if (args.includes('NX', 2) && values.has(key)) return null;
        values.set(key, value);
        expires.delete(key);
        const ex = args.indexOf('EX', 2);
        if (ex >= 0) expires.set(key, controls.nowMs + Number(args[ex + 1]) * 1000);
        return 'OK';
      }
      case 'SETNX': if (values.has(key)) return 0; values.set(key, value); return 1;
      case 'MSETNX': {
        const keys = args.filter((_, i) => i % 2 === 0);
        if (keys.some(item => values.has(item))) return 0;
        keys.forEach((item, i) => values.set(item, args[i * 2 + 1]));
        return 1;
      }
      case 'DEL': return args.reduce((count, item) => {
        expires.delete(item);
        return count + Number(values.delete(item));
      }, 0);
      case 'EVAL': {
        const keyCount = Number(value);
        const keys = args.slice(2, 2 + keyCount);
        const argv = args.slice(2 + keyCount);
        if (key.includes('HSETNX')) {
          const [readyKey, indexKey, ...records] = keys;
          if (command(['GET', readyKey])) return 0;
          records.forEach((profile, i) => {
            const [field, owner, expected] = argv.slice(i * 3, i * 3 + 3);
            if (command(['GET', profile]) === expected) command(['HSETNX', indexKey, field, owner]);
          });
          return 1;
        }
        const [sessionKey, revokedKey, profileKey, authorKey, suspensionKey, nicknameIndex] = keys;
        const [issuedAt, rawOrRevokedAt, accountOrSeconds] = argv;
        const revokedAt = command(['GET', revokedKey]);
        if (!command(['GET', sessionKey]) || (revokedAt !== null && Number(revokedAt) >= Number(issuedAt))) return null;
        const profile = command(['GET', profileKey]);
        if (keyCount === 6) {
          if (command(['GET', suspensionKey])) return null;
          const [, , account, field, previous, previousField, alias, nickname] = argv;
          if (profile) {
            const saved = JSON.parse(profile);
            if (saved.nickname !== previous || saved.alias !== alias) return null;
            if (command(['HGET', nicknameIndex, previousField]) === account) return ['saved', previous];
          } else if (previous) return null;
          const owner = command(['HGET', nicknameIndex, field]);
          if (owner && owner !== account) return ['taken'];
          command(['HSET', nicknameIndex, field, account]);
          command(['SET', authorKey, accountOrSeconds]);
          command(['SET', profileKey, rawOrRevokedAt]);
          return ['saved', nickname];
        }
        const [, , , alias, previous, field, account] = argv;
        if (keyCount !== 5 || !profile || JSON.parse(profile).alias !== alias || JSON.parse(profile).nickname !== previous) return null;
        command(['SET', revokedKey, rawOrRevokedAt, 'EX', accountOrSeconds]);
        command(['DEL', sessionKey, profileKey, authorKey]);
        if (command(['HGET', suspensionKey, field]) === account) command(['HDEL', suspensionKey, field]);
        return 1;
      }
      case 'EXISTS': return Number(values.has(key));
      case 'INCR': { const n = Number(values.get(key) ?? 0) + 1; values.set(key, n); return n; }
      case 'EXPIRE': {
        if (!values.has(key) && !sorted.has(key)) return 0;
        if (args[2] === 'NX' && expires.has(key)) return 0;
        expires.set(key, controls.nowMs + Number(value) * 1000); return 1;
      }
      case 'TTL': return !values.has(key) && !sorted.has(key) ? -2 : expires.has(key) ? Math.max(0, Math.ceil((expires.get(key) - controls.nowMs) / 1000)) : -1;
      case 'ZADD': {
        const entries = sorted.get(key) ?? new Map();
        const nx = value === 'NX';
        const [score, id] = args.slice(nx ? 2 : 1);
        const exists = entries.has(id);
        if (!nx || !exists) entries.set(id, Number(score));
        sorted.set(key, entries); return Number(!exists);
      }
      case 'ZREM': return Number(sorted.get(key)?.delete(value) ?? false);
      case 'ZREVRANK': {
        const rank = [...(sorted.get(key) ?? new Map())].sort((a, b) => b[1] - a[1]).findIndex(([id]) => id === value);
        return rank < 0 ? null : rank;
      }
      case 'ZREVRANGE': {
        if (!Number.isInteger(Number(value)) || !Number.isInteger(Number(args[2]))) throw new Error('Redis range indexes must be integers');
        return [...(sorted.get(key) ?? new Map())].sort((a, b) => b[1] - a[1]).slice(Number(value), Number(args[2]) + 1).map(([id]) => id);
      }
      default: throw new Error(`Unexpected test KV command: ${name}`);
    }
  }
  const server = http.createServer(async (req, res) => {
    try {
      assert.equal(req.headers.authorization, `Bearer ${token}`);
      assert.equal(req.method, 'POST');
      assert.ok(['/', '/pipeline', '/multi-exec'].includes(req.url), 'KV data must stay in the body, never in the URL');
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const commands = req.url === '/' ? [parsed] : parsed;
      requests.push({ method: req.method, url: req.url, commands });
      if (controls.slowHardware && commands.some(item => item[0] === 'ZREVRANGE' && item[1] === 'bd:board:hardware:posts')) {
        await delay(2000);
        console.log('LOCAL_DELAYED_HARDWARE_COMPLETED');
      }
      if (controls.unavailable || (controls.outboundUnavailable && commands.some(item => item[0] === 'GET' && String(item[1]).startsWith('bd:out:code:'))) || (controls.partial && JSON.stringify(commands).includes('bd:board:review:posts'))) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PRIVATE_BACKEND_DIAGNOSTIC_DO_NOT_EXPOSE' }));
        return;
      }
      if (controls.malformed) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ unexpected: 'PRIVATE_BACKEND_DIAGNOSTIC_DO_NOT_EXPOSE' }));
        return;
      }
      if (controls.truncated && req.url === '/pipeline') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
        return;
      }
      if (controls.invalidAuthCounter && req.url === '/multi-exec' && commands[0]?.[0] === 'INCR') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ result: 1 }, { result: 0 }, { result: -1 }]));
        return;
      }
      const result = req.url === '/' ? { result: command(parsed) } : commands.map(item => ({ result: command(item) }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  const port = await listen(server);
  servers.add(server);
  // A historical malformed private record must stay closed to anonymous users.
  values.set('bd:post:legacy-private', JSON.stringify({ id: 'legacy-private', boardKey: 'inquiry', type: 'general', title: 'Legacy private fixture', content: 'legacy secret', isPrivate: true, passwordHash: '', createdAt: new Date().toISOString() }));
  return { url: `http://127.0.0.1:${port}`, token, values, sorted, controls, requests, expires };
}

async function authenticationFixture(platform = true) {
  const kv = await mockKv();
  const password = randomBytes(24).toString('hex');
  const env = { ADMIN_PASSWORD: password, KV_REST_API_URL: kv.url, KV_REST_API_TOKEN: kv.token, VERCEL: platform ? '1' : '' };
  let app = await startApp(env);
  return {
    kv, password,
    async restart() { await stopChild(app.child); app = await startApp(env); },
    async stop() { await stopChild(app.child); },
    async call(route, body, options = {}) {
      const response = await fetch(app.base + route, {
        method: options.method ?? 'POST', signal: AbortSignal.timeout(15000),
        headers: {
          Origin: options.origin ?? app.base,
          'x-vercel-forwarded-for': options.ip ?? '198.51.100.10',
          'x-forwarded-for': options.forwardedFor ?? '203.0.113.250',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(options.cookie ? { Cookie: options.cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, headers: response.headers, data: await response.json() };
    },
  };
}

async function previewProxy(upstream) {
  const faults = { logout: false, malformedApi: false, slowNavigation: false };
  const target = new URL(upstream);
  const server = http.createServer(async (req, res) => {
    const pathname = req.url.split('?')[0];
    const postDetail = /^(?:\/(?:it|contact)\/[^/]+|\/community\/[^/]+\/[^/]+)$/.test(pathname) && !pathname.endsWith('/write');
    if (faults.slowNavigation && req.method === 'GET' && postDetail) {
      console.log('LOCAL_POST_NAVIGATION_DELAY_STARTED');
      const started = Date.now();
      while (faults.slowNavigation && Date.now() - started < 15000 && !res.destroyed) await delay(100);
      if (res.destroyed) return;
    }
    if (faults.malformedApi && req.method === 'GET' && /^\/api\/posts(?:\/|\?|$)/.test(req.url)) {
      req.resume();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(req.url.split('?')[0] === '/api/posts' ? { posts: null } : { post: null }));
      return;
    }
    if (faults.logout && req.url.split('?')[0] === '/api/admin/logout') {
      req.resume();
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'LOCAL TEST logout service unavailable' }));
      return;
    }
    // Preserve the browser's Host so the real same-origin guard is still exercised.
    // The destination is fixed to this disposable app, independent of the request path.
    const forwarded = http.request({ hostname: target.hostname, port: target.port, path: req.url, method: req.method, headers: req.headers }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    forwarded.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }); res.end('{"error":"LOCAL TEST upstream unavailable"}'); });
    req.on('aborted', () => forwarded.destroy());
    req.pipe(forwarded);
  });
  const port = await listen(server);
  servers.add(server);
  return { base: `http://127.0.0.1:${port}`, faults };
}

async function request(base, method, route, body, cookie) {
  const response = await fetch(base + route, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  return { status: response.status, data, headers: response.headers };
}

async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false }); console.error(`FAIL ${name}: ${error.message}`); }
}

try {
  const unconfigured = await startApp();
  await check('missing admin password fails closed', async () => {
    const response = await request(unconfigured.base, 'POST', '/api/admin/login', { password: 'test-only' });
    assert.equal(response.status, 503);
    assert.equal(response.data.errorCode, 'ADMIN_PASSWORD_NOT_CONFIGURED');
    assert.equal(response.headers.has('set-cookie'), false);
  });
  await check('missing KV returns explicit 503', async () => {
    const response = await request(unconfigured.base, 'GET', '/api/posts?boardKey=hardware');
    assert.equal(response.status, 503);
    assert.equal(response.data.errorCode, 'KV_NOT_CONFIGURED');
  });
  await check('forged cookie never grants access without configuration', async () => {
    assert.equal((await request(unconfigured.base, 'GET', '/api/admin/status', undefined, 'bd_admin=fake')).data.admin, false);
  });
  await check('generated price links work without online storage', async () => {
    for (const [code, row] of Object.entries(generatedLinks)) {
      const response = await fetch(`${unconfigured.base}/go/${code}`, { redirect: 'manual' });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), row.originalUrl);
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      await response.text();
    }
  });
  await stopChild(unconfigured.child);

  const kv = await mockKv();
  const password = process.env.BLUEDEAL_TEST_ADMIN_PASSWORD || randomBytes(24).toString('hex');
  const fixtureCommit = 'a'.repeat(40);
  const app = await startApp({ ADMIN_PASSWORD: password, KV_REST_API_URL: kv.url, KV_REST_API_TOKEN: kv.token, VERCEL_GIT_COMMIT_SHA: fixtureCommit });
  await check('price pages disclose configured affiliate links and label ordinary links without exposing private targets', async () => {
    const ordinary = await (await fetch(app.base + '/prices/ram')).text();
    const disclosure = '이 포스팅은 제휴마케팅이 포함된 광고로 커미션을 지급 받습니다.';
    assert.ok(ordinary.includes('아래 가격 기록의 판매처 링크는 일반 링크입니다.'));
    assert.equal(ordinary.includes(disclosure), false);
    assert.equal(ordinary.includes('rel="sponsored noopener noreferrer"'), false);
    const price = JSON.parse(await readFile(path.join(root, 'src/content/prices/ram.json'), 'utf8')).items[0];
    const outbound = generatedLinks[price.goCode];
    assert.equal(outbound.merchant, 'gmarket');
    for (const affiliateUrl of ['https://app.ac/testAffiliate000', 'https://click.linkprice.com/click.php?m=gmarket&a=A000000000&l=9999&l_cd1=TEST_ONLY&l_cd2=0&tu=' + encodeURIComponent(outbound.originalUrl)]) {
      const testApp = await startApp({ AFFILIATE_LINKS_JSON: JSON.stringify([{ merchant: 'gmarket', provider: 'linkprice', originalUrl: outbound.originalUrl, affiliateUrl }]) });
      try {
      const html = await (await fetch(testApp.base + '/prices/ram')).text();
      assert.ok(html.indexOf(disclosure) >= 0 && html.indexOf(disclosure) < html.indexOf('판매처 보기 ↗'));
      assert.ok(html.includes('rel="sponsored noopener noreferrer"'));
      assert.ok(html.includes('제휴 링크') && html.includes('일반 링크'));
      assert.equal(html.includes('testAffiliate000'), false);
      assert.equal(html.includes('A000000000'), false);
      const redirect = await fetch(testApp.base + '/go/' + price.goCode, { redirect: 'manual' });
      assert.equal(redirect.status, 302);
      assert.equal(redirect.headers.get('location'), affiliateUrl);
      const cpu = await (await fetch(testApp.base + '/prices/cpu')).text();
      assert.ok(cpu.includes('아래 가격 기록의 판매처 링크는 일반 링크입니다.'));
      assert.equal(cpu.includes(disclosure), false);
      } finally { await stopChild(testApp.child); }
    }
  });
  const gm = Object.values(generatedLinks).find(row => row.merchant === 'gmarket');
  const fakeMappings = [
    {merchant:'gmarket',provider:'linkprice',originalUrl:gm.originalUrl,affiliateUrl:'https://app.ac/testOnlyPostNotice'},
    {merchant:'coupang',provider:'coupang',originalUrl:'https://www.coupang.com/vp/products/1',affiliateUrl:'https://link.coupang.com/a/testOnlyPostNotice'},
    {merchant:'aliexpress',provider:'aliexpress',code:'local-ali',originalUrl:'https://www.aliexpress.com/',affiliateUrl:'https://s.click.aliexpress.com/e/_FAKE_POST_NOTICE'},
    {merchant:'aliexpress',provider:'aliexpress',code:'aliexpress-offer',originalUrl:'https://ko.aliexpress.com/item/1005013473947755.html',affiliateUrl:'https://s.click.aliexpress.com/e/_FAKE_PRODUCT_OFFER'},
  ];
  for (const [code,merchant,originalUrl] of [
    ['dyn-cp','coupang','https://www.coupang.com/vp/products/1'],
    ['dyn-external','coupang','https://link.coupang.com/a/EXTERNAL_TEST'],
    ['dyn-ordinary','gmarket','https://item.gmarket.co.kr/Item?goodscode=1234567890'],
    ['dyn-blocked','coupang','https://example.invalid/blocked'],
  ]) kv.values.set('bd:out:code:'+code,JSON.stringify({code,merchant,originalUrl}));
  const mixedPost = {id:'local-affiliate-disclosure',boardKey:'hardware',type:'general',title:'LOCAL 제휴 고지 검증',createdAt:new Date().toISOString(),content:[
    '일반 문서 https://example.invalid/manual.',`사이트 G마켓 /go/${gm.code}`,'쿠팡 /go/dyn-cp','외부 제휴 /go/dyn-external',
    '일반 판매처 /go/dyn-ordinary','미확인 /go/dyn-blocked','알리 /go/local-ali',`직접 일반 ${gm.originalUrl}`,
    '직접 외부 https://link.coupang.com/a/EXTERNAL_RAW_TEST',
  ].join('\n'),extra:{source:'/go/'+gm.code}};
  kv.values.set('bd:post:'+mixedPost.id,JSON.stringify(mixedPost));
  const disclosureApp = await startApp({ADMIN_PASSWORD:password,KV_REST_API_URL:kv.url,KV_REST_API_TOKEN:kv.token,AFFILIATE_LINKS_JSON:JSON.stringify(fakeMappings)});
  try {
    await check('verified hotdeals require a fresh option and an administrator; retries keep one post and links resolve', async () => {
      const route = '/api/internal/hotdeal';
      const login = await request(disclosureApp.base, 'POST', '/api/admin/login', { password });
      assert.equal(login.status, 200);
      const session = login.headers.get('set-cookie').split(';')[0];
      const now = Date.now();
      const deal = {
        title: 'LOCAL 검증 핫딜', option: '검정 1개', category: 'pc', productUrl: gm.originalUrl,
        availability: 'in-stock', checkedAt: new Date(now - 60_000).toISOString(),
        validUntil: new Date(now + 180_000).toISOString(), price: 45000, shipping: 3000,
        conditions: '공개 행사 가격', review: '제조사 공식 옵션 확인', issue: '동일 옵션을 선택하세요.',
        notesSource: 'https://example.invalid/verified-option',
      };
      const history = [1, 2, 3].map((days, index) => ({
        productUrl: deal.productUrl, option: deal.option, conditions: deal.conditions,
        availability: deal.availability, at: new Date(Date.parse(deal.checkedAt) - days * 86400000).toISOString(),
        price: 44000 + index * 2000, shipping: 3000,
      }));
      deal.priceHistory = history;
      assert.equal((await request(disclosureApp.base, 'POST', route, deal)).status, 401);
      assert.equal((await request(disclosureApp.base, 'POST', route, { ...deal, availability: 'out-of-stock' }, session)).status, 422);
      assert.equal((await request(disclosureApp.base, 'POST', route, { ...deal, checkedAt: new Date(now - 7 * 3600000).toISOString() }, session)).status, 422);
      for (const priceHistory of [undefined, history.slice(0, 2), history.map(row => ({ ...row, conditions: '특정 카드' })), history.map(row => ({ ...row, option: '다른 옵션' }))]) {
        const response = await request(disclosureApp.base, 'POST', route, { ...deal, priceHistory }, session);
        assert.equal(response.status, 422);
        assert.match(response.data.error, /가격 기록 3일/);
      }
      const tooHigh = await request(disclosureApp.base, 'POST', route, { ...deal, shipping: 5000 }, session);
      assert.equal(tooHigh.status, 422);
      assert.match(tooHigh.data.error, /3% 넘게/);
      assert.equal((await request(disclosureApp.base, 'POST', '/api/posts', {
        boardKey: 'hotdeal', type: 'general', title: 'LOCAL', content: 'fake', authorName: '블루딜  ＡＩ',
      })).status, 400);
      assert.equal((await request(disclosureApp.base, "POST", route, { ...deal, image: "/hotdeals/11st-1234.webp" }, session)).status, 422);
      assert.equal((await request(disclosureApp.base, "POST", route, { ...deal, image: "https://gdimg.gmarket.co.kr/1234/still/600" }, session)).status, 422);
      const results = await Promise.all([request(disclosureApp.base, 'POST', route, deal, session), request(disclosureApp.base, 'POST', route, deal, session)]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 201]);
      const id = results[0].data.id;
      assert.equal(results[1].data.id, id);
      const detail = await request(disclosureApp.base, 'GET', '/api/posts/' + id);
      const post = detail.data.post;
      assert.equal(post.authorName, '블루딜 AI');
      assert.equal(post.hotdeal.price + post.hotdeal.shipping, 48000);
      assert.deepEqual(post.hotdeal.priceEvidence, { low: 47000, count: 3, basis: 'history' });
      assert.match(post.extra.dealLink, /^\/go\/[a-z0-9_-]+$/i);
      assert.ok(post.linkInfo.affiliateHrefs.includes(post.extra.dealLink));
      const list = await request(disclosureApp.base,'GET','/api/posts?boardKey=hotdeal&limit=100');
      assert.equal(list.data.posts.filter(row => row.id === id).length, 1);
      const followed = await fetch(disclosureApp.base + post.extra.dealLink, { redirect: 'manual' });
      assert.equal(followed.headers.get('location'), fakeMappings[0].affiliateUrl);
      const missingMapping = await fetch(app.base + post.extra.dealLink, { redirect: 'manual' });
      assert.equal(missingMapping.status, 302);
      assert.equal(missingMapping.headers.get('location'), gm.originalUrl);
      assert.equal((await request(disclosureApp.base, 'DELETE', '/api/posts/' + id, undefined, session)).status, 200);
      const checkedAt = Date.parse(deal.checkedAt);
      const market = [
        'https://www.11st.co.kr/products/99887766',
        'https://itempage3.auction.co.kr/DetailView.aspx?itemno=A123456789',
      ].map(url => ({ ...history[0], at: new Date(checkedAt - 120_000).toISOString(), productUrl: url, publicPrice: true }));
      const marketInput = { ...deal, shipping: 3410, publicPrice: true, priceHistory: market };
      assert.equal((await request(disclosureApp.base, 'POST', route, { ...marketInput, priceHistory: [market[0], market[0]] }, session)).status, 422);
      assert.equal((await request(disclosureApp.base, 'POST', route, { ...marketInput, publicPrice: false }, session)).status, 422);
      assert.equal((await request(disclosureApp.base, 'POST', route, { ...marketInput, shipping: 3411 }, session)).status, 422);
      const published = await request(disclosureApp.base, 'POST', route, marketInput, session);
      assert.equal(published.status, 201);
      const marketPost = await request(disclosureApp.base, 'GET', '/api/posts/' + published.data.id);
      assert.deepEqual(marketPost.data.post.hotdeal.priceEvidence, { low: 47000, count: 2, basis: 'market' });
      assert.equal((await request(disclosureApp.base, 'DELETE', '/api/posts/' + published.data.id, undefined, session)).status, 200);
    });
    await check('external deal reports need a recent public permalink and can use a normal purchase link', async () => {
      const route = '/api/internal/hotdeal';
      const login = await request(disclosureApp.base, 'POST', '/api/admin/login', { password });
      const session = login.headers.get('set-cookie').split(';')[0];
      const now = Date.now();
      const productUrl = 'https://item.gmarket.co.kr/Item?goodscode=990101966';
      const sourceUrl = 'https://hotdeal.zip/example-discount-ab19';
      const sourceReview = { url: sourceUrl, publishedAt: new Date(now - 8 * 3600000).toISOString(), basis: 'published-discount', status: 'listed' };
      const draft = {
        title: 'LOCAL 출처 소개 핫딜', category: 'food', productUrl, option: '500g 한 팩',
        price: 9900, shipping: 0, conditions: '제시가 기준 할인 쿠폰 적용', review: '구성은 한 팩입니다.',
        issue: '결제 전 쿠폰 적용을 확인하세요.', checkedAt: new Date(now - 60000).toISOString(),
        validUntil: new Date(now + 3600000).toISOString(), availability: 'source-listed', sourceReview,
      };
      for (const source of [
        { ...sourceReview, url: 'https://hotdeal.zip/인기' },
        { ...sourceReview, url: 'https://example.invalid/example-ab19' },
        { ...sourceReview, status: 'ended' }, { ...sourceReview, basis: 'popular' },
        { ...sourceReview, publishedAt: new Date(now - 25 * 3600000).toISOString() },
      ]) assert.equal((await request(disclosureApp.base, 'POST', route, { ...draft, sourceReview: source }, session)).status, 422);
      const published = await request(disclosureApp.base, 'POST', route, draft, session);
      assert.equal(published.status, 201);
      const id = published.data.id;
      const disclosure = await request(disclosureApp.base, 'GET', '/api/posts/' + id);
      const post = disclosure.data.post;
      assert.equal(post.hotdeal.sourceReview.name, '핫딜모음');
      assert.equal(post.hotdeal.sourceReview.url, sourceUrl);
      assert.equal(post.hotdeal.image, 'https://gdimg.gmarket.co.kr/990101966/still/600');
      assert.equal(post.hotdeal.priceEvidence, undefined);
      assert.equal(post.hotdeal.lowestIn30Days, undefined);
      assert.equal(post.linkInfo?.affiliateHrefs?.includes(post.extra.dealLink) ?? false, false);
      const target = await fetch(disclosureApp.base + post.extra.dealLink, { redirect: 'manual' });
      assert.equal(target.headers.get('location'), productUrl);
      const homepage = await request(disclosureApp.base, 'GET', '/api/home-feed');
      assert.ok(homepage.data.deals.some(item => item.priceSource === '핫딜모음' && item.href.endsWith(id)));
      assert.equal((await request(disclosureApp.base, 'DELETE', '/api/posts/' + id, undefined, session)).status, 200);

      const compuzone = 'https://m.compuzone.co.kr/product/product_detail.htm?ProductNo=1252712';
      const invalid = await request(disclosureApp.base, 'POST', route, { ...draft, productUrl: compuzone + '&ProductNo=1252713' }, session);
      assert.equal(invalid.status, 422);
      const cooler = await request(disclosureApp.base, 'POST', route, { ...draft, title: 'LOCAL 시스템 팬', productUrl: compuzone }, session);
      assert.equal(cooler.status, 201);
      const coolerPost = (await request(disclosureApp.base, 'GET', '/api/posts/' + cooler.data.id)).data.post;
      assert.equal(coolerPost.extra.store, '컴퓨존');
      assert.equal((await request(disclosureApp.base, 'DELETE', '/api/posts/' + cooler.data.id, undefined, session)).status, 200);
    });
    await check('tracked Coupang lows require the exact option and a matching current public price', async () => {
      const route = '/api/internal/hotdeal';
      const login = await request(disclosureApp.base, 'POST', '/api/admin/login', { password });
      const session = login.headers.get('set-cookie').split(';')[0];
      const now = Date.now();
      const productUrl = 'https://www.coupang.com/vp/products/651655?itemId=743512&vendorItemId=876215';
      const tracker = { url: 'https://www.lowchart.com/651655-743512', checkedAt: new Date(now - 120_000).toISOString(), observedLow: 9900 };
      const image = 'https://thumbnail.coupangcdn.com/thumbnails/remote/640x640ex/image/vendor_inventory/fixture/product.jpg';
      const draft = {
        title: 'LOCAL 쿠팡 관측 최저', category: 'pc', productUrl, option: '블랙 1개',
        price: 9900, shipping: 2500, conditions: '일반 판매가', review: '한 개 구성입니다.', issue: '규격을 확인하세요.',
        checkedAt: new Date(now - 60_000).toISOString(), validUntil: new Date(now + 3_600_000).toISOString(),
        availability: 'in-stock', publicPrice: true, coupangTrackedLow: tracker, image,
      };
      for (const changes of [
        { publicPrice: false }, { price: 11900 }, { image: 'https://example.invalid/unreviewed.jpg' },
        { coupangTrackedLow: { ...tracker, url: 'https://www.lowchart.com/651655-743513' } },
        { coupangTrackedLow: { ...tracker, checkedAt: new Date(now - 9_000_000).toISOString() } },
        { validUntil: new Date(now + 25_200_000).toISOString() },
      ]) assert.equal((await request(disclosureApp.base, 'POST', route, { ...draft, ...changes }, session)).status, 422);
      const result = await request(disclosureApp.base, 'POST', route, draft, session);
      assert.equal(result.status, 201);
      const id = result.data.id;
      const detail = (await request(disclosureApp.base, 'GET', '/api/posts/' + id)).data.post;
      assert.equal(detail.hotdeal.coupangTrackedLow.url, tracker.url);
      assert.equal(detail.hotdeal.image, image);
      assert.equal(detail.hotdeal.lowestIn30Days, undefined);
      assert.equal(detail.hotdeal.shipping, 2500);
      assert.equal((await request(disclosureApp.base, 'DELETE', '/api/posts/' + id, undefined, session)).status, 200);
    });
    await check('reviewed news publish once and price observations expose only public quotes', async () => {
      const route = '/api/internal/editorial-news';
      const sourceUrl = 'https://nvidianews.nvidia.com/news/local-fixture';
      const draft = { sourceUrl, title: '테스트 뉴스', content: '로컬 검증 전용 기사입니다.',
        publishedAt: new Date(Date.now()-60_000).toISOString(), reviewed: true, translation: true, koreanEditing: true,
        proofreading: true, sensitiveContext: true };
      assert.equal((await request(disclosureApp.base,'POST',route,draft)).status,401);
      const login = await request(disclosureApp.base,'POST','/api/admin/login',{password});
      const cookie = login.headers.get('set-cookie').split(';')[0];
      assert.equal((await request(disclosureApp.base,'POST',route,{...draft,sensitiveContext:false},cookie)).status,422);
      assert.equal((await request(disclosureApp.base,'POST',route,{...draft,sourceUrl:'https://untrusted.example/fake'},cookie)).status,422);
      const created = await request(disclosureApp.base,'POST',route,draft,cookie);
      assert.equal(created.status,201);
      const repeat = await request(disclosureApp.base,'POST',route,{...draft,sourceUrl:sourceUrl+'/?utm=test'},cookie);
      assert.equal(repeat.status,200);
      assert.equal(repeat.data.id,created.data.id);
      assert.equal((await request(disclosureApp.base,'GET','/api/posts/'+created.data.id)).data.post.content.includes(sourceUrl),true);
      assert.equal((await request(disclosureApp.base,'DELETE','/api/posts/'+created.data.id,undefined,cookie)).status,200);
      const prices = await request(disclosureApp.base,'GET','/api/prices/observations');
      assert.equal(prices.data.service,'BLUEDEAL');
      assert(prices.data.observations.some(row=>row.category==='fullpc'&&Number.isInteger(row.price)));
      assert.doesNotMatch(JSON.stringify(prices.data.observations.map(row=>Object.keys(row))),/goCode|originalUrl|affiliate|token/i);
    });
    await check('manual product cards require the matching registered source and keep prices and issued targets private', async () => {
      const name='MCHOSE V9 Pro2 게이밍 헤드셋';
      const html=await(await fetch(disclosureApp.base+'/about')).text();
      assert.ok(html.includes(name)&&html.includes('V9 Pro2 White (화이트)'));
      assert.ok(html.includes('상품 정보 확인:')&&html.includes('2026-11-17'));
      assert.ok(html.indexOf('이 글에는 제휴 링크가 포함되어 있습니다.')<html.indexOf(name));
      assert.ok(html.includes('href="/go/aliexpress-offer"')&&html.includes('rel="sponsored noopener noreferrer"'));
      for(const text of ['44,600','15ms','THX','_FAKE_PRODUCT_OFFER']) assert.equal(html.includes(text),false);
      assert.equal((await(await fetch(app.base+'/about')).text()).includes(name),false);
      const other=await startApp({AFFILIATE_LINKS_JSON:JSON.stringify([{...fakeMappings.at(-1),originalUrl:'https://www.aliexpress.com/item/123.html'}])});
      try {
        const changed=await(await fetch(other.base+'/about')).text();
        assert.equal(changed.includes(name),false);
        assert.equal(changed.includes('V9 Pro2 White'),false);
        assert.ok(changed.includes('알리 제휴 페이지로 이동'));
      } finally {await stopChild(other.child);}
    });
    await check('post detail classifies actual static, stored and manual affiliate links without serializing private targets or counting clicks', async () => {
      const before=kv.requests.length;
      const response=await request(disclosureApp.base,'GET','/api/posts/'+mixedPost.id);
      assert.equal(response.status,200);
      const info=response.data.post.linkInfo;
      assert.deepEqual([...info.disclosures].sort(),['bluedeal','coupang','external','linkprice']);
      assert.deepEqual([...info.affiliateHrefs].sort(),['/go/'+gm.code,'/go/dyn-cp','/go/dyn-external','/go/local-ali','https://link.coupang.com/a/EXTERNAL_RAW_TEST'].sort());
      assert.deepEqual(info.unavailableHrefs,['/go/dyn-blocked']);
      for(const row of fakeMappings) assert.equal(JSON.stringify(response.data).includes(row.affiliateUrl),false);
      const commands=kv.requests.slice(before).flatMap(item=>item.commands);
      assert.equal(commands.some(item=>item[0]==='INCR'),false);
      assert.equal(commands.filter(item=>item[0]==='GET'&&String(item[1]).startsWith('bd:out:code:')).length,4);
      assert.equal(kv.requests.slice(before).filter(item=>item.url==='/pipeline').length,1);
      assert.equal('linkInfo' in JSON.parse(kv.values.get('bd:post:'+mixedPost.id)),false);
    });
    await check('ordinary links and direct merchant URLs never acquire a commission claim from an unrelated redirect mapping', async () => {
      const ordinary={...mixedPost,id:'local-ordinary-disclosure',content:`일반 /go/${gm.code} /go/dyn-cp /go/dyn-ordinary ${gm.originalUrl}`};
      kv.values.set('bd:post:'+ordinary.id,JSON.stringify(ordinary));
      const response=await request(app.base,'GET','/api/posts/'+ordinary.id);
      assert.equal(response.status,200);
      assert.deepEqual(response.data.post.linkInfo,{affiliateHrefs:[],unavailableHrefs:[],disclosures:[]});
      const configured=await request(disclosureApp.base,'GET','/api/posts/'+ordinary.id);
      assert.equal(configured.data.post.linkInfo.affiliateHrefs.includes(gm.originalUrl),false);
    });
    await check('private affiliate details are classified only after authorized access and never appear in an anonymous list', async () => {
      const privatePost={...mixedPost,id:'local-private-links',boardKey:'inquiry',isPrivate:true,passwordHash:createHash('sha256').update('LOCAL_LINK_PASSWORD').digest('hex')};
      kv.values.set('bd:post:'+privatePost.id,JSON.stringify(privatePost));
      const entries=kv.sorted.get('bd:board:inquiry:posts')??new Map();entries.set(privatePost.id,Date.now());kv.sorted.set('bd:board:inquiry:posts',entries);
      const before=kv.requests.length;
      const locked=await request(disclosureApp.base,'GET','/api/posts/'+privatePost.id);
      assert.equal(locked.status,401);assert.equal('post' in locked.data,false);
      assert.equal(kv.requests.slice(before).some(item=>item.commands.some(command=>String(command[1]).startsWith('bd:out:code:'))),false);
      const list=await request(disclosureApp.base,'GET','/api/posts?boardKey=inquiry');
      const masked=list.data.posts.find(post=>post.id===privatePost.id);
      assert.equal(masked.content,'');assert.equal('extra' in masked,false);assert.equal('linkInfo' in masked,false);
      const unlocked=await request(disclosureApp.base,'POST','/api/posts/'+privatePost.id+'/unlock',{password:'LOCAL_LINK_PASSWORD'});
      assert.equal(unlocked.status,200);assert.ok(unlocked.data.post.linkInfo.disclosures.includes('linkprice'));
      assert.equal('passwordHash' in unlocked.data.post,false);
    });
    await check('unavailable or excessive stored-link lookups preserve text while bounding storage work and withholding unverified links', async () => {
      kv.controls.outboundUnavailable=true;
      try {
        const response=await request(disclosureApp.base,'GET','/api/posts/'+mixedPost.id);
        assert.equal(response.status,200);assert.equal(response.data.post.content,mixedPost.content);
        assert.deepEqual([...response.data.post.linkInfo.unavailableHrefs].sort(),['/go/dyn-cp','/go/dyn-external','/go/dyn-ordinary','/go/dyn-blocked'].sort());
        assert.doesNotMatch(JSON.stringify(response.data),/PRIVATE_BACKEND_DIAGNOSTIC/);
      } finally {kv.controls.outboundUnavailable=false;}
      const hrefs=Array.from({length:101},(_,n)=>'/go/bulk-'+String(n).padStart(3,'0'));
      for(const href of hrefs)kv.values.set('bd:out:code:'+href.slice(4),JSON.stringify({merchant:'coupang',originalUrl:'https://www.coupang.com/vp/products/2'}));
      const bulk={...mixedPost,id:'local-many-link-disclosure',content:hrefs.join(' '),extra:{}};
      kv.values.set('bd:post:'+bulk.id,JSON.stringify(bulk));
      const before=kv.requests.length;const response=await request(app.base,'GET','/api/posts/'+bulk.id);
      assert.equal(response.status,200);assert.equal(response.data.post.content,bulk.content);
      assert.deepEqual(response.data.post.linkInfo.unavailableHrefs,[hrefs[100]]);
      const reads=kv.requests.slice(before).filter(item=>item.commands.some(command=>String(command[1]).startsWith('bd:out:code:')));
      assert.equal(reads.length,1);assert.equal(reads[0].commands.length,100);
    });
    await check('issued mappings migrate idempotently and drive prices, product details and existing hotdeal links without an environment mapping', async () => {
      const route = '/api/internal/affiliate/import';
      const login = await request(disclosureApp.base, 'POST', '/api/admin/login', { password });
      const cookie = login.headers.get('set-cookie')?.split(';')[0];
      assert.equal(login.status, 200);
      assert.ok(cookie);
      assert.equal((await request(disclosureApp.base, 'POST', route, { source: 'legacy' })).status, 401);
      const ram = JSON.parse(await readFile(path.join(root, 'src/content/prices/ram.json'), 'utf8')).items;
      const offer = ram.find(item => generatedLinks[item.goCode]?.merchant === '11st');
      const originalUrl = generatedLinks[offer.goCode].originalUrl;
      const issued = { merchant: '11st', provider: 'linkprice', originalUrl, affiliateUrl: 'https://app.ac/testOnly11stMigration' };
      const hotdealId = 'local-affiliate-migration';
      const postKey = 'bd:post:' + hotdealId;
      let newPostId;
      try {
        const first = await request(disclosureApp.base, 'POST', route, { source: 'legacy' }, cookie);
        assert.equal(first.status, 200);
        assert.deepEqual(first.data, { imported: fakeMappings.length, present: 0, conflicts: 0 });
        const again = await request(disclosureApp.base, 'POST', route, { source: 'legacy' }, cookie);
        assert.deepEqual(again.data, { imported: 0, present: fakeMappings.length, conflicts: 0 });
        const registered = await request(disclosureApp.base, 'POST', route, { mappings: [issued] }, cookie);
        assert.equal(registered.status, 200);
        const conflicting = await request(disclosureApp.base, 'POST', route, { mappings: [{ ...issued, affiliateUrl: 'https://app.ac/testOnlyOtherTarget' }] }, cookie);
        assert.equal(conflicting.status, 409);
        const catalog = JSON.parse(await readFile(path.join(root, 'src/content/products/catalog.json'), 'utf8'));
        const product = catalog.products.find(product => product.listings.some(listing => listing.id === offer.id));
        assert.ok(product);
        for (const path of ['/prices/ram', `/products/${product.id}`]) {
          const html = await (await fetch(app.base + path)).text();
          assert.match(html, /rel="sponsored noopener noreferrer"/);
          assert.equal(html.includes(issued.affiliateUrl), false);
        }
        const priceClick = await fetch(app.base + '/go/' + offer.goCode, { redirect: 'manual' });
        assert.equal(priceClick.headers.get('location'), issued.affiliateUrl);
        const previousAlias = await fetch(app.base + '/go/local-ali', { redirect: 'manual' });
        assert.equal(previousAlias.headers.get('location'), fakeMappings[2].affiliateUrl);
        kv.values.set(postKey, JSON.stringify({ ...mixedPost, id: hotdealId, boardKey: 'hotdeal', content: `판매 ${originalUrl}` }));
        const hotdeal = await request(app.base, 'GET', '/api/posts/' + hotdealId);
        assert.equal(hotdeal.status, 200);
        assert.deepEqual(hotdeal.data.post.linkInfo.disclosures, ['linkprice']);
        const go = hotdeal.data.post.linkInfo.linkReplacements[originalUrl];
        assert.match(go, /^\/go\/af-[a-f0-9]+$/);
        assert.equal((await fetch(app.base + go, { redirect: 'manual' })).headers.get('location'), issued.affiliateUrl);
        assert.equal(JSON.stringify(hotdeal.data).includes(issued.affiliateUrl), false);
        const created = await request(app.base, 'POST', '/api/posts', {
          boardKey: 'hotdeal', type: 'general', title: 'LOCAL QA affiliate hotdeal',
          content: `판매처 ${originalUrl}`, extra: { dealLink: originalUrl },
        });
        assert.equal(created.status, 201);
        newPostId = created.data.post.id;
        const newHotdeal = await request(app.base, 'GET', '/api/posts/' + newPostId);
        const generatedGo = newHotdeal.data.post.extra.dealLink;
        assert.ok(newHotdeal.data.post.linkInfo.affiliateHrefs.includes(generatedGo));
        assert.equal((await fetch(app.base + generatedGo, { redirect: 'manual' })).headers.get('location'), issued.affiliateUrl);
      } finally {
        kv.values.delete(postKey);
        if (newPostId) {
          kv.values.delete('bd:post:' + newPostId);
          kv.sorted.get('bd:board:hotdeal:posts')?.delete(newPostId);
        }
        for (const key of kv.values.keys()) if (key.startsWith('bd:affiliate:')) kv.values.delete(key);
      }
    });
  } finally {if(affiliatePreview)affiliatePreviewBase=disclosureApp.base;else await stopChild(disclosureApp.child);}

  await check('browser security headers cover pages, administrator, API, static content and errors', async () => {
    for (const route of ['/', '/admin', '/api/admin/status', '/icon.svg', '/no-such-verification-page']) {
      const response = await fetch(app.base + route, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
      assertBrowserHeaders(response);
      await response.arrayBuffer();
    }
  });
  const api = (method, route, body, cookie) => request(app.base, method, route, body, cookie);
  let cookie;
  let privateId;
  const publicPosts = [];
  let largePostId;

  await check('post writes reject cross-site, non-JSON, malformed and oversized streamed input before storage', async () => {
    const before = kv.requests.length;
    const cases = [
      { status: 403, headers: { 'Content-Type': 'application/json', Origin: 'https://example.invalid' }, body: '{}' },
      { status: 403, headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' }, body: '{}' },
      { status: 415, headers: { 'Content-Type': 'text/plain' }, body: '{}' },
      { status: 400, headers: { 'Content-Type': 'application/json' }, body: '[]' },
      { status: 400, headers: { 'Content-Type': 'application/json' }, body: 'null' },
      { status: 400, headers: { 'Content-Type': 'application/json' }, body: Buffer.from([0xc3, 0x28]) },
      { status: 413, headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(128 * 1024 + 1) },
    ];
    for (const item of cases) {
      const response = await fetch(app.base + '/api/posts', { method: 'POST', headers: item.headers, body: item.body });
      assert.equal(response.status, item.status); await response.text();
    }
    const payload = new TextEncoder().encode(JSON.stringify({ content: '가'.repeat(50_000) }));
    const stream = new ReadableStream({ start(controller) { for (let at = 0; at < payload.length; at += 4096) controller.enqueue(payload.slice(at, at + 4096)); controller.close(); } });
    const streamed = await fetch(app.base + '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half' });
    assert.equal(streamed.status, 413); await streamed.text();
    assert.equal(kv.requests.length, before);
  });

  await check('post field validation never coerces arrays, nested objects or string privacy flags into stored data', async () => {
    const valid = { boardKey: 'hardware', type: 'general', title: 'LOCAL valid title', content: 'LOCAL valid content' };
    const before = kv.values.size;
    for (const patch of [{ title: ['bad'] }, { content: 42 }, { title: 'x'.repeat(201) }, { content: 'x'.repeat(30_001) },
      { authorName: 'x'.repeat(21) }, { extra: [] }, { extra: { nested: { value: 'bad' } } }, { extra: { note: 'x'.repeat(4001) } },
      { extra: Object.fromEntries(Array.from({ length: 33 }, (_, n) => ['field' + n, 'value'])) }, { isPrivate: 'false' }, { lockToAdminPassword: 'true' }]) {
      assert.equal((await api('POST', '/api/posts', { ...valid, ...patch })).status, 400);
    }
    assert.equal(kv.values.size, before);
  });

  await check('valid large Korean content is stored through a JSON body without a data-bearing storage URL', async () => {
    const response = await api('POST', '/api/posts', { boardKey: 'hardware', type: 'general', title: 'LOCAL large content fixture', content: '가'.repeat(25_000) });
    assert.equal(response.status, 201);
    largePostId = response.data.post.id;
    assert.equal((await api('GET', `/api/posts/${largePostId}`)).data.post.content.length, 25_000);
    assert.ok(kv.requests.every(item => item.method === 'POST' && ['/', '/pipeline', '/multi-exec'].includes(item.url)));
  });

  await check('a link-heavy post bounds conversion work and retains every remaining original URL', async () => {
    const urls = Array.from({ length: 24 }, (_, i) => `https://item.gmarket.co.kr/Item?goodsCode=${9000000000 + i}`);
    const response = await api('POST', '/api/posts', { boardKey: 'hardware', type: 'general', title: 'LOCAL link budget fixture', content: urls.join('\n'), extra: { source: urls[0], another: 'https://item.gmarket.co.kr/Item?goodsCode=9999999999' } });
    assert.equal(response.status, 201);
    const lines = response.data.post.content.split('\n');
    assert.equal(lines.length, 24);
    assert.equal(lines.filter(item => item.startsWith('/go/')).length, 20);
    assert.deepEqual(lines.slice(20), urls.slice(20));
    assert.equal(response.data.post.extra.source, lines[0]);
    assert.equal(response.data.post.extra.another, 'https://item.gmarket.co.kr/Item?goodsCode=9999999999');
  });

  await check('storage failures and malformed success responses never become private diagnostics or empty data', async () => {
    for (const mode of ['unavailable', 'malformed', 'truncated']) {
      kv.controls[mode] = true;
      try {
        const response = await api('GET', '/api/posts?boardKey=hardware');
        assert.equal(response.status, 500);
        assert.equal('posts' in response.data, false);
        assert.doesNotMatch(JSON.stringify(response.data), /PRIVATE_BACKEND_DIAGNOSTIC/);
      } finally { kv.controls[mode] = false; }
    }
  });

  await check('generated price links survive an unavailable KV service', async () => {
    kv.controls.unavailable = true;
    try {
      for (const [code, row] of Object.entries(generatedLinks)) {
        const response = await fetch(`${app.base}/go/${code}`, { redirect: 'manual' });
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), row.originalUrl);
        await response.text();
      }
    } finally { kv.controls.unavailable = false; }
  });

  await check('home is independent of board storage and feed distinguishes outages from empty boards', async () => {
    kv.controls.unavailable = true;
    try {
      const before = kv.requests.length;
      const response = await fetch(app.base);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /핫딜을 불러오는 중입니다/);
      assert.match(html, /<h1[^>]*>오늘의 완본체 베스트<\/h1>/);
      assert.match(html, /<a[^>]+href="\/prices\/fullpc"/);
      assert.match(html, /완본체 조합·예산 비교/);
      const boardReads = kv.requests.slice(before).flatMap(entry => entry.commands).filter(([command, key]) => command === 'ZREVRANGE' && String(key).startsWith('bd:board:'));
      assert.deepEqual(boardReads, [], 'the initial home document must not query boards');
      const feed = await api('GET', '/api/home-feed');
      assert.equal(feed.status, 200);
      assert.equal(feed.data.deals, null);
      assert.ok(feed.data.failedCount > 0);
      assert.match(feed.headers.get('cache-control'), /no-store/);
    } finally { kv.controls.unavailable = false; }
    const feed = await api('GET', '/api/home-feed');
    assert.deepEqual(feed.data.deals, []);
    assert.equal(feed.data.failedCount, 0);
  });

  await check('home feed returns compact public summaries and retains healthy boards during a partial outage', async () => {
    const now = Date.now();
    const deal = {
      option: 'Test model', conditions: '공개가', price: 48000, shipping: 0,
      checkedAt: new Date(now - 60_000).toISOString(), validUntil: new Date(now + 120_000).toISOString(),
    };
    const fixtures = [
      { id: 'home-feed-public-deal', boardKey: 'hotdeal', title: 'Public deal fixture', content: 'Public preview. '.repeat(50), extra: { store: 'Test store' }, hotdeal: { ...deal, priceEvidence: { low: 47000, count: 3, basis: 'history' } } },
      { id: 'home-feed-old-deal', boardKey: 'hotdeal', title: 'UNVERIFIED_DEAL_FIXTURE', hotdeal: deal },
      { id: 'home-feed-expensive-deal', boardKey: 'hotdeal', title: 'EXPENSIVE_DEAL_FIXTURE', hotdeal: { ...deal, priceEvidence: { low: 45000, count: 3, basis: 'history' } } },
      { id: 'home-feed-public-post', boardKey: 'hardware', title: 'Newest public post fixture', content: 'Do not transfer the whole post body' },
      { id: 'home-feed-private', boardKey: 'hotdeal', title: 'PRIVATE_HOTDEAL_TITLE', content: 'PRIVATE_HOTDEAL_BODY', isPrivate: true, passwordHash: 'PRIVATE_HASH' },
      { id: 'home-feed-inquiry', boardKey: 'inquiry', title: 'EXCLUDED_INQUIRY_TITLE', content: 'EXCLUDED_INQUIRY_BODY' },
    ];
    fixtures.forEach((post, index) => {
      const key = 'bd:board:' + post.boardKey + ':posts';
      const entries = kv.sorted.get(key) ?? new Map();
      const score = Date.now() + 1000 + index;
      entries.set(post.id, score);
      kv.sorted.set(key, entries);
      kv.values.set('bd:post:' + post.id, JSON.stringify({ ...post, createdAt: new Date(score).toISOString() }));
    });
    kv.controls.partial = true;
    try {
      const { status, data } = await api('GET', '/api/home-feed');
      assert.equal(status, 200);
      assert.equal(data.failedCount, 1);
      assert.ok(data.deals.some(deal => deal.title === 'Public deal fixture' && deal.excerpt.length <= 140));
      assert.equal(data.posts[0].title, 'Newest public post fixture');
      assert.doesNotMatch(JSON.stringify(data), /PRIVATE_HOTDEAL|PRIVATE_HASH|EXCLUDED_INQUIRY|UNVERIFIED_DEAL_FIXTURE|EXPENSIVE_DEAL_FIXTURE|Do not transfer the whole post body/);
    } finally {
      kv.controls.partial = false;
      for (const post of fixtures) {
        kv.values.delete('bd:post:' + post.id);
        kv.sorted.get('bd:board:' + post.boardKey + ':posts')?.delete(post.id);
      }
    }
  });

  await check('deployment version exposes only public release metadata without caching', async () => {
    const response = await api('GET', '/api/version');
    assert.equal(response.status, 200);
    assert.equal(response.data.service, 'BLUEDEAL');
    assert.match(response.data.version, /^\d+\.\d+\.\d+$/);
    assert.equal(response.data.commit, fixtureCommit);
    assert.deepEqual(Object.keys(response.data).sort(), ['commit', 'service', 'version']);
    assert.match(response.headers.get('cache-control'), /no-store/);
  });

  await check('prebuilt analysis renders 8 independent ratings and distinguishes budget and unknown specs', async () => {
    async function details(id) {
      const response = await fetch(`${app.base}/products/${id}`);
      assert.equal(response.status, 200);
      const $ = load(await response.text());
      const parts = $('[data-part-quality]');
      assert.deepEqual(parts.toArray().map(part => $(part).attr('data-part-quality')),
        ['cpu', 'gpu', 'board', 'ram', 'storage', 'psu', 'cooler', 'case']);
      for (const part of parts.toArray()) {
        const dialog = $(part).find('dialog').first();
        assert.equal($(part).find('button[aria-haspopup="dialog"]').attr('aria-controls'), dialog.attr('id'));
        const checked = dialog.text().match(/채점 기준 ([0-5])\/5개 확인/);
        assert.ok(checked);
        assert.ok(dialog.find('ul li').length >= Number(checked[1]));
      }
      return $;
    }
    const budget = await details('reviewed-fullpc-gmarket-4864796475');
    assert.match(budget('[data-part-quality="ram"]').text(), /(?:0\/5점|충족 0 · 확인 [1-5]\/5).*절충 사양.*16GB 한 장/);
    assert.match(budget('[data-part-quality="ram"] dialog').text(), /IC·다이.*확인할 수 없/);
    assert.match(budget('[data-part-quality="cpu"]').text(), /0x12F/);
    const reviewed = await details('reviewed-fullpc-gmarket-3951478263');
    assert.match(reviewed('[data-part-quality="psu"]').text(), /충족 3 · 확인 3\/5/);
    assert.match(reviewed('[data-part-quality="board"]').text(), /16\+2\+2.*M2D_SB/);
    assert.match(reviewed('[data-part-quality="ram"]').text(), /제한적 평생 보증.*같은 키트 품번에도 다른 IC/);
    assert.match(reviewed('#fullpc-price-assessment').text(), /종합 순위 대기/);
    const basicSsd = await details('reviewed-fullpc-11st-9423305936');
    assert.match(basicSsd('[data-part-quality="storage"]').text(), /절충 사양.*DRAM 없음.*320TBW/);
  });

  await check('price snapshot status identifies its own release without URLs or private configuration', async () => {
    const response = await api('GET', '/api/prices/status');
    assert.equal(response.status, 200);
    assert.equal(response.data.service, 'BLUEDEAL');
    assert.equal(response.data.commit, fixtureCommit);
    assert.equal(response.data.schemaVersion, 1);
    assert.match(response.data.snapshotHash, /^[a-f0-9]{64}$/);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.deepEqual(Object.keys(response.data).sort(), ['categories', 'commit', 'generatedAt', 'itemCount', 'schedule', 'schemaVersion', 'service', 'snapshotHash', 'updatedAt', 'version']);
    const contract = JSON.parse(await readFile(path.join(root, 'src/content/priceSnapshot.schema.json'), 'utf8'));
    const meta = JSON.parse(await readFile(path.join(root, 'src/content/prices/meta.json'), 'utf8'));
    const categories = [];
    for (const [index, category] of contract.categories.entries()) {
      const expected = JSON.parse(await readFile(path.join(root, `src/content/prices/${category}.json`), 'utf8'));
      assert.deepEqual(response.data.categories[index], { category, itemCount: expected.items.length, updatedAt: expected.updatedAt });
      categories.push(expected);
    }
    const expected = getPublicPriceSnapshot(meta, categories, generatedLinks, contract);
    assert.equal(response.data.itemCount, expected.itemCount);
    assert.equal(response.data.snapshotHash, expected.snapshotHash);
    assert.doesNotMatch(JSON.stringify(response.data), /https?:|originalUrl|seller|token|password|secret/i);
  });

  await check('search discovery excludes administrator, inquiry and redirect endpoints', async () => {
    const robots = await (await fetch(`${app.base}/robots.txt`)).text();
    assert.match(robots, /Disallow: \/admin/);
    assert.match(robots, /Disallow: \/contact/);
    assert.match(robots, /Sitemap: https:\/\/bluedeal\.co\.kr\/sitemap.xml/);
    const sitemap = await (await fetch(`${app.base}/sitemap.xml`)).text();
    assert.ok(sitemap.includes('https://bluedeal.co.kr/prices/ram'));
    assert.ok(sitemap.includes('https://bluedeal.co.kr/products/reviewed-fullpc-gmarket-4355054602'));
    assert.ok(sitemap.includes('https://bluedeal.co.kr/community-policy'));
    assert.ok(sitemap.includes('https://bluedeal.co.kr/evaluate'));
    for (const excluded of ['/admin', '/contact', '/go/', '/api/']) assert.equal(sitemap.includes(excluded), false);
    for (const route of ['/admin', '/contact', '/prices/ram?capacity=48', '/evaluate?pc=2299000']) {
      const html = await (await fetch(app.base + route)).text();
      assert.match(html, /name="robots" content="noindex, nofollow"/);
    }
    const prices = await (await fetch(`${app.base}/prices/ram`)).text();
    assert.match(prices, /<title>RAM 상품·가격비교 \| BLUEDEAL<\/title>/);
    assert.match(prices, /rel="canonical" href="https:\/\/bluedeal\.co\.kr\/prices\/ram"/);
    assert.match(prices, /property="og:image" content="https:\/\/bluedeal\.co\.kr\/opengraph-image"/);
    const calculator = await (await fetch(`${app.base}/evaluate`)).text();
    assert.match(calculator, /rel="canonical" href="https:\/\/bluedeal\.co\.kr\/evaluate"/);
    assert.match(calculator, /name="robots" content="index, follow"/);
    assert.equal((await fetch(`${app.base}/community/not-a-board`)).status, 404);
  });

  await check('community policy is public and visible before posting, with a private report link', async () => {
    const response = await fetch(`${app.base}/community-policy`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<h1[^>]*>커뮤니티 운영정책<\/h1>/);
    assert.match(html, /href="\/contact\/write\?vis=private"[^>]*>비공개로 신고·이의 제기/);
    assert.match(html, /광고·홍보와 도배 금지/);
    const pages = ['/community/hotdeal/write', '/it/write', '/community/issue'];
    await Promise.all(pages.map(async pathname => {
      const page = await fetch(app.base + pathname);
      assert.equal(page.status, 200, pathname);
      assert.match(await page.text(), /광고성 게시글·개인 제휴 링크·도배를 금지합니다/, pathname);
    }));
  });

  await check('board sharing metadata matches each public page without leaking list canonicals into write or private pages', async () => {
    for (const route of ['/it', '/community', '/community/hardware', '/community/hotdeal']) {
      const response = await fetch(app.base + route);
      assert.equal(response.status, 200);
      assertPublicMetadata(await response.text(), route);
    }
    for (const route of ['/it/write', '/community/hardware/write', '/community/hotdeal/write', '/contact/write?vis=private', '/admin']) {
      const response = await fetch(app.base + route);
      assert.equal(response.status, 200);
      assertExcludedMetadata(await response.text());
    }
  });

  await check('shared link image is a valid 1200 by 630 PNG', async () => {
    const response = await fetch(`${app.base}/opengraph-image`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/png/);
    const png = Buffer.from(await response.arrayBuffer());
    assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
  });

  await check('anonymous users cannot create administrator picks', async () => {
    assert.equal((await api('POST', '/api/posts', { boardKey: 'it', type: 'pick', title: 'test', content: 'test' })).status, 403);
  });
  await check('IT, community and hotdeal create/list/detail work', async () => {
    for (const [boardKey, type] of [['it', 'news'], ['hardware', 'general'], ['hotdeal', 'general']]) {
      const response = await api('POST', '/api/posts', { boardKey, type, title: `LOCAL QA ${boardKey}`, content: 'Local fixture content https://www.coupang.com/vp/products/1', authorName: '로컬 검증', extra: { dealLink: 'https://www.coupang.com/vp/products/1' } });
      assert.equal(response.status, 201);
      const post = response.data.post;
      publicPosts.push(post);
      assert.equal('passwordHash' in post, false);
      assert.match(post.content, /\/go\/[A-Za-z0-9_-]+/);
      assert.ok((await api('GET', `/api/posts?boardKey=${boardKey}`)).data.posts.some(item => item.id === post.id));
      assert.equal((await api('GET', `/api/posts/${post.id}`)).data.post.title, post.title);
    }
  });
  await check('issue feed accepts a single line and keeps legacy details reachable', async () => {
    const board = await fetch(app.base + '/community/issue');
    const html = await board.text();
    assert.equal(board.status, 200);
    assertPublicMetadata(html, '/community/issue');
    assert.match(html, /id="issue-line"[^>]*type="text"/);
    assert.match(html, /aria-label="이슈 검색"/);
    const redirect = await fetch(app.base + '/community/issue/write', { redirect: 'manual' });
    assert.equal(redirect.status, 307);
    assert.equal(redirect.headers.get('location'), '/community/issue');

    const id = 'legacy-issue';
    const legacy = {
      id, boardKey: 'issue', type: 'general', title: '기존 이슈 제목', content: '기존 본문\n두 번째 줄',
      extra: { env: 'Windows 11', ref: 'https://example.com/' }, createdAt: '2026-11-01T10:00:00Z',
    };
    kv.values.set('bd:post:' + id, JSON.stringify(legacy));
    kv.sorted.set('bd:board:issue:posts', new Map([[id, Date.parse(legacy.createdAt)]]));

    const payload = { boardKey: 'issue', type: 'general', authorName: '로컬 검증' };
    for (const content of ['', '   ', '첫 줄\n다음 줄', '한'.repeat(281)]) {
      assert.equal((await api('POST', '/api/posts', { ...payload, content })).status, 400);
    }
    assert.equal((await api('POST', '/api/posts', { ...payload, content: '비공개 내용', isPrivate: true, password: 'test' })).status, 400);
    const line = '가'.repeat(198) + '🚀' + '나'.repeat(80);
    const response = await api('POST', '/api/posts', { ...payload, content: line });
    assert.equal(response.status, 201);
    const post = response.data.post;
    assert.equal(post.title, '가'.repeat(198) + '…');
    assert.equal(post.content, line);
    const list = (await api('GET', '/api/posts?boardKey=issue')).data.posts;
    assert.equal(list[0].id, post.id);
    assert.deepEqual(list.find(row => row.id === legacy.id), legacy);
    assert.equal((await api('GET', '/api/posts/' + post.id)).data.post.content, line);
    assert.equal((await fetch(app.base + '/community/issue/' + legacy.id)).status, 200);
    assert.equal((await fetch(app.base + '/community/issue/' + post.id)).status, 200);
  });

  await check('storage failure in a detail layout is a server error, never a false missing-post response', async () => {
    kv.controls.unavailable = true;
    try {
      for (const post of publicPosts) {
        const route = post.boardKey === 'it' ? `/it/${post.id}` : `/community/${post.boardKey}/${post.id}`;
        const response = await fetch(app.base + route, { signal: AbortSignal.timeout(10000) });
        assert.equal(response.status, 500);
        assert.doesNotMatch(await response.text(), /PRIVATE_BACKEND_DIAGNOSTIC_DO_NOT_EXPOSE/);
      }
    } finally { kv.controls.unavailable = false; }
  });
  await check('fractional and invalid list limits always produce bounded integer storage ranges', async () => {
    for (const [limit, expectedEnd] of [['1.5', 0], ['0.5', 0], ['0', 0], ['-5', 0], ['NaN', 49], ['Infinity', 49], ['1e100', 199]]) {
      const before = kv.requests.length;
      const response = await api('GET', `/api/posts?boardKey=hardware&limit=${limit}`);
      assert.equal(response.status, 200);
      assert.ok(response.data.posts.length > 0);
      const range = kv.requests.slice(before).flatMap(item => item.commands).find(command => command[0] === 'ZREVRANGE');
      assert.equal(range[2], 0);
      assert.equal(range[3], expectedEnd);
    }
  });
  await check('hotdeal archive loads more than 200 posts and resumes after new arrivals', async () => {
    const index = 'bd:board:hotdeal:posts';
    const saved = kv.sorted.get(index);
    const entries = new Map();
    const ids = Array.from({ length: 206 }, (_, i) => `local-archive-${i}`);
    try {
      for (const [i, id] of ids.entries()) {
        const time = 1650000000000 + i * 1000;
        const post = { id, boardKey: 'hotdeal', type: 'general', title: id, content: '보존 기록', createdAt: new Date(time).toISOString() };
        entries.set(id, time);
        kv.values.set('bd:post:' + id, JSON.stringify(post));
      }
      entries.delete(ids.at(-1));
      kv.sorted.set(index, entries);
      const route = '/api/posts?boardKey=hotdeal&paged=1';
      const first = await api('GET', route);
      assert.equal(first.status, 200);
      assert.equal(first.data.posts.length, 48);
      entries.set(ids.at(-1), 1650001000000);
      const collected = first.data.posts.map(post => post.id);
      let cursor = first.data.nextCursor;
      for (let page = 0; page < 5 && cursor; page++) {
        const result = await api('GET', route + '&after=' + cursor);
        assert.equal(result.status, 200);
        collected.push(...result.data.posts.map(post => post.id));
        cursor = result.data.nextCursor;
      }
      assert.equal(cursor, null);
      assert.deepEqual(collected, ids.slice(0, -1).reverse());
      entries.delete(first.data.nextCursor);
      assert.equal((await api('GET', route + '&after=' + first.data.nextCursor)).status, 409);
    } finally {
      for (const id of ids) kv.values.delete('bd:post:' + id);
      if (saved) kv.sorted.set(index, saved);
      else kv.sorted.delete(index);
    }
  });
  await check('dynamic page parameters resolve and invalid categories return 404', async () => {
    for (const route of ['/prices/ram', '/community/hardware', '/community/hardware/write', '/it/write?type=pick', '/contact/write?from=prices&cat=ram']) {
      const response = await fetch(app.base + route, { signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get('content-type'), /text\/html/);
      await response.text();
    }
    const missing = await fetch(`${app.base}/prices/no-such-category`);
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /페이지를 찾을 수 없습니다/);
    const unknownRoute = await fetch(`${app.base}/no-such-page`);
    assert.equal(unknownRoute.status, 404);
    assert.match(await unknownRoute.text(), /다른 페이지 찾기/);
    const sampleDeal = await fetch(`${app.base}/deals/d1`);
    assert.equal(sampleDeal.status, 404);
    assert.doesNotMatch(await sampleDeal.text(), /₩129,000|역대가 근처/);
  });
  await check('missing and cross-board post pages return HTTP 404 instead of a soft error page',async()=>{
    for(const route of ['/it/missing-verification-post','/contact/missing-verification-post','/community/hardware/missing-verification-post',`/community/hardware/${publicPosts[0].id}`,`/it/${publicPosts[1].id}`]){
      const response=await fetch(app.base+route);
      assert.equal(response.status,404,route);
      assert.match(await response.text(),/페이지를 찾을 수 없습니다/);
    }
    for(const post of publicPosts){
      const route=post.boardKey==='it'?`/it/${post.id}`:`/community/${post.boardKey}/${post.id}`;
      const response=await fetch(app.base+route);
      assert.equal(response.status,200,route);
      const html=await response.text();
      assert.ok(html.includes(`<title>${post.title} | BLUEDEAL</title>`));
      assert.ok(html.includes(`rel="canonical" href="https://bluedeal.co.kr${route}"`));
    }
  });
  await check('outbound routes redirect to allowed merchants without following the link', async () => {
    const response = await fetch(app.base + publicPosts[0].extra.dealLink, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const target = new URL(response.headers.get('location'));
    assert.equal(target.hostname, 'www.coupang.com');
    assert.equal(target.pathname, '/vp/products/1');
    await response.text();
    kv.values.set('bd:out:code:blocked-fixture', JSON.stringify({ merchant: 'coupang', originalUrl: 'https://example.invalid/product' }));
    const blocked = await fetch(`${app.base}/go/blocked-fixture`, { redirect: 'manual' });
    assert.equal(blocked.status, 400);
    assert.equal(blocked.headers.has('location'), false);
    await blocked.text();
  });
  await check('private inquiries require a password at creation', async () => {
    assert.equal((await api('POST', '/api/posts', { boardKey: 'inquiry', type: 'general', title: 'test', content: 'secret', isPrivate: true })).status, 400);
  });
  await check('private list hides content, extra and password hash', async () => {
    const response = await api('POST', '/api/posts', { boardKey: 'inquiry', type: 'general', title: 'LOCAL QA private inquiry', content: 'private fixture body', extra: { email: 'fixture@example.invalid' }, isPrivate: true, password: 'fixture-password' });
    assert.equal(response.status, 201);
    privateId = response.data.post.id;
    const list = await api('GET', '/api/posts?boardKey=inquiry');
    assert.match(list.headers.get('cache-control'), /private, no-store/);
    assert.match(list.headers.get('vary'), /Cookie/);
    const post = list.data.posts.find(item => item.id === privateId);
    assert.equal(post.content, '');
    assert.equal('extra' in post, false);
    assert.equal('passwordHash' in post, false);
  });
  await check('private inquiry HTML keeps the record reachable without serializing body, email or password hash',async()=>{
    const response=await fetch(`${app.base}/contact/${privateId}`);
    assert.equal(response.status,200);
    const html=await response.text();
    assertExcludedMetadata(html);
    assert.doesNotMatch(html,/private fixture body|fixture@example\.invalid|fixture-password|passwordHash/);
    const wrongBoard=await fetch(`${app.base}/community/hardware/${privateId}`);
    assert.equal(wrongBoard.status,404);
    await wrongBoard.text();
  });
  await check('private detail is locked; only the correct password unlocks', async () => {
    assert.equal((await api('GET', `/api/posts/${privateId}`)).status, 401);
    assert.equal((await api('POST', `/api/posts/${privateId}/unlock`, {password:'wrong'})).status, 403);
    const response = await api('POST', `/api/posts/${privateId}/unlock`, {password:'fixture-password'});
    assert.equal(response.status, 200);
    assert.equal(response.data.post.content, 'private fixture body');
    assert.equal('passwordHash' in response.data.post, false);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
    assert.match(response.headers.get('vary'), /Cookie/);
  });
  await check('query-string passwords never unlock private content', async () => {
    const response = await api('GET', `/api/posts/${privateId}?pw=fixture-password`);
    assert.equal(response.status, 401);
    assert.equal('post' in response.data, false);
  });
  await check('unlock validates origin, JSON and bounded request size before lookup', async () => {
    assert.equal((await api('POST', `/api/posts/${privateId}/unlock`, {})).status, 400);
    const sameOrigin = await fetch(`${app.base}/api/posts/${privateId}/unlock`, {method:'POST',headers:{'Content-Type':'application/json',Origin:app.base},body:JSON.stringify({password:'fixture-password'})});
    assert.equal(sameOrigin.status, 200);
    assert.equal((await sameOrigin.json()).post.content, 'private fixture body');
    const foreign = await fetch(`${app.base}/api/posts/${privateId}/unlock`, {method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.invalid'},body:JSON.stringify({password:'fixture-password'})});
    assert.equal(foreign.status, 403); await foreign.text();
    const oversized = await fetch(`${app.base}/api/posts/${privateId}/unlock`, {method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(9000)});
    assert.equal(oversized.status, 413); await oversized.text();
  });
  await check('private records with an empty hash fail closed', async () => {
    assert.equal((await api('POST', '/api/posts/legacy-private/unlock', {password:'anything'})).status, 403);
  });
  await check('anonymous users cannot update or delete posts', async () => {
    assert.equal((await api('PUT', `/api/posts/${privateId}`, { title: 'tampered' })).status, 403);
    assert.equal((await api('DELETE', `/api/posts/${privateId}`)).status, 403);
  });
  await check('administrator login sets a protected cookie', async () => {
    assert.equal((await api('POST', '/api/admin/login', { password: 'wrong' })).status, 401);
    const response = await api('POST', '/api/admin/login', { password });
    assert.equal(response.status, 200);
    const header = response.headers.get('set-cookie');
    assert.match(header, /HttpOnly/i); assert.match(header, /SameSite=lax/i); assert.match(header, /Secure/i);
    assert.equal(header.includes(password), false);
    cookie = header.split(';')[0];
    assert.equal((await api('GET', '/api/admin/status', undefined, cookie)).data.admin, true);
  });
  await check('administrator cookies have unique signed sessions with enforced server expiry and no legacy bypass', async () => {
    const now = Math.floor(Date.now() / 1000);
    const signed = (issuedAt, expiresAt, signingPassword = password) => {
      const payload = `v1.${issuedAt}.${expiresAt}.${'b'.repeat(32)}`;
      return payload + '.' + createHmac('sha256', signingPassword).update('bluedeal-admin-session:' + payload).digest('hex');
    };
    const valid = signed(now - 1, now + 60);
    assert.equal((await api('GET', '/api/admin/status', undefined, 'bd_admin=' + valid)).data.admin, true);
    const original = cookie.slice('bd_admin='.length);
    const tampered = original.slice(0, -1) + (original.endsWith('a') ? 'b' : 'a');
    for (const value of [signed(now - 60, now - 1), signed(now, now), signed(now + 300, now + 600),
      signed(now, now + 31 * 86400), signed(now - 1, now + 60, 'wrong-signing-password'),
      tampered, original.replace('v1.', 'v2.'), 'v1.malformed', createHash('sha256').update('bluedeal_admin::' + password).digest('hex')]) {
      assert.equal((await api('GET', '/api/admin/status', undefined, 'bd_admin=' + value)).data.admin, false);
      assert.equal((await api('GET', `/api/posts/${privateId}`, undefined, 'bd_admin=' + value)).status, 401);
    }
    const secondLogin = await api('POST', '/api/admin/login', { password });
    assert.equal(secondLogin.status, 200);
    assert.notEqual(secondLogin.headers.get('set-cookie').split(';')[0], cookie);
    assert.match(secondLogin.headers.get('set-cookie'), /Max-Age=2592000/i);
    assert.equal((await api('GET', '/api/admin/status', undefined, cookie)).data.admin, true);
  });
  await check('administrator can read a private inquiry without its password', async () => {
    const response = await api('GET', `/api/posts/${privateId}`, undefined, cookie);
    assert.equal(response.status, 200);
    assert.equal(response.data.post.extra.email, 'fixture@example.invalid');
    assert.equal('passwordHash' in response.data.post, false);
  });
  await check('authenticated mutations still reject foreign origins and credential requests have byte limits', async () => {
    const headers = { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'https://example.invalid' };
    for (const [method, route, body] of [['PUT', `/api/posts/${privateId}`, '{}'], ['DELETE', `/api/posts/${privateId}`], ['POST', '/api/admin/logout'], ['POST', '/api/admin/login', JSON.stringify({ password })]]) {
      const response = await fetch(app.base + route, { method, headers, ...(body ? { body } : {}) });
      assert.equal(response.status, 403);
      assert.equal(response.headers.has('set-cookie'), false); await response.text();
    }
    const response = await fetch(app.base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'x'.repeat(9000) }) });
    assert.equal(response.status, 413); await response.text();
  });
  await check('invalid administrator edits preserve the complete stored record and its private lock', async () => {
    const before = kv.values.get('bd:post:' + privateId);
    for (const patch of [{ title: '' }, { content: '   ' }, { title: {} }, { extra: [] }, { type: 'not-a-type' }, { isPrivate: 'false' }, { password: '', content: 'https://item.gmarket.co.kr/Item?goodsCode=8888888888' }]) {
      assert.equal((await api('PUT', `/api/posts/${privateId}`, patch, cookie)).status, 400);
      assert.equal(kv.values.get('bd:post:' + privateId), before);
    }
  });
  await check('large administrator updates use body transport and keep content intact', async () => {
    const response = await api('PUT', `/api/posts/${largePostId}`, { content: '한'.repeat(30_000) }, cookie);
    assert.equal(response.status, 200);
    const stored = (await api('GET', `/api/posts/${largePostId}`)).data.post.content;
    assert.equal(stored.length, 30_000);
    const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');
    assert.equal(hash(stored), hash('한'.repeat(30_000)), 'Large Korean content must round-trip without UTF-8 corruption');
    assert.ok(kv.requests.every(item => item.method === 'POST' && item.url.length < 20));
  });
  await check('blog slug routes preserve draft visibility and administrator update/delete', async () => {
    const route = '/api/blog/local-upgrade-fixture';
    const draft = { slug: 'local-upgrade-fixture', title: 'LOCAL QA blog draft', summary: 'Synthetic test only', category: 'test', body: 'Synthetic draft body', published: false };
    assert.equal((await api('PUT', route, draft)).status, 403);
    assert.equal((await api('PUT', route, draft, cookie)).status, 200);
    assert.equal((await api('GET', route)).status, 404);
    const visible = await api('GET', route, undefined, cookie);
    assert.equal(visible.status, 200);
    assert.equal(visible.data.post.slug, draft.slug);
    assert.equal(visible.data.post.body, draft.body);
    assert.match(visible.headers.get('cache-control'), /private, no-store/);
    assert.match(visible.headers.get('vary'), /Cookie/i);
    assert.equal((await api('PUT', route, { ...draft, published: 'false' }, cookie)).status, 400);
    assert.equal((await api('GET', route)).status, 404);
    const foreign = await fetch(app.base + route, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'https://example.invalid' }, body: JSON.stringify({ ...draft, published: true }) });
    assert.equal(foreign.status, 403); await foreign.text();
    assert.equal((await api('GET', route)).status, 404);
    assert.equal((await api('DELETE', route)).status, 403);
    assert.equal((await api('DELETE', route, undefined, cookie)).status, 200);
    assert.equal((await api('GET', route, undefined, cookie)).status, 404);
  });
  await check('administrator can update posts', async () => {
    for (const post of publicPosts) {
      const response = await api('PUT', `/api/posts/${post.id}`, { title: `${post.title} updated` }, cookie);
      assert.equal(response.status, 200);
      assert.equal(response.data.post.title, `${post.title} updated`);
    }
  });
  await check('public to private requires a password and preserves data on rejection', async () => {
    const id = publicPosts[0].id;
    assert.equal((await api('PUT', `/api/posts/${id}`, { isPrivate: true }, cookie)).status, 400);
    assert.equal((await api('GET', `/api/posts/${id}`)).status, 200);
  });
  await check('empty password changes cannot remove private protection', async () => {
    assert.equal((await api('PUT', `/api/posts/${privateId}`, { password: '' }, cookie)).status, 400);
    assert.equal((await api('POST', `/api/posts/${privateId}/unlock`, {password:'wrong'})).status, 403);
    assert.equal((await api('POST', `/api/posts/${privateId}/unlock`, {password:'fixture-password'})).status, 200);
  });
  await check('administrator delete removes detail and list entry', async () => {
    const response = await api('POST', '/api/posts', { boardKey: 'hardware', type: 'general', title: 'delete fixture', content: 'delete fixture' });
    const id = response.data.post.id;
    assert.equal((await api('DELETE', `/api/posts/${id}`, undefined, cookie)).status, 200);
    assert.equal((await api('GET', `/api/posts/${id}`)).status, 404);
    assert.equal((await api('GET', '/api/posts?boardKey=hardware')).data.posts.some(post => post.id === id), false);
  });
  await check('logout clears the cookie and anonymous access is locked again', async () => {
    const response = await api('POST', '/api/admin/logout', undefined, cookie);
    assert.match(response.headers.get('set-cookie'), /Max-Age=0/i);
    assert.equal((await api('GET', '/api/admin/status')).data.admin, false);
    assert.equal((await api('GET', `/api/posts/${privateId}`)).status, 401);
  });
  await check('administrator attempt limits survive server restarts, expire, resist forwarded-header changes and fail closed', async () => {
    const fixture = await authenticationFixture();
    try {
      assert.equal((await fixture.call('/api/admin/login', { password: 'wrong' }, { origin: 'https://example.invalid' })).status, 403);
      assert.equal(fixture.kv.requests.length, 0);
      for (let n = 0; n < 10; n++) assert.equal((await fixture.call('/api/admin/login', { password: 'wrong' })).status, 401);
      const expiration = [...fixture.kv.expires.values()][0];
      const blocked = await fixture.call('/api/admin/login', { password: fixture.password });
      assert.equal(blocked.status, 429);
      assert.equal(blocked.data.errorCode, 'AUTH_RATE_LIMIT');
      assert.equal(blocked.headers.has('set-cookie'), false);
      assert.ok(Number(blocked.headers.get('retry-after')) > 0 && Number(blocked.headers.get('retry-after')) <= 300);
      assert.match(blocked.headers.get('cache-control'), /private, no-store/);
      assert.equal((await fixture.call('/api/admin/login', { password: fixture.password }, { forwardedFor: '203.0.113.251' })).status, 429);
      assert.equal([...fixture.kv.expires.values()][0], expiration, 'Rejected attempts must not prolong the fixed window');
      assert.equal((await fixture.call('/api/admin/login', { password: fixture.password }, { ip: '198.51.100.11' })).status, 200);
      await fixture.restart();
      assert.equal((await fixture.call('/api/admin/login', { password: fixture.password })).status, 429);
      fixture.kv.controls.nowMs += 301_000;
      assert.equal((await fixture.call('/api/admin/login', { password: fixture.password })).status, 200);
      const concurrent = await Promise.all(Array.from({ length: 12 }, () => fixture.call('/api/admin/login', { password: 'wrong' }, { ip: '198.51.100.12' })));
      assert.equal(concurrent.filter(r => r.status === 401).length, 10);
      assert.equal(concurrent.filter(r => r.status === 429).length, 2);
      for (const fault of ['unavailable', 'malformed', 'invalidAuthCounter']) {
        fixture.kv.controls[fault] = true;
        const response = await fixture.call('/api/admin/login', { password: fixture.password }, { ip: '198.51.100.13' });
        assert.equal(response.status, 503);
        assert.equal(response.data.errorCode, 'AUTH_PROTECTION_UNAVAILABLE');
        assert.equal(response.headers.has('set-cookie'), false);
        assert.equal(JSON.stringify(response.data).includes('PRIVATE_BACKEND_DIAGNOSTIC'), false);
        fixture.kv.controls[fault] = false;
      }
      const stored = JSON.stringify(fixture.kv.requests);
      assert.equal(stored.includes('198.51.100.'), false);
      assert.equal(stored.includes(fixture.password), false);
      assert.ok(fixture.kv.requests.every(row => row.url === '/multi-exec' && row.commands.length === 3));
    } finally { await fixture.stop(); }
  });
  await check('private password attempts are limited before password verification while administrator reads and expiry still work', async () => {
    const fixture = await authenticationFixture();
    try {
      const secret = 'LOCAL_ONLY_RATE_FIXTURE_BODY';
      const unlockPassword = 'LOCAL_ONLY_UNLOCK_PASSWORD';
      const created = await fixture.call('/api/posts', { boardKey: 'inquiry', type: 'general', title: 'LOCAL rate-limit fixture', content: secret, isPrivate: true, password: unlockPassword });
      assert.equal(created.status, 201);
      const route = `/api/posts/${created.data.post.id}/unlock`;
      assert.equal((await fixture.call(`/api/posts/${created.data.post.id}`, undefined, { method: 'GET' })).status, 401);
      assert.equal([...fixture.kv.values.keys()].filter(key => key.startsWith('bd:auth-attempt:')).length, 0);
      for (let n = 0; n < 20; n++) assert.equal((await fixture.call(route, { password: 'wrong' }, { ip: '198.51.100.20' })).status, 403);
      const blocked = await fixture.call(route, { password: unlockPassword }, { ip: '198.51.100.20' });
      assert.equal(blocked.status, 429);
      assert.equal(blocked.data.errorCode, 'AUTH_RATE_LIMIT');
      assert.equal(JSON.stringify(blocked.data).includes(secret), false);
      assert.equal((await fixture.call(route, { password: unlockPassword }, { ip: '198.51.100.21' })).status, 200);
      const login = await fixture.call('/api/admin/login', { password: fixture.password }, { ip: '198.51.100.22' });
      assert.equal(login.status, 200);
      const administrator = await fixture.call(route, { password: 'wrong' }, { ip: '198.51.100.20', cookie: login.headers.get('set-cookie').split(';')[0] });
      assert.equal(administrator.status, 200);
      assert.equal(administrator.data.post.content, secret);
      assert.equal('passwordHash' in administrator.data.post, false);
      fixture.kv.controls.nowMs += 301_000;
      assert.equal((await fixture.call(route, { password: unlockPassword }, { ip: '198.51.100.20' })).status, 200);
      const stored = JSON.stringify(fixture.kv.requests);
      assert.equal(stored.includes('198.51.100.'), false);
      assert.equal(stored.includes(unlockPassword), false);
    } finally { await fixture.stop(); }
  });
  await check('configured administrator login cannot bypass missing shared attempt storage', async () => {
    const missing = await startApp({ ADMIN_PASSWORD: 'LOCAL_ONLY_WITHOUT_KV' });
    try {
      const response = await request(missing.base, 'POST', '/api/admin/login', { password: 'LOCAL_ONLY_WITHOUT_KV' });
      assert.equal(response.status, 503);
      assert.equal(response.data.errorCode, 'AUTH_PROTECTION_UNAVAILABLE');
      assert.equal(response.headers.has('set-cookie'), false);
    } finally { await stopChild(missing.child); }
  });
  await check('local and separately hosted authentication never trusts caller-supplied forwarding headers', async () => {
    const fixture = await authenticationFixture(false);
    try {
      for (let n = 1; n <= 10; n++) assert.equal((await fixture.call('/api/admin/login', { password: 'wrong' }, { ip: `198.51.100.${n}`, forwardedFor: `203.0.113.${n}` })).status, 401);
      const response = await fixture.call('/api/admin/login', { password: fixture.password }, { ip: '198.51.100.200', forwardedFor: '203.0.113.200' });
      assert.equal(response.status, 429);
    } finally { await fixture.stop(); }
  });
  await check('Google membership signup, account withdrawal and suspension across sessions', async () => {
    const kv = await mockKv();
    const password = randomBytes(24).toString('hex');
    const memberKey = randomBytes(32).toString('hex');
    const member = createHmac('sha256', Buffer.from(memberKey, 'hex')).update('google:fixture-subject').digest('hex');
    const app = await startApp({
      ADMIN_PASSWORD: password, KV_REST_API_URL: kv.url, KV_REST_API_TOKEN: kv.token,
      BLUEDEAL_GOOGLE_WRITE_LOGIN: '1', BLUEDEAL_GOOGLE_CLIENT_ID: 'fixture-client', BLUEDEAL_GOOGLE_CLIENT_SECRET: 'fixture-only',
      BLUEDEAL_MEMBER_KEY: memberKey,
    });
    const path = '/api/member';
    const write = '/api/posts';
    const create = { boardKey: 'hardware', type: 'general', title: 'Writer test', content: 'Local test only', authorName: '변조 이름' };
    const issue = { boardKey: 'issue', type: 'general', content: '이슈 작성 테스트' };
    const session = (issuedAt = Date.now(), account = member) => {
      const token = randomBytes(32).toString('hex');
      kv.values.set('bd:member:session:' + createHash('sha256').update(token).digest('hex'), JSON.stringify({ id: account, issuedAt }));
      return '__Host-bd-writer=' + token;
    };
    try {
      const home = await (await fetch(app.base + '/')).text();
      assert.match(home, /회원가입/);
      assert.ok(home.includes('href="/signup"'));
      assert.ok(home.includes('href="/login"'));
      for (const [page, title] of [['login', '로그인'], ['signup', '회원가입'], ['account', '내 계정']]) {
        const html = await (await fetch(app.base + '/' + page)).text();
        assert.match(html, new RegExp('>' + title + '</h1>'));
        assert.match(html, /noindex/);
      }
      assert.equal((await request(app.base, 'GET', path)).data.state, 'login');
      assert.equal((await request(app.base, 'GET', write + '?boardKey=hardware')).status, 200);
      assert.equal((await request(app.base, 'POST', write, create)).status, 401);
      assert.equal((await request(app.base, 'POST', write, issue)).status, 401);
      assert.equal((await request(app.base, 'POST', write, { ...create, boardKey: 'it', type: 'news' })).status, 401);
      assert.equal((await request(app.base, 'POST', write, { ...create, boardKey: 'inquiry' })).status, 401);
      const inquiry = { ...create, boardKey: 'inquiry', isPrivate: true, password: 'private-test' };
      assert.equal((await request(app.base, 'POST', write, inquiry)).status, 201);

      const cookie = session();
      const legacyId = '0'.repeat(64);
      const legacyOther = 'f'.repeat(64);
      const legacyName = 'Early.Member';
      for (const id of [legacyId, legacyOther]) {
        const alias = randomBytes(32).toString('hex');
        kv.values.set('bd:member:profile:' + id, JSON.stringify({ alias, nickname: legacyName }));
        kv.values.set('bd:member:author:' + alias, id);
      }
      assert.equal((await request(app.base, 'GET', path, undefined, cookie)).data.state, 'nickname');
      assert.equal((await request(app.base, 'POST', write, create, cookie)).status, 401);
      assert.equal((await request(app.base, 'POST', path, { nickname: '블루딜 AI' }, cookie)).status, 400);
      assert.equal((await request(app.base, 'POST', path, { nickname: 'Ｅａｒｌｙ-member' }, cookie)).data.errorCode, 'NICKNAME_TAKEN');
      assert.equal((await request(app.base, 'GET', path, undefined, session(Date.now(), legacyId))).data.nickname, legacyName);
      const conflictSession = session(Date.now(), legacyOther);
      assert.equal((await request(app.base, 'GET', path, undefined, conflictSession)).data.conflict, true);
      assert.equal((await request(app.base, 'POST', path, { nickname: '다시 고른 이름' }, conflictSession)).data.nickname, '다시 고른 이름');
      const competing = await Promise.all(['Signal Relay', 'signal.relay'].map((nickname,index) =>
        request(app.base, 'POST', path, { nickname }, session(Date.now(), String(index+1).repeat(64)))));
      assert.deepEqual(competing.map(row=>row.status).sort(), [200,409]);
      assert.equal(competing.find(row=>row.status===409).data.errorCode, 'NICKNAME_TAKEN');
      assert.equal((await request(app.base, 'POST', path, { nickname: '검증 닉네임' }, cookie)).data.nickname, '검증 닉네임');
      assert.equal((await request(app.base, 'POST', path, { nickname: '다른 이름' }, cookie)).data.nickname, '검증 닉네임');

      const posted = await request(app.base, 'POST', write, create, cookie);
      assert.equal(posted.status, 201);
      assert.equal(posted.data.post.authorName, '검증 닉네임');
      assert.doesNotMatch(JSON.stringify(posted.data), /writerId|fixture-subject/);
      assert.ok(!JSON.stringify(posted.data).includes(member));
      const id = posted.data.post.id;
      const postPath = write + '/' + id;
      const moderation = '/api/admin/member-suspension/' + id;
      const alias = kv.values.get('bd:member:post:' + id);
      assert.notEqual(alias, member);
      assert.equal(kv.values.get('bd:member:author:' + alias), member);
      assert.equal((await request(app.base, 'PUT', moderation, { days: 7 }, cookie)).status, 403);
      const login = await request(app.base, 'POST', '/api/admin/login', { password });
      assert.equal(login.status, 200);
      const admin = login.headers.get('set-cookie').split(';')[0];
      assert.equal((await request(app.base, 'PUT', moderation, { days: 0 }, admin)).status, 400);
      assert.equal((await request(app.base, 'PUT', moderation, { days: 1 }, admin)).status, 200);
      assert.equal((await request(app.base, 'GET', postPath)).status, 200);
      assert.equal((await request(app.base, 'POST', write, create, cookie)).data.errorCode, 'WRITER_SUSPENDED');
      assert.equal((await request(app.base, 'DELETE', path, undefined, cookie)).status, 200);
      assert.equal((await request(app.base, 'GET', path, undefined, cookie)).data.state, 'login');

      const newSession = session();
      assert.equal((await request(app.base, 'GET', path, undefined, newSession)).data.state, 'suspended');
      assert.equal((await request(app.base, 'POST', path, { nickname: '다른 이름' }, newSession)).status, 403);
      assert.equal((await request(app.base, 'POST', write, issue, newSession)).status, 403);
      assert.equal((await request(app.base, 'POST', write, inquiry, newSession)).status, 201);
      assert.equal((await request(app.base, 'POST', write, create, admin)).status, 201);

      assert.equal((await request(app.base, 'DELETE', moderation, undefined, admin)).data.until, null);
      assert.equal((await request(app.base, 'GET', path, undefined, newSession)).data.state, 'ready');
      assert.equal((await request(app.base, 'PUT', moderation, { days: 1 }, admin)).status, 200);
      const otherDevice = session();
      assert.equal((await request(app.base, 'POST', path, { action: 'withdraw' }, newSession)).status, 200);
      assert.equal((await request(app.base, 'GET', path, undefined, otherDevice)).data.state, 'login');
      assert.equal(kv.values.has('bd:member:profile:' + member), false);
      assert.equal(kv.values.has('bd:member:author:' + alias), false);
      assert.equal((await request(app.base, 'GET', postPath)).data.post.authorName, '검증 닉네임');

      const rejoinedSession = session(Date.now() + 5_000);
      const restricted = await request(app.base, 'GET', path, undefined, rejoinedSession);
      assert.equal(restricted.data.state, 'suspended');
      assert.equal(restricted.data.registered, false);
      assert.equal((await request(app.base, 'POST', path, { nickname: '재가입 닉네임' }, rejoinedSession)).status, 403);
      kv.controls.nowMs += 86_400_001;
      assert.equal((await request(app.base, 'GET', path, undefined, rejoinedSession)).data.state, 'nickname');
      assert.equal((await request(app.base, 'POST', path, { nickname: '재가입 닉네임' }, rejoinedSession)).status, 200);
      assert.equal((await request(app.base, 'POST', write, issue, rejoinedSession)).status, 201);
      assert.equal((await request(app.base, 'DELETE', postPath, undefined, admin)).status, 200);
      assert.equal(kv.values.has('bd:member:post:' + id), false);
    } finally { await stopChild(app.child); }
  });
  const failures = results.filter(result => !result.passed).length;
  console.log(`\n${results.length - failures}/${results.length} checks passed.`);
  process.exitCode = failures ? 1 : 0;
  if (preview && !failures) {
    const proxy = await previewProxy(app.base);
    console.log(`LOCAL_PREVIEW=${proxy.base}`);
    if(affiliatePreviewBase)console.log(`LOCAL_AFFILIATE_PREVIEW=${affiliatePreviewBase}/community/hardware/local-affiliate-disclosure`);
    console.log('Disposable fixtures only. Commands: offline / partial / online / logout-fail / logout-ok / slow-hardware / normal-speed / malformed-api / normal-api / slow-navigation / normal-navigation / stop (+ Enter). Ctrl+C also stops.');
    await new Promise(resolve => {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', input => {
        const command = input.trim();
        if (command === 'stop') return resolve();
        if (['offline', 'partial', 'online'].includes(command)) {
          kv.controls.unavailable = command === 'offline';
          kv.controls.partial = command === 'partial';
          console.log(`LOCAL_KV_MODE=${command}`);
        }
        if (['logout-fail', 'logout-ok'].includes(command)) { proxy.faults.logout = command === 'logout-fail'; console.log(`LOCAL_LOGOUT_FAILURE=${proxy.faults.logout}`); }
        if (['slow-hardware', 'normal-speed'].includes(command)) { kv.controls.slowHardware = command === 'slow-hardware'; console.log(`LOCAL_SLOW_HARDWARE=${kv.controls.slowHardware}`); }
        if (['malformed-api', 'normal-api'].includes(command)) { proxy.faults.malformedApi = command === 'malformed-api'; console.log(`LOCAL_MALFORMED_API=${proxy.faults.malformedApi}`); }
        if (['slow-navigation', 'normal-navigation'].includes(command)) { proxy.faults.slowNavigation = command === 'slow-navigation'; console.log(`LOCAL_SLOW_NAVIGATION=${proxy.faults.slowNavigation}`); }
      });
      process.stdin.resume();
    });
    process.stdin.pause();
  }
} finally {
  cleanup();
}
