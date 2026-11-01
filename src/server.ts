import { runningVersion } from './program-version.js';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { deploymentConfig, bindCloudChannel } from './deployment.js';
import { cloudRouting } from './cloud-routing.js';
import { StaffAuth } from './staff-auth.js';
import { StaffStore } from './staff-store.js';
import { googleLoginConfig } from './google-login.js';
import { SystemStatusService } from './system-status.js';
import { RequestWorkStore } from './request-work.js';
import { NewsMediaStore } from './news-media.js';
import { newsPublicMedia, newsImageBase } from './news-public-media.js';
import type { HandoverTranscript } from './handover-context.js';
import { ResponseSettingsStore, configureResponseSettings } from './response-settings.js';
import { ResponseSettingsService } from './response-settings-service.js';
import { KnowledgeStore, configureKnowledge } from './knowledge-store.js';
import { NewsService, NewsStore, newsLineTransport } from './news.js';
import { NewsWorker } from './news-worker.js';
import { ConversationControl, linePush } from './conversation-control.js';
import { createServer } from 'node:http';
import { adminHandler } from './admin.js';
import { ConversationMonitor } from './monitor.js';
import { CustomerCore } from './core.js';
import { createCustomerCore } from './customer-runtime.js';
import { LineAdapter, lineReply, webhookHandler } from './line.js';
import { requestTimeout } from './diagnostics.js';
import { MemoryStore } from './memory.js';
import { resolve } from 'node:path';
import { CourseRequestStore, CourseRequests } from './course-requests.js';
import { CustomerStore } from './customers.js';
import { LineProfiles } from './line-profile.js';
import { LineGroupStore, LineGroupService } from './line-groups.js';
import { LineGroupReplies } from './line-group-replies.js';
import { PendingLineUsers } from './line-pending-users.js';
import { LineAccess } from './line-access.js';

async function start() {
  const deployment = deploymentConfig(process.env);
  const { cloud, dataPath } = deployment;
  const loginConfig = googleLoginConfig(process.env);
  if (cloud && (!loginConfig || !process.env.ADMIN_BOOTSTRAP_EMAIL?.trim())) throw Error('Cloud requires Google login and bootstrap admin');
  if (cloud) bindCloudChannel(process.env.DATA_ROOT!, process.env.LINE_CHANNEL_ID || '');
  // Railway mounts a volume to only one active deployment. Process-lifetime
  // locks stay off that volume so container PID reuse cannot block restart.
  const lockRoot = cloud ? join(tmpdir(), 'cbot-cloud-locks-' + createHash('sha256').update(process.env.DATA_ROOT!).digest('hex')) : undefined;
  if (lockRoot) mkdirSync(lockRoot, { recursive: true, mode: 0o700 });
  const secret = process.env.LINE_CHANNEL_SECRET || '';
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const dryRun = process.env.LINE_DRY_RUN !== 'false';
  const allowedUsers = new Set((process.env.LINE_ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean));
  const lineAccess = new LineAccess(dataPath('runtime/line-access'), process.env.LINE_CHANNEL_ID || '', allowedUsers);
  const port = Number(process.env.PORT || '3000');
  const host = deployment.host;
  if (!secret || !process.env.LINE_CHANNEL_ID || (!dryRun && (!token || !allowedUsers.size))) {
    console.error('ตั้ง LINE_CHANNEL_ID/LINE_CHANNEL_SECRET ก่อนเริ่ม และตั้ง access token/allowed user IDs ก่อนปิด dry run');
    process.exitCode = 1; return;
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('PORT ไม่ถูกต้อง'); process.exitCode = 1; return; }
  const log = (record: object) => console.log(JSON.stringify(record));
  const timeout = Math.min(requestTimeout(process.env.PI_TIMEOUT_MS), 25000);
  const store = new MemoryStore(dataPath('.line-memory'), undefined, lockRoot ? join(lockRoot, 'direct') : undefined);
  const requestStore = new CourseRequestStore(dataPath('runtime/course-requests'));
  const requests = new CourseRequests(requestStore);
  const knowledge = new KnowledgeStore(dataPath('runtime/knowledge'));
  configureKnowledge(knowledge);
  const responseSettingsStore = new ResponseSettingsStore(dataPath('runtime/bot-settings'));
  configureResponseSettings(responseSettingsStore);
  const responseSettings = new ResponseSettingsService(responseSettingsStore);
  const core = createCustomerCore({ timeoutMs: timeout, log, store, requests, humanSupport: identity =>
    identity.channel === 'line' && identity.scope === process.env.LINE_CHANNEL_ID + ':direct' ? { waiting: !!control.mode(JSON.stringify([process.env.LINE_CHANNEL_ID, identity.user])).waiting } : undefined });
  const monitor = new ConversationMonitor(dataPath('.line-monitor'));
  const monitorPort = Number(process.env.MONITOR_PORT || '3001');
  if (!cloud && (!Number.isInteger(monitorPort) || monitorPort < 1 || monitorPort > 65535 || monitorPort === port)) throw new Error('Invalid monitor port');
  const customerStore = new CustomerStore(dataPath('runtime/customers'));
  const profiles = new LineProfiles(customerStore, process.env.LINE_CHANNEL_ID || '', token);
  const control = new ConversationControl(dataPath('runtime/conversations'));
  const resume = (user: string, source: () => HandoverTranscript) => core.client({ channel: 'line', scope: process.env.LINE_CHANNEL_ID + ':direct', user }).resumeFromHandover!(source);
  const conversationService = { control, resume, account: process.env.LINE_CHANNEL_ID || '', allowedUsers, dryRun, push: linePush(token) };
  const groupStore = new LineGroupStore(dataPath('runtime/line-groups'), process.env.LINE_CHANNEL_ID || '');
  // Owner enabled web confirmation: each exact review must still be explicitly confirmed.
  const imageBase = await newsImageBase(port,process.env.PUBLIC_BASE_URL||'');
  const newsMedia = new NewsMediaStore(dataPath('runtime/news-images'),imageBase);
  const news = new NewsService(new NewsStore(dataPath('runtime/news')), customerStore, process.env.LINE_CHANNEL_ID || '', dryRun ? undefined : newsLineTransport(token), undefined, false, groupStore, newsMedia);
  const newsWorker = new NewsWorker(news, () => log({ event: 'news_worker_suspended', reason: 'storage_or_dispatch_error' }), lockRoot ? join(lockRoot, 'news') : undefined);
  const lineGroups = new LineGroupService(groupStore, token, fetch, () => Date.now(), { name: (process.env.SERVER_NAME || process.env.RAILWAY_SERVICE_NAME || 'ซีบอต').slice(0,100), environment: deployment.cloud ? 'cloud'+(process.env.RAILWAY_ENVIRONMENT_NAME ? ' · '+process.env.RAILWAY_ENVIRONMENT_NAME.slice(0,80) : '') : 'local' });
  const groupMemory = new MemoryStore(dataPath('runtime/line-group-memory'), undefined, lockRoot ? join(lockRoot, 'group') : undefined);
  const groupCore = new CustomerCore(undefined, timeout, log, undefined, groupMemory);
  const groupReplies = new LineGroupReplies(groupStore, groupCore, process.env.LINE_CHANNEL_ID || '', dryRun, lineReply(token), log);
  const pendingLineUsers = new PendingLineUsers(dataPath('runtime/line-pending-users'));
  const statusWork = new RequestWorkStore(dataPath('runtime/request-work'), requestStore);
  const systemStatus = new SystemStatusService({
    startedAt: Date.now() - Math.floor(process.uptime() * 1000), webhookPort: port, adminPort: cloud ? port : monitorPort,
    listeners: () => ({ webhook: server.listening, admin: cloud ? server.listening : monitorServer.listening }),
    token, channelConfigured: !!process.env.LINE_CHANNEL_ID, secretConfigured: !!secret, dryRun, publicBase: process.env.PUBLIC_BASE_URL || '', settings: responseSettings,
    stores: [
      { name: 'ความจำ LINE', check: () => store.readHealth() && groupMemory.readHealth() },
      { name: 'บทสนทนา', check: () => !monitor.readSnapshot().storageError && !control.snapshot().storageError },
      { name: 'ลูกค้า', check: () => { customerStore.snapshot({ events: [], requests: [] }, false); return true; } },
      { name: 'งานคำขอ', check: () => { statusWork.readSnapshot(); return true; } },
      { name: 'ข่าว', check: () => { news.store.list(); return true; } },
      { name: 'ตั้งค่าบอตและความรู้', check: () => responseSettingsStore.snapshot().healthy && knowledge.snapshot().healthy },
    ], worker: () => newsWorker.status(),
  });
  if (!cloud && loginConfig && new URL(loginConfig.redirectUri).port !== String(monitorPort)) throw new Error('Google callback port must match admin port');
  if (!loginConfig && existsSync(dataPath('runtime/staff/accounts.json'))) throw new Error('Google login config missing for existing staff registry');
  const staffAuth = loginConfig ? new StaffAuth(new StaffStore(dataPath('runtime/staff'), process.env.ADMIN_BOOTSTRAP_EMAIL || ''), loginConfig) : undefined;
  const admin = adminHandler(monitor, requestStore, customerStore, profiles, conversationService, news, knowledge, responseSettings, lineGroups, { store: pendingLineUsers, account: process.env.LINE_CHANNEL_ID || '', allowedUsers, access: lineAccess }, systemStatus, staffAuth);
  const monitorServer = createServer(admin);
  monitorServer.requestTimeout = 10000;
  monitorServer.headersTimeout = 10000;
  const adapter = new LineAdapter({ versionText: runningVersion(lineGroups.serverIdentity), secret, account: process.env.LINE_CHANNEL_ID || 'test-oa', allowedUsers, dryRun, core, control,
    observePendingUser: (account, userId) => pendingLineUsers.record(account, userId),
    groupReplies, observeGroup: event => groupStore.observe(event), observe: event => monitor.record(event), reply: lineReply(token), log });
  const webhook = webhookHandler(adapter), media = newsPublicMedia(news);
  const server = createServer(cloud ? cloudRouting({ webhook, media, admin, ready: () => !closing && newsWorker.status().running }) : (req,res)=>{if(req.url?.startsWith('/news-media/'))return media(req,res);return webhook(req,res)});
  let closing = false;
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.on('error', () => { console.error('เริ่ม webhook server ไม่สำเร็จ ตรวจ port และ host'); void stop(); process.exitCode = 1; });
  server.listen(port, host, () => {
    console.log(`ซีบอต webhook: http://${host}:${port}/webhook/line`);
    console.log(`LINE dry run: ${dryRun}; allowlist configured: ${allowedUsers.size > 0}; cloud mode: ${cloud}`);
    console.log('LINE persistent memory enabled; separate directory/lock from Terminal; retention 90 days');
    console.log('Direct LINE conversation routing: model-first; group routing unchanged');
  });
  monitorServer.on('error', () => { console.error('Monitor server unavailable'); void stop(); process.exitCode = 1; });
  if (!cloud) monitorServer.listen(monitorPort, '127.0.0.1', () => console.log(`ติดตามบทสนทนา: http://127.0.0.1:${monitorPort}`));
  const stop = async () => {
    if (closing) return;
    closing = true;
    adapter.close();
    server.close();
    monitorServer.close();
    monitorServer.closeAllConnections();
    try { await newsWorker.close(); await adapter.drain(); await core.dispose(); await groupCore.dispose(); }
    finally { store.close(); groupMemory.close(); server.closeAllConnections(); }
  };
  try { newsWorker.start(); } catch (error) { void stop(); throw error; }
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
}
void start().catch(()=>{console.error('Configuration หรือ storage ไม่พร้อม ตรวจ environment, volume และสิทธิ์ไฟล์');process.exitCode=1;});
