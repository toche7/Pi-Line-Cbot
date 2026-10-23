import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Type } from '@sinclair/typebox';
import { InMemoryCredentialStore } from '@earendil-works/pi-ai';
import {
  createAgentSession, createExtensionRuntime, ModelRuntime,
  SessionManager, SettingsManager, type ResourceLoader,
} from '@earendil-works/pi-coding-agent';

export const orderTool = {
  name: 'lookup_demo_order',
  label: 'Demo order lookup',
  description: 'Look up a fictional order. Only DEMO-1001 exists. No real customer data.',
  parameters: Type.Object({ orderId: Type.String() }),
  async execute(_id: string, params: { orderId: string }) {
    const details = params.orderId === 'DEMO-1001'
      ? { found: true, orderId: params.orderId, status: 'shipped', tracking: 'DEMO-TRACK-001' }
      : { found: false, orderId: params.orderId };
    return { content: [{ type: 'text' as const, text: JSON.stringify(details) }], details };
  },
};

export async function createDemo() {
  const provider = process.env.PI_PROVIDER || 'groq';
  const modelId = process.env.PI_MODEL || 'llama-3.3-70b-versatile';
  const credentials = new InMemoryCredentialStore();
  // Optional read-only import of a static API key; never execute key commands or refresh OAuth.
  if (process.env.PI_AUTH_FILE) {
    const saved = JSON.parse(await readFile(process.env.PI_AUTH_FILE, 'utf8'));
    const entry = saved[provider];
    if (entry?.type === 'api_key' && typeof entry.key === 'string' && !entry.key.startsWith('!')) {
      await credentials.modify(provider, async () => ({ type: 'api_key', key: entry.key }));
    }
  }
  const modelRuntime = await ModelRuntime.create({
    credentials, modelsPath: null, allowModelNetwork: false,
    modelsStorePath: resolve('.pi-runtime/models.json'),
  });
  const catalogModel = modelRuntime.getModel(provider, modelId);
  if (!catalogModel) throw new Error('Model unavailable in SDK catalog; set PI_PROVIDER and PI_MODEL.');
  // Groq's Qwen template rejects the OpenAI developer role inferred for reasoning models.
  const model = provider === 'groq' && modelId.startsWith('qwen/')
    ? { ...catalogModel, compat: { ...catalogModel.compat, supportsDeveloperRole: false } }
    : catalogModel;
  const resourceLoader: ResourceLoader = {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => 'You are a concise Thai customer support demo. All data is fictional. Use lookup_demo_order for order questions. Never invent order status. Do not claim to send messages or change orders.',
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: () => {}, reload: async () => {},
  };
  const { session } = await createAgentSession({
    cwd: process.cwd(), agentDir: resolve('.pi-runtime'), modelRuntime, model,
    thinkingLevel: 'off', resourceLoader,
    tools: ['lookup_demo_order'], customTools: [orderTool],
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } }),
    sessionManager: SessionManager.inMemory(),
  });
  return { session, modelRuntime, provider, modelId };
}
