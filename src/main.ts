import { createDemo } from './agent.js';
import { DemoFailure, requestTimeout } from './diagnostics.js';
import { runChat } from './chat.js';
import { CustomerCore } from './core.js';

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
    let initialSessionAvailable = true;
    const core = new CustomerCore(async () => {
      if (initialSessionAvailable) { initialSessionAvailable = false; return session; }
      return (await createDemo()).session;
    }, timeoutMs);
    const client = core.client({ channel: 'terminal', scope: 'local', user: 'tester' });
    try {
      if (process.argv.includes('--chat')) {
        await runChat(client, timeoutMs);
        return;
      }
      const prompt = process.argv.slice(2).join(' ') || 'สวัสดี';
      await client.send(prompt, {
        text: value => { process.stdout.write(value); },
        status: value => { process.stderr.write(`${value}\n`); },
      });
    } finally { await core.dispose(); }
  } finally { session.dispose(); }
}

main().catch(error => {
  console.error(error instanceof DemoFailure
    ? error.message : 'Demo failed during initialization. Check local configuration.');
  process.exitCode = 1;
});
