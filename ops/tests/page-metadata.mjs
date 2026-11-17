import assert from 'node:assert/strict';

// Check rendered Next.js output: metadata inheritance can differ from helper objects.
export function assertPublicMetadata(html, path) {
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.ok(title, 'page title is required');
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1, 'one public canonical');
  assert.ok(html.includes(`rel="canonical" href="https://bluedeal.co.kr${path}"`));
  assert.ok(html.includes(`property="og:title" content="${title}"`), 'shared title matches the page');
  assert.ok(html.includes(`name="twitter:title" content="${title}"`));
  assert.ok(html.includes(`property="og:url" content="https://bluedeal.co.kr${path}"`));
  assert.match(html, /name="robots" content="index, follow"/);
}

export function assertExcludedMetadata(html) {
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /rel="canonical"/, 'write/private pages must not inherit the list canonical');
  assert.doesNotMatch(html, /property="og:url"/, 'write/private pages must not inherit the list share URL');
}
