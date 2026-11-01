// Inspect a restored offline copy only. No NewsWorker/LINE transport is created.
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { StaffStore } from '../dist/staff-store.js';
import { KnowledgeStore } from '../dist/knowledge-store.js';
import { ResponseSettingsStore } from '../dist/response-settings.js';
import { NewsStore } from '../dist/news.js';
import { CustomerStore } from '../dist/customers.js';
import { CourseRequestStore } from '../dist/course-requests.js';
import { ConversationMonitor } from '../dist/monitor.js';
import { MemoryStore } from '../dist/memory.js';
const [input] = process.argv.slice(2);
if (!input || process.argv.length !== 3) throw Error('Usage: node scripts/verify-trial-restore.mjs RESTORED_OFFLINE_ROOT');
const root = resolve(input);
for (const file of ['cloud-channel.json', 'runtime/staff/accounts.json']) if (!existsSync(join(root, file))) throw Error('Restored cloud/staff identity missing');
// Constructor requires a syntactically valid bootstrap address even for an
// existing registry; this fixture cannot change an existing staff registry.
const staff = new StaffStore(join(root, 'runtime/staff'), 'restore-fixture@example.invalid').snapshot();
const admins = staff.accounts.filter(a => a.enabled && a.role === 'admin');
if (!admins.length) throw Error('Restored staff registry has no enabled admin');
const knowledge = new KnowledgeStore(join(root, 'runtime/knowledge')).snapshot();
const settings = new ResponseSettingsStore(join(root, 'runtime/bot-settings')).snapshot();
const news = new NewsStore(join(root, 'runtime/news')).list();
const requests = new CourseRequestStore(join(root, 'runtime/course-requests')).list();
const monitor = new ConversationMonitor(join(root, '.line-monitor')).snapshot();
const customers = new CustomerStore(join(root, 'runtime/customers')).snapshot({ events: monitor.events, requests });
const direct = new MemoryStore(join(root, '.line-memory'));
const groups = new MemoryStore(join(root, 'runtime/line-group-memory'));
try {
  const memoryHealthy = direct.readHealth() && groups.readHealth();
  if (!knowledge.healthy || !settings.healthy || !memoryHealthy) throw Error('Restored data health check failed');
  console.log(JSON.stringify({ enabledAdmins: admins.length, staffAccounts: staff.accounts.length, knowledgeHealthy: knowledge.healthy, settingsHealthy: settings.healthy, memoryHealthy, customers: customers.customers.length, requests: requests.length, monitorEvents: monitor.events.length, newsCampaigns: news.length, queuedCampaigns: news.filter(c => c.status === 'queued').length, inflightDeliveries: news.flatMap(c => c.deliveries).filter(d => d.status === 'inflight').length, lineTransportCreated: false }, null, 2));
} finally { direct.close(); groups.close(); }
