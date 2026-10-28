import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { LineAdapter } from './line.js';
test('group discovery requires signed events and cannot call core or send replies', async () => {
  const ids: string[] = [];
  const adapter = new LineAdapter({ secret: 'fixture', account: 'oa', allowedUsers: new Set(), dryRun: false,
    observeGroupId: id => ids.push(id), core: { client: () => { throw Error('must not call core'); } }, reply: async () => { throw Error('must not reply'); } });
  const id = 'C' + 'a'.repeat(32);
  const raw = Buffer.from(JSON.stringify({ events: [{ type: 'message', source: { type: 'group', groupId: id }, message: { type: 'text', text: 'fixture' } }] }));
  assert.equal(adapter.accept(raw, 'invalid'), 401); assert.deepEqual(ids, []);
  assert.equal(adapter.accept(raw, createHmac('sha256', 'fixture').update(raw).digest('base64')), 200);
  await adapter.drain(); assert.deepEqual(ids, [id]); adapter.close();
});
