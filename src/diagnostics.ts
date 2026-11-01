// Return fixed messages only. Never echo raw provider errors, headers or credentials.
export class DemoFailure extends Error {}
// Categories are fixed metadata, never raw error text or customer content.
export function failureCategory(error: unknown): string {
  if (!(error instanceof DemoFailure)) return 'internal';
  const message = error.message;
  if (/Memory บันทึกไม่สำเร็จ/.test(message)) return 'memory_write';
  if (/429/.test(message)) return 'model_rate_limit';
  if (/timed out|timeout/i.test(message)) return 'model_timeout';
  if (/401|403/.test(message)) return 'model_auth';
  if (/network connection/.test(message)) return 'model_network';
  if (/รูปแบบ|no answer text|output token budget|JSON generation failed/.test(message)) return 'model_format';
  return 'core_failure';
}

export function lineFailureReply(error: unknown, faqWithoutModel = true): string {
  const help = faqWithoutModel
    ? 'ระหว่างนี้ยังถาม FAQ ได้ เช่น “สมัครสมาชิกอย่างไร” หรือดู https://cbtumu.net/faq/'
    : 'ดูข้อมูลเบื้องต้นได้ที่ https://cbtumu.net/faq/';
  if (failureCategory(error) === 'memory_write') return 'ยังบันทึกข้อมูลเพิ่มไม่สำเร็จครับ ข้อมูลเดิมยังอยู่ กรุณาลองใหม่ และตรวจสิ่งที่บันทึกด้วย /memory';
  if (failureCategory(error) === 'model_rate_limit') {
    return 'ขณะนี้โมเดลสนทนาถูกจำกัดโควตาชั่วคราว กรุณารอสักครู่แล้วลองใหม่ ' + help;
  }
  if (failureCategory(error) === 'model_timeout') return 'โมเดลใช้เวลาตอบนานเกินไป กรุณาลองใหม่ ' + help;
  if (failureCategory(error) === 'model_format') return 'โมเดลจัดรูปแบบคำตอบไม่สำเร็จ กรุณาส่งข้อความใหม่อีกครั้ง ' + help;
  return 'ขณะนี้ซีบอตยังตอบไม่ได้ กรุณาลองใหม่ภายหลัง หรือติดต่อเจ้าหน้าที่ผ่าน https://cbtumu.net/faq/';
}
// Experimental route: distinguish operational failure from genuinely missing
// knowledge without echoing raw model text or redirecting every failure to FAQ.
export function neutralFailureReply(error: unknown): string {
  if (error instanceof DemoFailure) {
    if (/ตรวจรูปแบบหรือหลักฐาน/.test(error.message)) return 'โมเดลส่งคำตอบมาแล้ว แต่ยังตรวจรูปแบบหรือหลักฐานไม่ผ่านครับ กรุณาลองถามใหม่';
    if (/จำนวนครั้งเรียกโมเดล|call budget/i.test(error.message)) return 'รอบนี้ใช้จำนวนครั้งเรียกโมเดลครบแล้วครับ ยังตอบให้สำเร็จไม่ได้ กรุณาลองใหม่';
    if (/หมดเวลา|timed out|timeout/i.test(error.message)) return 'รอบนี้โมเดลใช้เวลาตอบเกินกำหนดครับ กรุณาลองใหม่';
    const category = failureCategory(error);
    if (category === 'model_rate_limit') return 'โมเดลถูกจำกัดโควตาชั่วคราวครับ กรุณารอสักครู่แล้วลองใหม่';
    if (category === 'model_auth') return 'ขณะนี้เชื่อมต่อโมเดลไม่ได้เนื่องจากสิทธิ์การใช้งานครับ กรุณาให้ผู้ดูแลตรวจการตั้งค่า';
    if (category === 'model_network') return 'ขณะนี้เชื่อมต่อโมเดลไม่ได้ครับ กรุณาลองใหม่ภายหลัง';
    if (category === 'model_format') return 'โมเดลส่งรูปแบบคำตอบไม่สมบูรณ์ครับ กรุณาลองใหม่';
    if (category === 'memory_write') return 'ยังบันทึกข้อมูลเพิ่มไม่สำเร็จครับ ข้อมูลเดิมยังอยู่ กรุณาลองใหม่';
  }
  return 'ขณะนี้ตอบไม่ได้ กรุณาลองใหม่อีกครั้งครับ';
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
