// Process-local metadata only. No prompts, identities, replies, keys or raw errors.
export type ModelConnection = { at: string; elapsedMs: number; category: string | null };
const recent = new Map<string, ModelConnection>();
export function recordModelConnection(provider: string, model: string, elapsedMs: number, category: string | null) {
  const key = JSON.stringify([provider, model]);
  recent.delete(key);
  recent.set(key, { at: new Date().toISOString(), elapsedMs, category });
  if (recent.size > 40) recent.delete(recent.keys().next().value!);
}
export function modelConnection(provider: string, model: string) { return recent.get(JSON.stringify([provider, model])) ?? null; }
