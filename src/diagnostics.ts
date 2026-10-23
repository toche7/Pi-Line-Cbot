// Return fixed messages only. Never echo raw provider errors, headers or credentials.
export class DemoFailure extends Error {}
export function describeFailure(raw: string, timedOut: boolean, timeoutMs: number): string {
  if (timedOut) return `Model request timed out after ${timeoutMs} ms.`;
  if (/call budget/i.test(raw)) return 'Model/tool call budget reached.';
  if (/Unexpected message role/i.test(raw)) return 'Model request rejected (HTTP 400): incompatible message role.';
  if (/\b401\b|invalid.api.key|unauthorized/i.test(raw)) return 'Model authentication failed (HTTP 401). Check the new API key locally.';
  if (/\b403\b/.test(raw)) return 'Model access denied (HTTP 403). Check account permissions.';
  if (/\b429\b|rate.limit/i.test(raw)) return 'Model rate limit reached (HTTP 429). Retry later.';
  if (/\b404\b|decommissioned|model.not.found/i.test(raw)) return 'Model unavailable. Check PI_MODEL and provider access.';
  if (/connection|fetch failed|ENOTFOUND|ECONN|certificate|network/i.test(raw)) return 'Model network connection failed. Check connectivity and TLS.';
  if (/timeout|timed out/i.test(raw)) return 'Model provider reported a timeout.';
  const status = raw.match(/\b[45][0-9]{2}\b/)?.[0];
  return status ? `Model request rejected (HTTP ${status}).` : 'Model request failed or was aborted; no raw provider error was logged.';
}

export function requestTimeout(value: string | undefined): number {
  if (value === undefined) return 45_000;
  const timeout = Number(value);
  if (!Number.isSafeInteger(timeout) || timeout < 1000 || timeout > 300_000) {
    throw new DemoFailure('Model request configuration: PI_TIMEOUT_MS must be an integer from 1000 to 300000.');
  }
  return timeout;
}
