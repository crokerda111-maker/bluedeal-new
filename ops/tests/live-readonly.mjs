// Public deployment checks only: no credentials, writes, or outbound clicks.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { assertBrowserHeaders } from './browser-headers.mjs';

const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${name} value`);
  return args[index + 1];
}
const base = new URL(option('--base') ?? 'https://bluedeal.co.kr');
assert.equal(base.protocol, 'https:');
assert.equal(base.pathname, '/');
assert.equal(base.username + base.password + base.search + base.hash, '');
const expectedCommit = option('--commit');
if (expectedCommit) assert.match(expectedCommit, /^[a-f0-9]{40}$/);
const results = [];
async function read(route) {
  const response = await fetch(new URL(route, base), {
    method: 'GET', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  return { response, text: await response.text() };
}
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) {
    // Never print remote response bodies, titles, contact details or credentials.
    results.push({ name, passed: false });
    console.error(`FAIL ${name}: ${error.code ?? error.name ?? 'Check failed'}`);
  }
}

await check('browser security headers on pages, administrator, API, static content and errors', async () => {
  for (const route of ['/', '/admin', '/api/admin/status', '/icon.svg', '/no-such-verification-page']) {
    const { response } = await read(route);
    assertBrowserHeaders(response);
  }
});
await check('release commit and version', async () => {
  const { response, text } = await read('/api/version');
  assert.equal(response.status, 200);
  const data = JSON.parse(text);
  assert.equal(data.service, 'BLUEDEAL');
  assert.match(data.version, /^\d+\.\d+\.\d+$/);
  if (expectedCommit) assert.equal(data.commit, expectedCommit);
  assert.deepEqual(Object.keys(data).sort(), ['commit', 'service', 'version']);
  assert.match(response.headers.get('cache-control'), /no-store/);
});
await check('price snapshot release, privacy and cache policy', async () => {
  const { response, text } = await read('/api/prices/status');
  assert.equal(response.status, 200);
  const data = JSON.parse(text);
  assert.equal(data.service, 'BLUEDEAL');
  assert.equal(data.schemaVersion, 1);
  assert.match(data.snapshotHash, /^[a-f0-9]{64}$/);
  if (expectedCommit) assert.equal(data.commit, expectedCommit);
  assert.deepEqual(Object.keys(data).sort(), ['categories', 'commit', 'generatedAt', 'itemCount', 'schedule', 'schemaVersion', 'service', 'snapshotHash', 'updatedAt', 'version']);
  assert.equal(data.categories.length, 8);
  assert.equal(data.itemCount, data.categories.reduce((total, item) => total + item.itemCount, 0));
  assert.doesNotMatch(text, /https?:|originalUrl|seller|token|password|secret/i);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
});
for (const route of ['/', '/about', '/prices', '/prices/ram', '/prices/ssd', '/it', '/community', '/community/hotdeal', '/contact', '/contact/write', '/admin']) {
  await check(`public page ${route}`, async () => {
    const { response, text } = await read(route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(text, /lang="ko"/);
    assert.match(text, /id="main-content"/);
    if (route.startsWith('/contact') || route === '/admin') assert.match(text, /name="robots" content="noindex, nofollow"/);
  });
}
for (const route of ['/no-such-verification-page', '/prices/no-such-category', '/community/not-a-board', '/deals/d1', '/it/missing-verification-post', '/community/hardware/missing-verification-post', '/contact/missing-verification-post']) {
  await check(`honest 404 ${route}`, async () => {
    const { response, text } = await read(route);
    assert.equal(response.status, 404);
    assert.match(text, /페이지를 찾을 수 없습니다/);
    assert.doesNotMatch(text, /₩129,000|역대가 근처/);
  });
}
await check('robots and sitemap', async () => {
  const robots = await read('/robots.txt');
  assert.equal(robots.response.status, 200);
  for (const path of ['/admin', '/api/', '/go/', '/contact']) assert.ok(robots.text.includes(`Disallow: ${path}`));
  const sitemap = await read('/sitemap.xml');
  assert.equal(sitemap.response.status, 200);
  for (const path of ['/prices/ram', '/prices/ssd']) assert.ok(sitemap.text.includes(`https://bluedeal.co.kr${path}`));
  for (const path of ['/admin', '/contact', '/api/', '/go/']) assert.equal(sitemap.text.includes(path), false);
});
await check('anonymous administrator status', async () => {
  const { response, text } = await read('/api/admin/status');
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(text).admin, false);
});
for (const board of ['it', 'hardware', 'hotdeal', 'inquiry']) {
  await check(`board response privacy ${board}`, async () => {
    const { response, text } = await read(`/api/posts?boardKey=${board}&limit=5`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
    assert.match(response.headers.get('vary'), /Cookie/i);
    const data = JSON.parse(text);
    assert.ok(Array.isArray(data.posts));
    for (const post of data.posts) {
      assert.equal('passwordHash' in post, false);
      if (post.isPrivate) {
        assert.equal(post.content, '');
        assert.equal('extra' in post, false);
      }
    }
  });
}
await check('legacy hotdeal entry redirects to the current board', async () => {
  const { response } = await read('/hot');
  assert.ok([307, 308].includes(response.status));
  assert.equal(new URL(response.headers.get('location'), base).pathname, '/community/hotdeal');
});

const report = { checkedAt: new Date().toISOString(), origin: base.origin, expectedCommit, passed: results.filter(item => item.passed).length, total: results.length, results };
if (option('--report')) await writeFile(option('--report'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(`${report.passed}/${report.total} read-only deployment checks passed.`);
process.exitCode = report.passed === report.total ? 0 : 1;
