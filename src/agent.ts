import { resolve } from 'node:path';
import { Type } from '@sinclair/typebox';
import { InMemoryCredentialStore } from '@earendil-works/pi-ai';
import { cbtuPolicy, knowledgeTool } from './knowledge.js';
import { DemoFailure } from './diagnostics.js';
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

export async function createDemo(options: { sessionManager?: SessionManager } = {}) {
  const provider = process.env.PI_PROVIDER || 'groq';
  const modelId = process.env.PI_MODEL || 'qwen/qwen3.8-27b';
  const credentials = new InMemoryCredentialStore();
  // Use provider environment credentials only; never discover old Pi auth files.
  const modelRuntime = await ModelRuntime.create({
    credentials, modelsPath: null, allowModelNetwork: false,
    modelsStorePath: resolve('.pi-runtime/models.json'),
  });
  const stream = modelRuntime.streamSimple.bind(modelRuntime);
  let modelCalls = 0;
  let toolCalls = 0;
  modelRuntime.streamSimple = (model, context, options) => {
    if (++modelCalls > 4) throw new DemoFailure('Model call budget reached.');
    return stream(model, context, { ...options, maxTokens: 800, maxRetries: 0, timeoutMs: 30_000 });
  };
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
    getSystemPrompt: () => cbtuPolicy,
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: () => {}, reload: async () => {},
  };
  const { session } = await createAgentSession({
    cwd: process.cwd(), agentDir: resolve('.pi-runtime'), modelRuntime, model,
    thinkingLevel: 'off', resourceLoader,
    tools: ['lookup_demo_order', 'search_public_knowledge'], customTools: [orderTool, knowledgeTool],
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } }),
    sessionManager: options.sessionManager ?? SessionManager.inMemory(),
  });
  session.subscribe(event => { if (event.type === 'agent_start') { modelCalls = 0; toolCalls = 0; } });
  const beforeToolCall = session.agent.beforeToolCall;
  session.agent.beforeToolCall = async (context, signal) => {
    if (++toolCalls > 4) return { block: true, terminate: true, reason: 'Tool call budget reached.' };
    return beforeToolCall?.(context, signal);
  };
  return { session, modelRuntime, provider, modelId };
}
