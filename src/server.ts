import { createServer } from 'node:http';
import { CustomerCore } from './core.js';
import { LineAdapter, lineReply, webhookHandler } from './line.js';
import { requestTimeout } from './diagnostics.js';

function start() {
  const secret = process.env.LINE_CHANNEL_SECRET || '';
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const dryRun = process.env.LINE_DRY_RUN !== 'false';
  const allowedUsers = new Set((process.env.LINE_ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean));
  const port = Number(process.env.PORT || '3000');
  const host = process.env.HOST || '127.0.0.1';
  if (!secret || (!dryRun && (!token || !allowedUsers.size))) {
    console.error('ตั้ง LINE_CHANNEL_SECRET ก่อนเริ่ม และตั้ง access token/allowed user IDs ก่อนปิด dry run');
    process.exitCode = 1; return;
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('PORT ไม่ถูกต้อง'); process.exitCode = 1; return; }
  const log = (record: object) => console.log(JSON.stringify(record));
  const core = new CustomerCore(undefined, Math.min(requestTimeout(process.env.PI_TIMEOUT_MS), 25000), log);
  const adapter = new LineAdapter({ secret, account: process.env.LINE_CHANNEL_ID || 'test-oa', allowedUsers, dryRun, core, reply: lineReply(token), log });
  const server = createServer(webhookHandler(adapter));
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.on('error', () => { console.error('เริ่ม webhook server ไม่สำเร็จ ตรวจ port และ host'); void core.dispose(); process.exitCode = 1; });
  server.listen(port, host, () => {
    console.log(`ซีบอต local webhook: http://${host}:${port}/webhook/line`);
    console.log(`LINE dry run: ${dryRun}; allowlist configured: ${allowedUsers.size > 0}; no public deployment configured`);
  });
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    adapter.close();
    server.close();
    await core.dispose();
    await adapter.drain();
    server.closeAllConnections();
  };
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
}
try { start(); } catch { console.error('Configuration ไม่ถูกต้อง ตรวจ .env บนเครื่อง'); process.exitCode = 1; }
