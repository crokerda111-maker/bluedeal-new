import test from 'node:test';
import assert from 'node:assert/strict';
import { apiGetPost } from '../../src/lib/postsClient.ts';

test('private unlock sends the password only in a no-store JSON POST body', async t => {
  const password='TEST ONLY +?&#/ password';
  const fetchMock=t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({post:{id:'fixture',content:'TEST ONLY'}}),{status:200}));
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
  const fetchMock=t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({post:{id:'fixture'}}),{status:200}));
  await apiGetPost('fixture');
  const [url,init]=fetchMock.mock.calls[0].arguments;
  assert.equal(url,'/api/posts/fixture');
  assert.deepEqual(init,{method:'GET',cache:'no-store'});
});
