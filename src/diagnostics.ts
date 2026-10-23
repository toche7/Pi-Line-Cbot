// Return fixed messages only. Never echo raw provider errors, headers or credentials.
export class DemoFailure extends Error {}
// Categories are fixed metadata, never raw error text or customer content.
export function failureCategory(error: unknown): string {
  if (!(error instanceof DemoFailure)) return 'internal';
  const message = error.message;
  if (/429/.test(message)) return 'model_rate_limit';
  if (/timed out|timeout/i.test(message)) return 'model_timeout';
  if (/401|403/.test(message)) return 'model_auth';
  if (/network connection/.test(message)) return 'model_network';
  if (/รูปแบบ|no answer text|output token budget|JSON generation failed/.test(message)) return 'model_format';
  return 'core_failure';
}

export function lineFailureReply(error: unknown): string {
  if (failureCategory(error) === 'model_rate_limit') {
    return 'ขณะนี้โมเดลสนทนาถูกจำกัดโควตาชั่วคราว กรุณารอสักครู่แล้วลองใหม่ ระหว่างนี้ยังถาม FAQ ได้ เช่น “สมัครสมาชิกอย่างไร” หรือดู https://cbtumu.net/faq/';
  }
  if (failureCategory(error) === 'model_timeout') return 'โมเดลใช้เวลาตอบนานเกินไป กรุณาลองใหม่ ระหว่างนี้ยังถาม FAQ ได้ เช่น “สมัครสมาชิกอย่างไร” หรือดู https://cbtumu.net/faq/';
  if (failureCategory(error) === 'model_format') return 'โมเดลจัดรูปแบบคำตอบไม่สำเร็จ กรุณาส่งข้อความใหม่อีกครั้ง ระหว่างนี้ยังถาม FAQ ได้ เช่น “สมัครสมาชิกอย่างไร” หรือดู https://cbtumu.net/faq/';
  return 'ขณะนี้ซีบอตยังตอบไม่ได้ กรุณาลองใหม่ภายหลัง หรือติดต่อเจ้าหน้าที่ผ่าน https://cbtumu.net/faq/';
}
export function rateLimitWaitMs(raw: string): number {
  const wait = raw.match(/try again in\s*(?:(\d+)m)?\s*(\d+(?:\.\d+)?)s/i);
  return wait ? Math.max(1000, Math.min(120000, Math.ceil((Number(wait[1] || 0) * 60 + Number(wait[2])) * 1000))) : 10000;
}
export function describeFailure(raw: string, timedOut: boolean, timeoutMs: number): string {
  if (timedOut) return `Model request timed out after ${timeoutMs} ms.`;
  if (/call budget/i.test(raw)) return 'Model/tool call budget reached.';
  if (/Unexpected message role/i.test(raw)) return 'Model request rejected (HTTP 400): incompatible message role.';
  if (/\b401\b|invalid.api.key|unauthorized/i.test(raw)) return 'Model authentication failed (HTTP 401). Check the new API key locally.';
  if (/\b403\b/.test(raw)) return 'Model access denied (HTTP 403). Check account permissions.';
  if (/\b429\b|rate.limit/i.test(raw)) return 'Model rate limit reached (HTTP 429). Retry later.';
  if (/json_validate_failed|failed to generate json/i.test(raw)) return 'Model JSON generation failed.';
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
