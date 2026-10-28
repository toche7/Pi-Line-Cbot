import type { AgentSession } from '@earendil-works/pi-coding-agent';
import type { SettingsBinding } from './response-settings.js';
export type ResponseSession = { binding:SettingsBinding; modelCalls:number; toolCalls:number; managedTurn:boolean };
const sessions=new WeakMap<AgentSession,ResponseSession>();
export function registerResponseSession(session:AgentSession,state:ResponseSession){sessions.set(session,state)}
export function responseSession(session:AgentSession){return sessions.get(session)}
export function beginResponseTurn(session:AgentSession){const s=sessions.get(session);if(s){s.modelCalls=0;s.toolCalls=0;s.managedTurn=true}}
export function endResponseTurn(session:AgentSession){const s=sessions.get(session);if(s)s.managedTurn=false}
