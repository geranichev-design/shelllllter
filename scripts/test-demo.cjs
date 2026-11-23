const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../apps/frontend/node_modules/typescript');

// Run the actual client modules in Node with browser storage, without extra test dependencies.
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};

function load(demo = true, storage = new Map()) {
  process.env.NEXT_PUBLIC_DEMO_MODE = String(demo);
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(path.resolve(__dirname, '../apps/frontend/lib') + path.sep)) delete require.cache[key];
  }
  global.window = { localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } };
  global.fetch = () => { throw new Error('Demo mode must not access a network'); };
  return {
    ...require('../apps/frontend/lib/api.ts'),
    ...require('../apps/frontend/lib/auth.ts'),
    ...require('../apps/frontend/lib/demo/config.ts'),
    storage,
  };
}

const data = { name: 'Тестове укриття', type: 'STATIC', accessType: 'PUBLIC', capacity: 80, latitude: 50.45, longitude: 30.52, ownerOrgId: 'demo-organization-5' };
const send = (method, body) => ({ method, body: JSON.stringify(body) });

test('preview opens without login, credentials or network and provides related records', async () => {
  const app = load();
  assert.equal(app.getStoredAuth().user.role, 'DSNS');
  assert.equal((await app.apiFetch('/auth/me')).sub, app.getStoredAuth().user.id);
  const shelters = await app.apiFetch('/shelters');
  assert.equal(shelters.length, 5);
  assert.equal((await app.apiFetch('/organizations')).length, 7);
  assert.equal((await app.apiFetch('/shelter-requests')).length, 16);
  const detail = await app.apiFetch(`/shelters/${shelters[0].id}`);
  assert.ok(detail.ownerOrg.name);
  assert.ok(detail.sourceRequest.createdBy.email);
  assert.ok(detail.sourceRequest.data.media.length);
  assert.ok(!(JSON.stringify(detail).includes('password')));
  assert.equal((await app.apiFetch('/shelters/pending-verification')).length, 2);
});

test('create, approve, edit and reload persist across independent client instances', async () => {
  let app = load();
  const request = await app.apiFetch('/shelter-requests', send('POST', data));
  app.setStoredAuth(app.createDemoAuth('REGIONAL'));
  const approved = await app.apiFetch(`/shelter-requests/${request.id}/status`, send('PATCH', { status: 'APPROVED' }));
  assert.ok(approved.shelter.id);
  await app.apiFetch(`/shelter-requests/${request.id}/status`, send('PATCH', { status: 'APPROVED' }));
  assert.equal((await app.apiFetch('/shelters')).length, 6);
  await app.apiFetch(`/shelters/${approved.shelter.id}`, send('PATCH', { name: 'Збережена назва', status: 'PROJECT', details: { address: 'Демоадреса' } }));
  app = load(true, app.storage);
  const detail = await app.apiFetch(`/shelters/${approved.shelter.id}`);
  assert.equal(detail.name, 'Збережена назва');
  assert.equal(detail.status, 'PROJECT');
  assert.equal(detail.sourceRequest.data.address, 'Демоадреса');
  assert.equal(app.getStoredAuth().user.role, 'REGIONAL');
  await assert.rejects(app.apiFetch(`/shelter-requests/${request.id}/status`, send('PATCH', { status: 'NEW' })), { status: 409 });
});

test('role visibility, status rules, validation and unknown routes match UI expectations', async () => {
  const app = load();
  const requests = await app.apiFetch('/shelter-requests?status=NEW');
  assert.ok(requests.every(request => request.status === 'NEW'));
  app.setStoredAuth(app.createDemoAuth('BALANCE_HOLDER'));
  const own = await app.apiFetch('/shelter-requests');
  assert.ok(own.every(request => request.createdById === app.getStoredAuth().user.id));
  await assert.rejects(app.apiFetch(`/shelter-requests/${own[0].id}/status`, send('PATCH', { status: 'APPROVED' })), { status: 403 });
  await assert.rejects(app.apiFetch('/shelter-requests', send('POST', { ...data, capacity: -1 })), { status: 400 });
  app.setStoredAuth(app.createDemoAuth('REGIONAL'));
  await assert.rejects(app.apiFetch(`/shelter-requests/${requests[0].id}/status`, send('PATCH', { status: 'REJECTED' })), { status: 400 });
  await app.apiFetch(`/shelter-requests/${requests[0].id}/review`, send('PATCH', { decision: 'REJECT', rejectionReason: 'Тестова причина' }));
  assert.equal((await app.apiFetch(`/shelter-requests/${requests[0].id}`)).rejectionReason, 'Тестова причина');
  const shelters = await app.apiFetch('/shelters');
  await assert.rejects(app.apiFetch(`/shelters/${shelters[0].id}`, send('PATCH', { status: 'CONSTRUCTION' })), { status: 409 });
  await assert.rejects(app.apiFetch('/shelters/missing'), { status: 404 });
  await assert.rejects(app.apiFetch('/unsupported'), { status: 404 });
});

test('blocked iframe storage uses tab memory; corrupt storage recovers; reset restores the seed', async () => {
  const app = load();
  window.localStorage.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  window.localStorage.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  await app.apiFetch('/shelter-requests', send('POST', data));
  assert.equal((await app.apiFetch('/shelter-requests')).length, 17);
  require('../apps/frontend/lib/demo/api.ts').resetDemoData();
  assert.equal((await app.apiFetch('/shelter-requests')).length, 16);
  const fresh = load();
  fresh.storage.set(fresh.DEMO_DATA_KEY, '{broken');
  assert.equal((await fresh.apiFetch('/shelters')).length, 5);
  window.localStorage.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  await assert.rejects(fresh.apiFetch('/shelter-requests', send('POST', data)), { status: 413 });
  assert.equal((await fresh.apiFetch('/shelter-requests')).length, 16);
});

test('regular mode uses the real API contract and never consumes demo sessions', async () => {
  const app = load(false);
  app.storage.set(app.DEMO_AUTH_KEY, JSON.stringify(app.createDemoAuth()));
  assert.equal(app.getStoredAuth(), null);
  app.setStoredAuth({ accessToken: 'test-marker', user: { id: 'test-user', email: 'test@example.com', role: 'DSNS', orgId: null } });
  let requested;
  global.fetch = async (url, init) => {
    requested = { url, authorization: init.headers.get('Authorization') };
    return new Response(JSON.stringify([{ id: 'server-record' }]), { headers: { 'Content-Type': 'application/json' } });
  };
  assert.deepEqual(await app.apiFetch('/shelters'), [{ id: 'server-record' }]);
  assert.equal(requested.url, 'http://127.0.0.1:3001/shelters');
  assert.equal(requested.authorization, 'Bearer test-marker');
});
