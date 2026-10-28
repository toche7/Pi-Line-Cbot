import { createServer } from 'node:http';
import { adminHandler } from './admin.js';
import { ConversationMonitor } from './monitor.js';
import { CustomerCore } from './core.js';
import { LineAdapter, lineReply, webhookHandler } from './line.js';
import { requestTimeout } from './diagnostics.js';
import { MemoryStore } from './memory.js';
import { resolve } from 'node:path';
import { CourseRequestStore, CourseRequests } from './course-requests.js';

function start() {
  const secret = process.env.LINE_CHANNEL_SECRET || '';
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const dryRun = process.env.LINE_DRY_RUN !== 'false';
  const allowedUsers = new Set((process.env.LINE_ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean));
  const port = Number(process.env.PORT || '3000');
  const host = process.env.HOST || '127.0.0.1';
  if (!secret || !process.env.LINE_CHANNEL_ID || (!dryRun && (!token || !allowedUsers.size))) {
    console.error('ตั้ง LINE_CHANNEL_ID/LINE_CHANNEL_SECRET ก่อนเริ่ม และตั้ง access token/allowed user IDs ก่อนปิด dry run');
    process.exitCode = 1; return;
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('PORT ไม่ถูกต้อง'); process.exitCode = 1; return; }
  const log = (record: object) => console.log(JSON.stringify(record));
  const timeout = Math.min(requestTimeout(process.env.PI_TIMEOUT_MS), 25000);
  const store = new MemoryStore(resolve('.line-memory'));
  const requestStore = new CourseRequestStore(resolve('runtime/course-requests'));
  const requests = new CourseRequests(requestStore);
  const core = new CustomerCore(undefined, timeout, log, undefined, store, undefined, requests);
  const monitor = new ConversationMonitor(resolve('.line-monitor'));
  const monitorPort = Number(process.env.MONITOR_PORT || '3001');
  if (!Number.isInteger(monitorPort) || monitorPort < 1 || monitorPort > 65535 || monitorPort === port) throw new Error('Invalid monitor port');
  const monitorServer = createServer(adminHandler(monitor, requestStore));
  monitorServer.requestTimeout = 10000;
  monitorServer.headersTimeout = 10000;
  const adapter = new LineAdapter({ secret, account: process.env.LINE_CHANNEL_ID || 'test-oa', allowedUsers, dryRun, core, observe: event => monitor.record(event), reply: lineReply(token), log });
  const server = createServer(webhookHandler(adapter));
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.on('error', () => { console.error('เริ่ม webhook server ไม่สำเร็จ ตรวจ port และ host'); void stop(); process.exitCode = 1; });
  server.listen(port, host, () => {
    console.log(`ซีบอต local webhook: http://${host}:${port}/webhook/line`);
    console.log(`LINE dry run: ${dryRun}; allowlist configured: ${allowedUsers.size > 0}; no public deployment configured`);
    console.log('LINE persistent memory enabled; separate directory/lock from Terminal; retention 90 days');
  });
  monitorServer.on('error', () => { console.error('Monitor server unavailable'); void stop(); process.exitCode = 1; });
  monitorServer.listen(monitorPort, '127.0.0.1', () => console.log(`ติดตามบทสนทนา: http://127.0.0.1:${monitorPort}`));
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    adapter.close();
    server.close();
    monitorServer.close();
    monitorServer.closeAllConnections();
    try { await adapter.drain(); await core.dispose(); }
    finally { store.close(); server.closeAllConnections(); }
  };
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
}
try { start(); } catch { console.error('Configuration ไม่ถูกต้อง ตรวจ .env บนเครื่อง'); process.exitCode = 1; }
