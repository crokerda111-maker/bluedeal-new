// Exercises the real Next.js HTTP routes against disposable, local-only KV data.
// Run after `npm run build`. No production credentials or services are used.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { assertBrowserHeaders } from './browser-headers.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const generatedLinks = JSON.parse(await readFile(new URL('../../src/content/outbound.generated.json', import.meta.url), 'utf8'));
const preview = process.argv.includes('--preview');
const servers = new Set();
const children = new Set();
const results = [];

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
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
  const controls = { unavailable: false, partial: false, malformed: false, truncated: false, slowHardware: false };
  const requests = [];
  const values = new Map();
  const sorted = new Map();
  const token = randomBytes(24).toString('hex');
  function command([name, ...args]) {
    const [key, value] = args;
    switch (String(name).toUpperCase()) {
      case 'GET': return values.get(key) ?? null;
      case 'SET': values.set(key, value); return 'OK';
      case 'SETNX': if (values.has(key)) return 0; values.set(key, value); return 1;
      case 'DEL': return Number(values.delete(key));
      case 'EXISTS': return Number(values.has(key));
      case 'INCR': { const n = Number(values.get(key) ?? 0) + 1; values.set(key, n); return n; }
      case 'ZADD': {
        const entries = sorted.get(key) ?? new Map();
        const exists = entries.has(args[2]);
        entries.set(args[2], Number(value)); sorted.set(key, entries); return Number(!exists);
      }
      case 'ZREM': return Number(sorted.get(key)?.delete(value) ?? false);
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
      if (controls.unavailable || (controls.partial && JSON.stringify(commands).includes('bd:board:review:posts'))) {
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
  return { url: `http://127.0.0.1:${port}`, token, values, controls, requests };
}

async function previewProxy(upstream) {
  const faults = { logout: false, malformedApi: false };
  const target = new URL(upstream);
  const server = http.createServer((req, res) => {
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
    assert.ok(ordinary.includes('이 페이지의 판매처 링크는 일반 링크입니다.'));
    assert.equal(ordinary.includes(disclosure), false);
    assert.equal(ordinary.includes('rel="sponsored noopener noreferrer"'), false);
    const price = JSON.parse(await readFile(path.join(root, 'src/content/prices/ram.json'), 'utf8')).items[0];
    const outbound = generatedLinks[price.goCode];
    assert.equal(outbound.merchant, 'gmarket');
    const affiliateUrl = 'https://app.ac/testAffiliate000';
    const testApp = await startApp({ AFFILIATE_LINKS_JSON: JSON.stringify([{ merchant: 'gmarket', provider: 'linkprice', originalUrl: outbound.originalUrl, affiliateUrl }]) });
    try {
      const html = await (await fetch(testApp.base + '/prices/ram')).text();
      assert.ok(html.indexOf(disclosure) >= 0 && html.indexOf(disclosure) < html.indexOf('판매처 보기 ↗'));
      assert.ok(html.includes('rel="sponsored noopener noreferrer"'));
      assert.ok(html.includes('제휴 링크') && html.includes('일반 링크'));
      assert.equal(html.includes('testAffiliate000'), false);
      const redirect = await fetch(testApp.base + '/go/' + price.goCode, { redirect: 'manual' });
      assert.equal(redirect.status, 302);
      assert.equal(redirect.headers.get('location'), affiliateUrl);
      const cpu = await (await fetch(testApp.base + '/prices/cpu')).text();
      assert.ok(cpu.includes('이 페이지의 판매처 링크는 일반 링크입니다.'));
      assert.equal(cpu.includes(disclosure), false);
    } finally { await stopChild(testApp.child); }
  });
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

  await check('home distinguishes a storage outage from an empty hotdeal board', async () => {
    kv.controls.unavailable = true;
    try {
      const response = await fetch(app.base);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /핫딜을 불러오지 못했습니다/);
      assert.doesNotMatch(html, /아직 등록된 핫딜이 없습니다/);
      assert.match(html, /최근 가격 확인/);
    } finally { kv.controls.unavailable = false; }
    const response = await fetch(app.base);
    assert.match(await response.text(), /아직 등록된 핫딜이 없습니다/);
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
    let count = 0;
    for (const [index, category] of contract.categories.entries()) {
      const expected = JSON.parse(await readFile(path.join(root, `src/content/prices/${category}.json`), 'utf8'));
      assert.deepEqual(response.data.categories[index], { category, itemCount: expected.items.length, updatedAt: expected.updatedAt });
      count += expected.items.length;
    }
    assert.equal(response.data.itemCount, count);
    assert.doesNotMatch(JSON.stringify(response.data), /https?:|originalUrl|seller|token|password|secret/i);
  });

  await check('search discovery excludes administrator, inquiry and redirect endpoints', async () => {
    const robots = await (await fetch(`${app.base}/robots.txt`)).text();
    assert.match(robots, /Disallow: \/admin/);
    assert.match(robots, /Disallow: \/contact/);
    assert.match(robots, /Sitemap: https:\/\/bluedeal\.co\.kr\/sitemap.xml/);
    const sitemap = await (await fetch(`${app.base}/sitemap.xml`)).text();
    assert.ok(sitemap.includes('https://bluedeal.co.kr/prices/ram'));
    for (const excluded of ['/admin', '/contact', '/go/', '/api/']) assert.equal(sitemap.includes(excluded), false);
    for (const route of ['/admin', '/contact', '/prices/ram?capacity=48']) {
      const html = await (await fetch(app.base + route)).text();
      assert.match(html, /name="robots" content="noindex, nofollow"/);
    }
    const prices = await (await fetch(`${app.base}/prices/ram`)).text();
    assert.match(prices, /<title>RAM 가격현황 \| BLUEDEAL<\/title>/);
    assert.match(prices, /rel="canonical" href="https:\/\/bluedeal\.co\.kr\/prices\/ram"/);
    assert.match(prices, /property="og:image" content="https:\/\/bluedeal\.co\.kr\/opengraph-image"/);
    assert.equal((await fetch(`${app.base}/community/not-a-board`)).status, 404);
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
    assert.match(html,/name="robots" content="noindex, nofollow"/);
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
  const failures = results.filter(result => !result.passed).length;
  console.log(`\n${results.length - failures}/${results.length} checks passed.`);
  process.exitCode = failures ? 1 : 0;
  if (preview && !failures) {
    const proxy = await previewProxy(app.base);
    console.log(`LOCAL_PREVIEW=${proxy.base}`);
    console.log('Disposable fixtures only. Commands: offline / partial / online / logout-fail / logout-ok / slow-hardware / normal-speed / malformed-api / normal-api / stop (+ Enter). Ctrl+C also stops.');
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
      });
      process.stdin.resume();
    });
    process.stdin.pause();
  }
} finally {
  cleanup();
}
