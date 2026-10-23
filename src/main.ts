import { createDemo } from './agent.js';
import { DemoFailure, requestTimeout } from './diagnostics.js';
import { runConversation } from './conversation.js';
import { runChat } from './chat.js';

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
    if (!modelRuntime.hasConfiguredAuth(provider)) {
      throw new DemoFailure('No credentials: set GROQ_API_KEY in .env.');
    }
    if (process.argv.includes('--chat')) {
      await runChat(session, timeoutMs);
      return;
    }
    const prompt = process.argv.slice(2).join(' ') || 'ช่วยตรวจสถานะออเดอร์ DEMO-1001 ให้หน่อย';
    await runConversation(session, prompt, timeoutMs, {
      text: value => { process.stdout.write(value); },
      status: value => { process.stderr.write(`${value}\n`); },
    });
  } finally { session.dispose(); }
}

main().catch(error => {
  console.error(error instanceof DemoFailure
    ? error.message : 'Demo failed during initialization. Check local configuration.');
  process.exitCode = 1;
});
