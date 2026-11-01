import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cloudRouting } from './cloud-routing.js';
import { StaffAuth } from './staff-auth.js';
import { StaffStore } from './staff-store.js';
import { CustomerStore } from './customers.js';
import { ConversationMonitor } from './monitor.js';
import { CourseRequestStore } from './course-requests.js';
import { adminHandler } from './admin.js';

test('single cloud listener keeps public routes separate and protects real panel reads/writes with HTTPS staff auth', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cloud-http-'));
  const origin = 'https://trial.example';
  const staff = new StaffStore(join(root, 'staff'), 'owner@example.test');
  const nonces = new Map<string, string>();
  let subject = 'owner', email = 'owner@example.test';
  const auth = new StaffAuth(staff, { clientId: 'fixture', clientSecret: 'fixture', redirectUri: origin + '/auth/google/callback' }, {
    authorizationUrl: (state, nonce) => { nonces.set(state, nonce); return 'https://accounts.google.com/?state=' + state; },
    exchange: async code => ({ subject, email, emailVerified: true, nonce: nonces.get(code)! }),
  });
  const customers = new CustomerStore(join(root, 'customers'));
  const monitor = new ConversationMonitor(join(root, 'monitor'));
  const requests = new CourseRequestStore(join(root, 'requests'));
  const admin = adminHandler(monitor, requests, customers, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, auth);
  let ready = true;
  const server = createServer(cloudRouting({ admin, ready: () => ready,
    webhook: (_req, res) => res.writeHead(202).end('webhook'),
    media: (_req, res) => res.writeHead(404).end('media') }));
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  function call(path: string, headers: Record<string, string> = {}, body?: object) {
    return new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: string }>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port, path, method: body ? 'POST' : 'GET', headers: { Host: 'trial.example', ...headers } }, res => {
        let data = ''; res.on('data', c => data += c); res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: data }));
      }); req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
    });
  }
  async function login() {
    const start = await call('/auth/google/start'); assert.equal(start.status, 303);
    const flow = start.headers['set-cookie']![0]; assert.match(flow, /; Secure/);
    const state = new URL(start.headers.location!).searchParams.get('state')!;
    const done = await call('/auth/google/callback?state=' + state + '&code=' + state, { Cookie: flow.split(';')[0], 'Sec-Fetch-Site': 'cross-site' });
    assert.equal(done.status, 303); assert.match(done.headers['set-cookie']![0], /HttpOnly; SameSite=Lax.*; Secure/);
    const cookie = done.headers['set-cookie']![0].split(';')[0];
    const me = JSON.parse((await call('/auth/me', { Cookie: cookie })).body);
    return { Cookie: cookie, Origin: origin, 'X-Staff-Token': me.csrf, 'Content-Type': 'application/json' };
  }
  try {
    assert.equal((await call('/healthz', { Host: 'healthcheck.railway.app' })).status, 200);
    ready = false; assert.equal((await call('/healthz')).status, 503); ready = true;
    assert.equal((await call('/webhook/line')).body, 'webhook');
    assert.equal((await call('/news-media/missing')).body, 'media');
    assert.equal((await call('/api/customers')).status, 401);
    assert.equal((await call('/api/customers', { Host: 'evil.example', 'X-Forwarded-Host': 'trial.example' })).status, 403);
    const headers = await login();
    const home = await call('/', headers); assert.equal(home.status, 200);
    const legacyToken = JSON.parse(/const CUSTOMER_CSRF_TOKEN=("[^"]+")/.exec(home.body)![1]);
    assert.equal((await call('/api/browse/customers?page=1', headers)).status, 200);
    assert.equal((await call('/api/browse/customers?page=1', { ...headers, Origin: 'https://evil.example' })).status, 403);
    assert.equal((await call('/api/customers', { ...headers, 'X-Staff-Token': 'forged', 'X-Customer-Token': legacyToken }, {})).status, 403);
    const state = JSON.parse((await call('/api/customers', headers)).body);
    const change = { action: 'group.create', revision: state.revision, data: { name: 'Trial fixture', description: '' } };
    assert.equal((await call('/api/customers', { ...headers, 'X-Customer-Token': legacyToken }, change)).status, 200);
    const persisted = new CustomerStore(join(root, 'customers')).snapshot({ events: [], requests: [] });
    assert.equal(persisted.groups[0].name, 'Trial fixture'); assert.equal(persisted.groups[0].actor, 'staff:owner');
    const owner = staff.identity('owner')!;
    staff.mutate(owner, { action: 'invite', revision: staff.snapshot().revision, email: 'worker@example.test', role: 'staff', enabled: true, extras: [] });
    subject = 'worker'; email = 'worker@example.test'; const worker = await login();
    assert.equal((await call('/api/staff', worker)).status, 403);
    assert.equal((await call('/api/knowledge', worker)).status, 403);
    assert.equal((await call('/api/browse/customers?page=1', worker)).status, 200);
    // Remote HTTPS requests are allowed only after the configured exact Host gate.
    const deny = auth.wrap(() => { throw Error('must not dispatch'); }, () => 'login');
    let status = 0;
    deny({ url: '/api/customers', method: 'GET', headers: { host: 'trial.example' }, socket: { remoteAddress: '203.0.113.1' } } as IncomingMessage,
      { writeHead(code: number) { status = code; return this; }, end() {} } as ServerResponse);
    await new Promise(r => setImmediate(r)); assert.equal(status, 401);
  } finally {
    server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); rmSync(root, { recursive: true, force: true });
  }
});
