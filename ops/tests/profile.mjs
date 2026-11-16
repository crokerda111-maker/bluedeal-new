import test from 'node:test';
import assert from 'node:assert/strict';
import { getProfile, getNickname, setNickname, onProfileChanged } from '../../src/lib/profile.ts';

const key = 'bluedeal_profile_v1';
function browser(t, options = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const target = new EventTarget();
  const values = new Map();
  const storage = {
    getItem(name) { if (options.readFails) throw new Error('blocked'); return values.get(name) ?? null; },
    setItem(name, value) { if (options.writeFails) throw new Error('full'); values.set(name, value); },
  };
  Object.defineProperty(target, 'localStorage', { get() { if (options.getterFails) throw new Error('blocked'); return storage; } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  });
  const notify = (changedKey, storageArea = storage) => {
    const event = new Event('storage');
    Object.defineProperties(event, { key: { value: changedKey }, storageArea: { value: storageArea } });
    target.dispatchEvent(event);
  };
  return { target, values, storage, notify };
}

test('server rendering has no browser profile or retained nickname', () => {
  assert.equal(typeof window, 'undefined');
  assert.equal(setNickname('server fixture'), false);
  assert.equal(getProfile(), null);
  assert.equal(getNickname(), '게스트');
  assert.doesNotThrow(() => onProfileChanged(() => {})());
});

test('a blocked localStorage getter does not crash reads, writes or subscriptions', t => {
  browser(t, { getterFails: true });
  let changes = 0;
  const unsubscribe = onProfileChanged(() => { changes++; });
  assert.equal(getNickname(), '게스트');
  assert.equal(setNickname('임시 닉네임'), false);
  assert.equal(getNickname(), '임시 닉네임');
  assert.equal(changes, 1);
  unsubscribe();
  setNickname('구독 해제 후');
  assert.equal(changes, 1);
});

test('a failed write keeps the newly entered nickname instead of an older stored value', t => {
  const { values } = browser(t, { writeFails: true });
  values.set(key, JSON.stringify({ nickname: '기존 이름' }));
  assert.equal(getNickname(), '기존 이름');
  assert.equal(setNickname('새 이름'), false);
  assert.equal(getNickname(), '새 이름');
  assert.equal(JSON.parse(values.get(key)).nickname, '기존 이름');
});

test('a failed read remains usable and a successful write is visible in the current tab', t => {
  browser(t, { readFails: true });
  assert.equal(getProfile(), null);
  assert.equal(setNickname('읽기 차단'), true);
  assert.equal(getNickname(), '읽기 차단');
});

test('malformed stored data falls back safely without rewriting it', t => {
  const { values } = browser(t);
  for (const raw of ['broken', 'null', '[]', 'false', '{"nickname":3}']) {
    values.set(key, raw);
    assert.equal(getNickname(), '게스트');
    assert.equal(values.get(key), raw);
  }
  values.set(key, JSON.stringify({ nickname: '  정상 이름  ', unrelated: 'ignored' }));
  assert.deepEqual(getProfile(), { nickname: '정상 이름' });
});

test('other-tab updates and clear resync the profile; unrelated storage is ignored', t => {
  const { values, notify } = browser(t);
  let changes = 0;
  const unsubscribe = onProfileChanged(() => { changes++; });
  setNickname('이 탭');
  values.set(key, JSON.stringify({ nickname: '다른 탭' }));
  notify('another-key');
  notify(key, {});
  assert.equal(changes, 1);
  assert.equal(getNickname(), '이 탭');
  notify(key);
  assert.equal(changes, 2);
  assert.equal(getNickname(), '다른 탭');
  values.clear();
  notify(null);
  assert.equal(getNickname(), '게스트');
  assert.equal(changes, 3);
  unsubscribe();
});

test('a new browser page never inherits a failed-storage nickname from another window', t => {
  browser(t, { getterFails: true });
  setNickname('페이지 한정');
  const previous = window;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  assert.equal(getNickname(), '게스트');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: previous });
});
