import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createHash, createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { bindCloudChannel } from './deployment.js';
import { ConversationMonitor } from './monitor.js';

test('cloud entrypoint verifies signed webhooks and keeps volume data across a graceful process restart', { timeout: 20000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'trial-lifecycle-'));
  const reservation = createServer(); await new Promise<void>(r => reservation.listen(0, '127.0.0.1', r));
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>(r => reservation.close(() => r()));
  const locks = join(tmpdir(), 'cbot-cloud-locks-' + createHash('sha256').update(root).digest('hex'));
  const secret = 'fixture-channel-secret';
  const env = { PATH: process.env.PATH, DEPLOYMENT_MODE: 'cloud', DATA_ROOT: root, PORT: String(port),
    PUBLIC_BASE_URL: 'https://trial.example', LINE_CHANNEL_ID: 'trial-fixture', LINE_CHANNEL_SECRET: secret, LINE_DRY_RUN: 'true',
    GOOGLE_CLIENT_ID: 'fixture', GOOGLE_CLIENT_SECRET: 'fixture', GOOGLE_REDIRECT_URI: 'https://trial.example/auth/google/callback', ADMIN_BOOTSTRAP_EMAIL: 'owner@example.test' };
  let child: ChildProcess | undefined, logs = '';
  async function start() {
    child = spawn(process.execPath, [new URL('./server.js', import.meta.url).pathname], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout!.on('data', c => logs = (logs + c).slice(-4000)); child.stderr!.on('data', c => logs = (logs + c).slice(-4000));
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw Error('Fixture cloud startup failed: ' + logs);
      try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).status === 200) return; } catch {}
      await delay(50);
    }
    throw Error('Fixture cloud health timed out: ' + logs);
  }
  async function stop() {
    const current = child; if (!current || current.exitCode !== null) return;
    const done = once(current, 'exit'); current.kill('SIGTERM'); await done;
    assert.equal(current.exitCode, 0, logs); child = undefined;
  }
  try {
    bindCloudChannel(root, 'trial-fixture');
    const monitorRoot = join(root, '.line-monitor');
    new ConversationMonitor(monitorRoot).record({ id: 'fixture-event', userId: 'fixture-person', account: 'trial-fixture', direction: 'in', text: 'restart fixture', status: 'received', at: new Date().toISOString() });
    await start();
    const body = JSON.stringify({ events: [] });
    const base = `http://127.0.0.1:${port}`;
    const signed = createHmac('sha256', secret).update(body).digest('base64');
    assert.equal((await fetch(base + '/webhook/line', { method: 'POST', headers: { 'X-Line-Signature': signed }, body })).status, 200);
    assert.equal((await fetch(base + '/webhook/line', { method: 'POST', body })).status, 401);
    assert.equal((await fetch(base + '/api/customers')).status, 403); // Loopback Host cannot enter the public admin origin.
    await stop();
    assert.equal(new ConversationMonitor(monitorRoot).snapshot().events[0].text, 'restart fixture');
    await start(); await stop();
    assert.equal(new ConversationMonitor(monitorRoot).snapshot().events[0].text, 'restart fixture');
  } finally {
    if (child && child.exitCode === null) { const done = once(child, 'exit'); child.kill('SIGKILL'); await done; }
    rmSync(root, { recursive: true, force: true }); rmSync(locks, { recursive: true, force: true });
  }
});
