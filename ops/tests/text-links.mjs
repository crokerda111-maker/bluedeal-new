import test from 'node:test';
import assert from 'node:assert/strict';
import { textLinkParts } from '../../src/lib/textLinks.ts';

test('link extraction preserves Korean text, punctuation, balanced URL parentheses and uppercase schemes', () => {
  const original = '출처 (HTTPS://example.com/a_(b)). 다음: /go/test-code! https://example.com/a?q=1&b=2, 끝';
  const parts = textLinkParts(original);
  assert.equal(parts.map(part => part.text).join(''), original);
  assert.deepEqual(parts.filter(part => part.href).map(part => part.href), ['HTTPS://example.com/a_(b)', '/go/test-code', 'https://example.com/a?q=1&b=2']);
});

test('invalid, too-long or wrong-case local paths do not turn partial codes into links', () => {
  const original = `/go/! /go/a /GO/test /gO/test /go/${'a'.repeat(65)} /go/ab`;
  const parts = textLinkParts(original);
  assert.equal(parts.map(part => part.text).join(''), original);
  assert.deepEqual(parts.filter(part => part.href).map(part => part.href), ['/go/ab']);
});

test('long trailing punctuation remains text without rescanning the full URL for each closing bracket', () => {
  const original='https://example.com/a'+')'.repeat(10000)+'.';
  const parts=textLinkParts(original);
  assert.equal(parts.map(part=>part.text).join(''),original);
  assert.deepEqual(parts.filter(part=>part.href).map(part=>part.href),['https://example.com/a']);
});
