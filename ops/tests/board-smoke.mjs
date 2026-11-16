// Exercises the real Next.js HTTP routes against disposable, local-only KV data.
// Run after `npm run build`. No production credentials or services are used.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

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
  const controls = { unavailable: false };
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
      case 'ZREVRANGE': return [...(sorted.get(key) ?? new Map())].sort((a, b) => b[1] - a[1]).slice(Number(value), Number(args[2]) + 1).map(([id]) => id);
      default: throw new Error(`Unexpected test KV command: ${name}`);
    }
  }
  const server = http.createServer(async (req, res) => {
    try {
      if (controls.unavailable) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'TEST ONLY unavailable KV' }));
        return;
      }
      assert.equal(req.headers.authorization, `Bearer ${token}`);
      let result;
      if (req.url === '/multi-exec' || req.url === '/pipeline') {
        let body = '';
        for await (const chunk of req) body += chunk;
        result = JSON.parse(body).map(item => ({ result: command(item) }));
      } else {
        result = { result: command(req.url.slice(1).split('/').map(decodeURIComponent)) };
      }
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
  return { url: `http://127.0.0.1:${port}`, token, values, controls };
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
  const api = (method, route, body, cookie) => request(app.base, method, route, body, cookie);
  let cookie;
  let privateId;
  const publicPosts = [];

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

  await check('deployment version exposes only public release metadata without caching', async () => {
    const response = await api('GET', '/api/version');
    assert.equal(response.status, 200);
    assert.equal(response.data.service, 'BLUEDEAL');
    assert.match(response.data.version, /^\d+\.\d+\.\d+$/);
    assert.equal(response.data.commit, fixtureCommit);
    assert.deepEqual(Object.keys(response.data).sort(), ['commit', 'service', 'version']);
    assert.match(response.headers.get('cache-control'), /no-store/);
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
  await check('dynamic page parameters resolve and invalid categories return 404', async () => {
    for (const route of ['/prices/ram', '/deals/d1', '/community/hardware', '/community/hardware/write', '/it/write?type=pick', '/contact/write?from=prices&cat=ram']) {
      const response = await fetch(app.base + route, { signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get('content-type'), /text\/html/);
      await response.text();
    }
    const missing = await fetch(`${app.base}/prices/no-such-category`);
    assert.equal(missing.status, 404);
    await missing.text();
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
    const post = (await api('GET', '/api/posts?boardKey=inquiry')).data.posts.find(item => item.id === privateId);
    assert.equal(post.content, '');
    assert.equal('extra' in post, false);
    assert.equal('passwordHash' in post, false);
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
    console.log(`LOCAL_PREVIEW=${app.base}`);
    console.log('Only disposable fixture data is shown. Type stop + Enter or Ctrl+C to stop both local servers.');
    await new Promise(resolve => {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', input => { if (input.trim() === 'stop') resolve(); });
      process.stdin.resume();
    });
    process.stdin.pause();
  }
} finally {
  cleanup();
}
