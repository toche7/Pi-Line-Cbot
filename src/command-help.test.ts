import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { createHmac } from 'node:crypto';
import { commandHelp } from './command-help.js';
import { CustomerCore, type Identity } from './core.js';
import { MemoryStore, emptyMemory } from './memory.js';
import { runChat } from './chat.js';
import { LineAdapter } from './line.js';

function fixture(channel: 'terminal' | 'line') {
  const dir = mkdtempSync(join(tmpdir(), 'cbot-help-')), store = new MemoryStore(dir);
  const identity: Identity = { channel, scope: channel === 'line' ? 'fixture:direct' : 'local', user: 'A' };
  const key = JSON.stringify([identity.channel, identity.scope, identity.user]);
  const memory = emptyMemory(Date.now());
  memory.profile.name = 'Help-Fixture'; memory.longTerm = ['Keep this preference']; memory.summary.pending = ['Pending fixture'];
  store.save(key, memory);
  let sessions = 0;
  const core = new CustomerCore(async () => { sessions++; throw new Error('Host commands must not create model sessions'); }, 1000, undefined, undefined, store);
  return { store, core, key, identity, sessions: () => sessions,
    close: async () => { await core.dispose(); store.close(); rmSync(dir, { recursive: true, force: true }); } };
}
function checkHelp(text: string) {
  for (const command of ['/help', '/memory', '/reset', '/forget', '/confirm-forget', '/cancel']) assert.ok(text.includes(command));
  assert.match(text, /60 วินาที/); assert.match(text, /คงโปรไฟล์\/ข้อมูลระยะยาว/);
  assert.doesNotMatch(text, /\/model|\/settings/);
}

test('Terminal help is a host command, lists supported commands and cancels pending forget without deleting memory', async () => {
  const f = fixture('terminal'); let text = '';
  const sink = new Writable({ write(chunk, _encoding, done) { text += chunk.toString(); done(); } });
  try {
    const client = f.core.client(f.identity), before = f.store.load(f.key);
    await runChat(client, 1000, Readable.from(['/forget\n/help\n/confirm-forget\n/quit\nignored\n']), sink, sink);
    checkHelp(text); assert.match(text, /\/exit หรือ \/quit/); assert.match(text, /ยกเลิกคำขอ \/forget ที่รอยืนยันแล้ว/);
    assert.match(text, /ต้องใช้ \/forget/); assert.doesNotMatch(text, /ignored/);
    assert.deepEqual(f.store.load(f.key), before);
    await runChat(client, 1000, Readable.from(['/reset\n/memory\n/exit\n']), sink, sink);
    assert.equal(f.store.load(f.key).profile.name, 'Help-Fixture');
    assert.deepEqual(f.store.load(f.key).longTerm, ['Keep this preference']);
    assert.deepEqual(f.store.load(f.key).summary.pending, []);
    assert.equal(f.sessions(), 0);
  } finally { await f.close(); }
});

test('signed allowlisted LINE help has no Terminal exits, does not call model and safely cancels forget', async () => {
  const f = fixture('line'), replies: string[] = [], secret = 'help-test-only'; let event = 0;
  const adapter = new LineAdapter({ core: f.core, secret, account: 'fixture', dryRun: false, allowedUsers: new Set(['A']),
    reply: async (_token, text) => { replies.push(text); } });
  const send = async (text: string, userId = 'A') => {
    const raw = Buffer.from(JSON.stringify({ events: [{ type: 'message', webhookEventId: `help-${event++}`, replyToken: 'mock-only',
      source: { type: 'user', userId }, message: { type: 'text', text } }] }));
    assert.equal(adapter.accept(raw, createHmac('sha256', secret).update(raw).digest('base64')), 200);
    await adapter.drain(); return replies.at(-1)!;
  };
  try {
    const before = f.store.load(f.key);
    const help = await send('/help'); checkHelp(help); assert.doesNotMatch(help, /\/exit|\/quit/);
    await send('/help', 'not-allowed'); assert.equal(replies.length, 1);
    await send('/forget'); assert.match(await send('/help'), /ยกเลิกคำขอ \/forget ที่รอยืนยันแล้ว/);
    assert.match(await send('/confirm-forget'), /ต้องใช้ \/forget/);
    assert.deepEqual(f.store.load(f.key), before);
    await send('/reset');
    assert.equal(f.store.load(f.key).profile.name, 'Help-Fixture');
    assert.deepEqual(f.store.load(f.key).longTerm, ['Keep this preference']);
    assert.deepEqual(f.store.load(f.key).summary.pending, []);
    assert.equal(f.sessions(), 0);
  } finally { adapter.close(); await f.close(); }
});

test('help omits memory commands when the supplied client does not implement them', () => {
  const text = commandHelp('terminal');
  assert.match(text, /\/help/); assert.match(text, /\/exit หรือ \/quit/);
  assert.doesNotMatch(text, /\/memory|\/reset|\/forget|\/confirm-forget|\/cancel|\/model|\/settings/);
});
