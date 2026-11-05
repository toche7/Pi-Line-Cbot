import { createHmac, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { ChatClient } from './core.js';
import { createCustomerCore } from './customer-runtime.js';
import { MemoryStore } from './memory.js';
import { CourseRequests, CourseRequestStore } from './course-requests.js';
import { ConversationControl, conversationKey } from './conversation-control.js';
import { LineAdapter } from './line.js';
import { LineGroupStore } from './line-groups.js';
import { LineGroupReplies } from './line-group-replies.js';
import { DemoFailure } from './diagnostics.js';

export type LineSimulationMode = 'line-direct' | 'line-group';

// Real inbound adapters, synthetic events and an in-process reply sink only.
// No access token, LINE API transport, webhook listener or real customer identity.
export function createTerminalLineSimulation(options: {
  root: string;
  mode: LineSimulationMode;
  timeoutMs: number;
  experimentalGrounding?: boolean;
  factory?: NonNullable<Parameters<typeof createCustomerCore>[0]>['factory'];
}) {
  const account = 'terminal-simulation', user = 'U' + 'a'.repeat(32), groupId = 'C' + 'b'.repeat(32);
  const secret = randomBytes(32).toString('hex');
  const directMemory = new MemoryStore(join(options.root, 'direct-memory'));
  const groupMemory = new MemoryStore(join(options.root, 'group-memory'));
  const control = new ConversationControl(join(options.root, 'conversations'));
  const requests = new CourseRequests(new CourseRequestStore(join(options.root, 'requests')));
  const direct = createCustomerCore({ timeoutMs: options.timeoutMs, factory: options.factory, experimentalGrounding: options.experimentalGrounding, store: directMemory, requests,
    humanSupport: () => ({ waiting: !!control.mode(conversationKey(account, user)).waiting }) });
  const group = createCustomerCore({ timeoutMs: options.timeoutMs, factory: options.factory, experimentalGrounding: options.experimentalGrounding, store: groupMemory,
    privateChatCapabilities: { requests: true, commands: true, humanSupport: true } });
  const rooms = new LineGroupStore(join(options.root, 'rooms'), account);
  rooms.observe({ groupId, type: 'join', at: new Date().toISOString() }); rooms.enableCallWord(groupId);
  let currentReply: ((text: string) => void) | undefined;
  const reply = async (_token: string, text: string) => { currentReply?.(text); };
  const groupReplies = new LineGroupReplies(rooms, group, account, false, reply, undefined, () => 'CBOT');
  const adapter = new LineAdapter({ account, secret, allowedUsers: new Set([user]), dryRun: false,
    core: direct, control, groupReplies, reply, observeGroup: event => rooms.observe(event) });
  const directClient = direct.client({ channel: 'line', scope: account + ':direct', user });
  const groupClient = group.client({ channel: 'line', scope: account + ':group:' + groupId, user });
  let sequence = 0, busy = false;
  const client: ChatClient = {
    async send(prompt, output) {
      if (busy) throw new DemoFailure('กรุณารอข้อความก่อนหน้าในโหมดจำลอง');
      busy = true; let replied = false;
      currentReply = text => { replied = true; output.text(text + '\n'); };
      try {
        const text = options.mode === 'line-group' && !/^CBOT(?:\s|:|：|$)/i.test(prompt) ? 'CBOT ' + prompt : prompt;
        const raw = Buffer.from(JSON.stringify({ events: [{ type: 'message', webhookEventId: 'simulation-' + sequence++,
          timestamp: Date.now(), replyToken: 'simulation-only',
          source: options.mode === 'line-group' ? { type: 'group', groupId, userId: user } : { type: 'user', userId: user },
          message: { type: 'text', text } }] }));
        if (adapter.accept(raw, createHmac('sha256', secret).update(raw).digest('base64')) !== 200) throw new DemoFailure('รับข้อความจำลองไม่สำเร็จ');
        await adapter.drain();
        if (!replied) output.status('[ไม่มีคำตอบจากบอตในรอบนี้ เช่น อยู่ในสถานะพักตอบ]');
      } finally { currentReply = undefined; busy = false; }
    },
    async abort() { await Promise.all([directClient.abort(), groupClient.abort()]); },
  };
  return { client, async dispose() {
    adapter.close();
    try { await Promise.all([direct.dispose(), group.dispose()]); await adapter.drain(); }
    finally { directMemory.close(); groupMemory.close(); }
  } };
}
