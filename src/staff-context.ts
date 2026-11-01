import { AsyncLocalStorage } from 'node:async_hooks';
import type { StaffPrincipal } from './staff-policy.js';
const context = new AsyncLocalStorage<StaffPrincipal>();
export const staffIdentity = () => context.getStore();
export function currentStaffActor(fallback: string) { const p = context.getStore(); return p ? 'staff:' + p.subject : fallback; }
export function validStoredActor(value: unknown, legacy: string) { return value === legacy || typeof value === 'string' && /^staff:[\w-]{1,100}$/.test(value); }
export function runAsStaff<T>(principal: StaffPrincipal, fn: () => T) { return context.run(principal, fn); }
