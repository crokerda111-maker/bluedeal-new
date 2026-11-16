import assert from 'node:assert/strict';

export function assertBrowserHeaders(response) {
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  const policy = response.headers.get('content-security-policy') ?? '';
  const directives = policy.split(';').map(value => value.trim()).filter(Boolean);
  for (const expected of ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"]) assert.ok(directives.includes(expected));
  assert.equal(response.headers.has('x-powered-by'), false);
}
