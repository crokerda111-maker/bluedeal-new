import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, apiListPosts, apiGetPost, apiCreatePost, apiUpdatePost, apiDeletePost, apiAdminStatus, apiAdminLogin, apiAdminLogout } from '../../src/lib/postsClient.ts';

const fixture = { id: 'fixture', boardKey: 'hardware', type: 'general', title: 'Local fixture', content: 'TEST ONLY', createdAt: '2026-11-17T03:00:00+09:00' };
const malformed = error => error instanceof ApiError && error.code === 'INVALID_API_RESPONSE';

test('private unlock sends the password only in a no-store JSON POST body', async t => {
  const password='TEST ONLY +?&#/ password';
  const fetchMock=t.mock.method(globalThis,'fetch',async()=>Response.json({post:fixture}));
  await apiGetPost('fixture',{password});
  const [url,init]=fetchMock.mock.calls[0].arguments;
  assert.equal(url,'/api/posts/fixture/unlock');
  assert.equal(url.includes(password),false);
  assert.equal(init.method,'POST');
  assert.equal(init.cache,'no-store');
  assert.equal(init.headers['Content-Type'],'application/json');
  assert.deepEqual(JSON.parse(init.body),{password});
});

test('ordinary post reads use GET without credentials in the URL', async t => {
  const fetchMock=t.mock.method(globalThis,'fetch',async()=>Response.json({post:fixture}));
  await apiGetPost('fixture');
  const [url,init]=fetchMock.mock.calls[0].arguments;
  assert.equal(url,'/api/posts/fixture');
  assert.deepEqual(init,{method:'GET',cache:'no-store'});
});

test('valid lists preserve records and empty lists; malformed successes never become empty data', async t => {
  let payload = { posts: [fixture] };
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  assert.deepEqual(await apiListPosts('hardware'), [fixture]);
  payload = { posts: [] };
  assert.deepEqual(await apiListPosts('hardware'), []);
  for (payload of [null, [], {}, { posts: null }, { posts: [null] }, { posts: [{ ...fixture, title: {} }] }, { posts: [{ ...fixture, boardKey: 'inquiry' }] }]) {
    await assert.rejects(apiListPosts('hardware'), malformed);
  }
});

test('post reads reject wrong IDs, missing fields, unsafe types and password hashes', async t => {
  let payload;
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  for (payload of [{ post: null }, { post: [] }, { post: { id: 'fixture' } }, { post: { ...fixture, id: 'another' } }, { post: { ...fixture, isPrivate: 'false' } }, { post: { ...fixture, authorName: {} } }, { post: { ...fixture, extra: [] } }, { post: { ...fixture, passwordHash: 'FAKE_HASH' } }]) {
    await assert.rejects(apiGetPost('fixture'), malformed);
  }
  payload = { post: { ...fixture, isPrivate: true, content: '', extra: undefined } };
  assert.equal((await apiGetPost('fixture')).isPrivate, true);
});

test('administrator status requires a boolean and an uncached request', async t => {
  let payload = { admin: false };
  const mocked = t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  assert.equal(await apiAdminStatus(), false);
  payload = { admin: true };
  assert.equal(await apiAdminStatus(), true);
  assert.equal(mocked.mock.calls[0].arguments[1].cache, 'no-store');
  for (payload of [{ admin: 'false' }, { admin: 1 }, {}, null]) await assert.rejects(apiAdminStatus(), malformed);
});

test('login, logout and delete require explicit success instead of accepting any HTTP 200 body', async t => {
  let payload;
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  const actions = [() => apiAdminLogin('FAKE_PASSWORD'), () => apiAdminLogout(), () => apiDeletePost('fixture')];
  for (const action of actions) {
    for (payload of [null, {}, { ok: false }, { ok: 'true' }]) await assert.rejects(action(), malformed);
    payload = { ok: true };
    await action();
  }
});

test('create and update require a complete saved post and update must match the requested ID', async t => {
  let payload;
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  const input = { boardKey: 'hardware', type: 'general', title: 'Fixture', content: 'Fixture body' };
  for (const action of [() => apiCreatePost(input), () => apiUpdatePost('fixture', { title: 'Updated' })]) {
    for (payload of [null, {}, { post: [] }]) await assert.rejects(action(), malformed);
    payload = { post: fixture };
    assert.deepEqual(await action(), fixture);
  }
  payload = { post: { ...fixture, id: 'wrong' } };
  await assert.rejects(apiUpdatePost('fixture', { title: 'Updated' }), malformed);
  payload = { post: { ...fixture, boardKey: 'inquiry' } };
  await assert.rejects(apiCreatePost(input), malformed);
});

test('unexpected server diagnostics are hidden while known configuration and client errors stay useful', async t => {
  let payload = { error: 'PRIVATE_BACKEND_DIAGNOSTIC', errorCode: { private: true } };
  let status = 500;
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload, { status }));
  await assert.rejects(apiListPosts('hardware'), error => error instanceof ApiError && !error.message.includes('PRIVATE_') && error.code === undefined && error.status === 500);
  payload = { error: 'PRIVATE_BACKEND_DIAGNOSTIC', errorCode: 'KV_NOT_CONFIGURED' }; status = 503;
  await assert.rejects(apiListPosts('hardware'), error => error.code === 'KV_NOT_CONFIGURED' && error.message.includes('연결') && !error.message.includes('PRIVATE_'));
  payload = { error: '비밀번호가 맞지 않습니다.', errorCode: 'PASSWORD_INVALID' }; status = 403;
  await assert.rejects(apiGetPost('fixture', { password: 'FAKE_PASSWORD' }), error => error.message === payload.error && error.code === 'PASSWORD_INVALID');
});

test('HTML and invalid JSON successes never masquerade as authentication or board data', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>unexpected login page</html>', { status: 200 }));
  for (const action of [() => apiListPosts('hardware'), () => apiGetPost('fixture'), () => apiAdminStatus(), () => apiAdminLogin('FAKE'), () => apiAdminLogout(), () => apiDeletePost('fixture')]) await assert.rejects(action(), malformed);
});
