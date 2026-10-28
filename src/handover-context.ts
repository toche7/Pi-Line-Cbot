import type { MonitorEvent } from './monitor.js';
import { safeText } from './memory.js';

export type HandoverMessage = { id: string; speaker: 'customer' | 'operator'; text: string; at: number };
export type HandoverTranscript = { id: string; at: number; messages: HandoverMessage[] };
export const handoverLimit = 24;
export function validHandover(value: unknown): value is HandoverTranscript {
  const v = value as HandoverTranscript;
  return !!v && typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 100 && Number.isFinite(v.at)
    && Array.isArray(v.messages) && v.messages.length <= handoverLimit && v.messages.every(m => m && typeof m.id === 'string'
      && m.id.length <= 200 && ['customer', 'operator'].includes(m.speaker) && typeof m.text === 'string' && m.text.length <= 800
      && safeText(m.text) === m.text && Number.isFinite(m.at));
}
export function handoverTranscript(account: string, user: string, epoch: number, since: string, events: MonitorEvent[],
  deliveries: { id: string; key: string; text: string; at: string; status: string }[], now = Date.now()): HandoverTranscript {
  const key = JSON.stringify([account, user]);
  const cutoff = Math.max(Date.parse(since), now - 90 * 86400000);
  const inWindow = (at: string) => Date.parse(at) >= cutoff && Date.parse(at) <= now;
  const messages: HandoverMessage[] = events.filter(e => e.account === account && e.userId === user && e.direction === 'in' && inWindow(e.at))
    .map(e => ({ id: 'in:' + e.id, speaker: 'customer', text: e.text, at: Date.parse(e.at) }));
  messages.push(...deliveries.filter(d => d.key === key && d.status === 'accepted' && inWindow(d.at))
    .map(d => ({ id: 'out:' + d.id, speaker: 'operator' as const, text: d.text, at: Date.parse(d.at) })));
  return { id: 'handover:' + epoch, at: now, messages: messages.sort((a,b) => a.at-b.at).slice(-handoverLimit)
    .map(m => ({ ...m, text: safeText(m.text).slice(0,800) })) };
}
