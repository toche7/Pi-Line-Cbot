import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { adminHandler } from './admin.js';
import { BotProfile } from './bot-profile.js';
import { CourseRequestStore } from './course-requests.js';
import { ConversationMonitor } from './monitor.js';
import { routePermission } from './staff-auth.js';
import { SystemStatusService } from './system-status.js';

test('bot setup saves the display name and reads LINE account metadata through the admin routes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bot-profile-'));
  const path = join(dir, 'profile.json');
  const calls: string[] = [];
  const status = new SystemStatusService({
    startedAt: Date.now(), webhookPort: 3000, adminPort: 3001, listeners: () => ({ admin: true, webhook: true }),
    token: 'fixture-token', channelConfigured: true, secretConfigured: true, dryRun: true,
    publicBase: 'https://fixture.example', stores: [], worker: () => ({ running: true, suspended: false, busy: false }),
  }, async (input, options) => {
    assert.equal(options?.method, 'GET');
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/bot/info')) return Response.json({ displayName: 'LINE ของทีม', basicId: '@line-team', userId: 'private-id' });
    if (url.endsWith('/endpoint')) return Response.json({ endpoint: 'https://fixture.example/webhook/line', active: true });
    return Response.json({ ok: true });
  });
  const server = createServer(adminHandler(new ConversationMonitor(join(dir, 'monitor')), new CourseRequestStore(join(dir, 'requests')),
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, status, undefined, new BotProfile(path)));
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const origin = 'http://127.0.0.1:' + address.port;
    const home = await (await fetch(origin)).text();
    assert.match(home, /id="admin-bot-name">ซีบอต</);
    const token = home.match(/const CUSTOMER_CSRF_TOKEN="([a-f0-9]+)"/)?.[1];
    assert.ok(token);
    const post = (route: string, data: object, csrf = token) => fetch(origin + route, {
      method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-customer-token': csrf }, body: JSON.stringify(data),
    });
    assert.equal((await post('/api/bot-profile', { name: 'บอตทีม' }, 'invalid')).status, 403);
    assert.equal((await post('/api/bot-profile', { name: ' ' })).status, 400);
    assert.equal((await post('/api/bot-profile', { name: 'ก'.repeat(31) })).status, 400);
    const name = 'บอต <ทีม>';
    assert.equal((await post('/api/bot-profile', { name: '  ' + name + '  ' })).status, 200);
    assert.equal(new BotProfile(path).name(), name);
    assert.match(await (await fetch(origin)).text(), /id="admin-bot-name">บอต &lt;ทีม&gt;</);

    const unchecked = await (await fetch(origin + '/api/bot-line')).json();
    assert.equal(unchecked.account, null);
    assert.equal(calls.length, 0);
    const checked = await (await post('/api/bot-line', {})).json();
    assert.deepEqual(checked.account, { displayName: 'LINE ของทีม', basicId: '@line-team' });
    assert.equal(checked.status.state, 'warning');
    assert.equal(calls.filter(url => url.endsWith('/bot/info')).length, 1);
    assert.equal((await (await fetch(origin + '/api/bot-line')).json()).account.basicId, '@line-team');

    assert.equal(routePermission('/api/bot-profile', 'POST'), 'bot.manage');
    assert.equal(routePermission('/api/bot-line', 'POST'), 'line.connection.manage');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});
