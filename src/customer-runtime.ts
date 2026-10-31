import { CustomerCore } from './core.js';

type CoreArguments = ConstructorParameters<typeof CustomerCore>;

// The ordinary Terminal and direct LINE entrypoints share the accepted dialogue mode.
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
} = {}) {
  return new CustomerCore(options.factory, options.timeoutMs, options.log, options.now, options.store,
    options.summarizer, options.requests, options.settings, options.humanSupport, 'model-first');
}
