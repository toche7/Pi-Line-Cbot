import { CustomerCore } from './core.js';

type CoreArguments = ConstructorParameters<typeof CustomerCore>;

// Terminal, direct LINE and group LINE use the accepted grounded dialogue by default.
// Storage, identity, settings and external transports remain owned by each entrypoint.
export function createCustomerCore(options: {
  factory?: CoreArguments[0];
  timeoutMs?: CoreArguments[1];
  log?: CoreArguments[2];
  now?: CoreArguments[3];
  store?: CoreArguments[4];
  summarizer?: CoreArguments[5];
  requests?: CoreArguments[6];
  settings?: CoreArguments[7];
  humanSupport?: CoreArguments[8];
  // Explicit false retains the previous mode for rollback/comparison tests.
  experimentalGrounding?: boolean;
  privateChatCapabilities?: CoreArguments[10];
} = {}) {
  return new CustomerCore(options.factory, options.timeoutMs, options.log, options.now, options.store,
    options.summarizer, options.requests, options.settings, options.humanSupport, options.experimentalGrounding === false ? 'model-first' : 'grounded', options.privateChatCapabilities);
}
