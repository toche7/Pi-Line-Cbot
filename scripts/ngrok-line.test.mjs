import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectTunnel, updateEnv, synchronize } from './ngrok-line.mjs';

const base = 'https://example.ngrok-free.app';
function fixture() {
  const calls = [];
  let current = { endpoint: 'https://old.example/webhook/line', active: true };
  const options = {
    env: { LINE_CHANNEL_ID: '123', LINE_CHANNEL_SECRET: 'secret', LINE_CHANNEL_ACCESS_TOKEN: 'token', LINE_DRY_RUN: 'false' },
    api: async (path, method, body) => {
      calls.push([path, method]);
      if (path === '/v2/bot/info') return { displayName: 'DemoB1' };
      if (path === '/v2/oauth/verify') return { client_id: 123 };
      if (path.endsWith('/test')) return { success: true };
      if (method === 'PUT') current = { ...current, endpoint: body.endpoint };
      return { ...current };
    },
    check: async () => calls.push(['check']),
    saveBackup: async value => calls.push(['backup', value]),
    saveEnv: async value => calls.push(['env', value]),
    log: () => {},
  };
  return { calls, options, setCurrent: value => { current = value; } };
}
test('accepts only one matching HTTPS upstream', () => {
  const t = { config: { addr: 'http://127.0.0.1:3000' }, public_url: base };
  assert.equal(selectTunnel([t]), base);
  assert.throws(() => selectTunnel([]));
  assert.throws(() => selectTunnel([t, t]));
  assert.throws(() => selectTunnel([{ ...t, public_url: base + '/wrong' }]));
});
test('updates URL while preserving credentials and reply mode', () => {
  const result = updateEnv('TOKEN=private\nLINE_DRY_RUN=false\nexport PUBLIC_BASE_URL=old\nPUBLIC_BASE_URL=duplicate\n', base);
  assert.match(result, /TOKEN=private\nLINE_DRY_RUN=false/);
  assert.equal(result.match(/PUBLIC_BASE_URL=/g).length, 1);
  assert.match(result, /PUBLIC_BASE_URL=https:\/\/example/);
});
test('backs up before mutation and saves config after readback', async () => {
  const f = fixture();
  await synchronize(base, f.options);
  const backup = f.calls.findIndex(c => c[0] === 'backup');
  const put = f.calls.findIndex(c => c[1] === 'PUT');
  const saved = f.calls.findIndex(c => c[0] === 'env');
  assert.ok(backup < put && put < saved);
  assert.equal(f.calls[backup][1].previous.endpoint, 'https://old.example/webhook/line');
  assert.equal(f.options.env.LINE_DRY_RUN, 'false');
});
test('verification failure prevents remote mutation and config write', async () => {
  const f = fixture();
  f.options.check = async () => { throw Error('public check'); };
  await assert.rejects(synchronize(base, f.options));
  assert.ok(!f.calls.some(c => c[1] === 'PUT' || c[0] === 'env'));
});
test('existing matching webhook avoids mutation and backup', async () => {
  const f = fixture();
  f.setCurrent({ endpoint: base + '/webhook/line', active: true });
  await synchronize(base, f.options);
  assert.ok(!f.calls.some(c => c[1] === 'PUT' || c[0] === 'backup'));
  assert.ok(f.calls.some(c => c[0] === 'env'));
});
test('backup failure prevents remote mutation', async () => {
  const f = fixture();
  f.options.saveBackup = async () => { throw Error('disk full'); };
  await assert.rejects(synchronize(base, f.options));
  assert.ok(!f.calls.some(c => c[1] === 'PUT'));
});
