import { createDemo } from './agent.js';
import { DemoFailure, requestTimeout } from './diagnostics.js';
import { runChat } from './chat.js';
import { CustomerCore } from './core.js';
import { MemoryStore } from './memory.js';
import { resolve } from 'node:path';
import { CourseRequestStore, CourseRequests } from './course-requests.js';

async function main() {
  const timeoutMs = requestTimeout(process.env.PI_TIMEOUT_MS);
  const { session, modelRuntime, provider, modelId } = await createDemo();
  try {
    console.log(`Model: ${provider}/${modelId}`);
    console.log(`Allowed tools: ${session.getActiveToolNames().join(', ')}`);
    console.log(`Request deadline: ${timeoutMs} ms`);
    if (process.argv.includes('--check')) {
      console.log(`Credentials configured: ${modelRuntime.hasConfiguredAuth(provider)}`);
      console.log('Session initialized; no model request made.');
      return;
    }
    const store = new MemoryStore(resolve('.customer-memory'));
    const requests = new CourseRequests(new CourseRequestStore(resolve('runtime/course-requests')));
    const core = new CustomerCore(async manager => (await createDemo({ sessionManager: manager })).session, timeoutMs, undefined, undefined, store, undefined, requests);
    try {
      const userIndex = process.argv.indexOf('--user');
      const user = userIndex >= 0 ? process.argv[userIndex + 1] || '' : 'tester';
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(user)) throw new DemoFailure('--user ต้องเป็นชื่อ local tester 1–64 ตัวอักษร a-z A-Z 0-9 _ -');
      const client = core.client({ channel: 'terminal', scope: 'local', user });
      if (process.argv.includes('--chat')) {
        await runChat(client, timeoutMs);
        return;
      }
      const args = process.argv.slice(2);
      const flagIndex = args.indexOf('--user');
      if (flagIndex >= 0) args.splice(flagIndex, 2);
      const prompt = args.join(' ') || 'สวัสดี';
      await client.send(prompt, {
        text: value => { process.stdout.write(value); },
        status: value => { process.stderr.write(`${value}\n`); },
      });
    } finally { await core.dispose(); store.close(); }
  } finally { session.dispose(); }
}

main().catch(error => {
  console.error(error instanceof DemoFailure
    ? error.message : 'Demo failed during initialization. Check local configuration.');
  process.exitCode = 1;
});
