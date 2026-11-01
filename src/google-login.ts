import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { createHash, randomBytes } from 'node:crypto';
import type { StaffPrincipal } from './staff-policy.js';
import { publicOrigin } from './deployment.js';

export type GoogleLoginConfig = { clientId: string; clientSecret: string; redirectUri: string };
export function googleLoginConfig(env: NodeJS.ProcessEnv): GoogleLoginConfig | undefined {
  const values = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI];
  if (values.every(v => !v)) return undefined;
  if (values.some(v => !v?.trim())) throw Error('Google login configuration is incomplete');
  const [clientId, clientSecret, redirectUri] = values as string[];
  const url = new URL(redirectUri);
  const origin = env.DEPLOYMENT_MODE === 'cloud' ? publicOrigin(env.PUBLIC_BASE_URL || '') : 'http://127.0.0.1:3001';
  if (url.origin !== origin || url.pathname !== '/auth/google/callback'
    || url.username || url.password || url.search || url.hash) throw Error('Unsupported admin callback');
  return { clientId, clientSecret, redirectUri };
}
type VerifiedIdentity = { subject: string; email: string; nonce: string; emailVerified: boolean };
export interface GoogleIdentityClient {
  authorizationUrl(state: string, nonce: string, challenge: string): string;
  exchange(code: string, verifier: string): Promise<VerifiedIdentity>;
}
export function googleIdentityClient(config: GoogleLoginConfig): GoogleIdentityClient {
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  return {
    authorizationUrl: (state, nonce, challenge) => client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'], state, nonce, prompt: 'select_account',
      code_challenge: challenge, code_challenge_method: CodeChallengeMethod.S256,
    }),
    exchange: async (code, codeVerifier) => {
      const { tokens } = await client.getToken({ code, codeVerifier, redirect_uri: config.redirectUri });
      if (!tokens.id_token) throw Error('Missing Google identity');
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email || typeof p.nonce !== 'string') throw Error('Invalid Google identity');
      return { subject: p.sub, email: p.email, nonce: p.nonce, emailVerified: p.email_verified === true };
    },
  };
}
export class GoogleLoginError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
const random = () => randomBytes(32).toString('base64url');
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
type Flow = { state: string; nonce: string; verifier: string; until: number };
type Session = { subject: string; until: number };
/** Not wired into HTTP yet. Session identity is always re-resolved from trusted storage. */
export class GoogleStaffLogin {
  private flows = new Map<string, Flow>();
  private sessions = new Map<string, Session>();
  constructor(private client: GoogleIdentityClient,
    private lookup: (subject: string, verifiedEmail?: string) => StaffPrincipal | undefined,
    private now = () => Date.now()) {}
  private prune() {
    for (const [key, value] of this.flows) if (value.until <= this.now()) this.flows.delete(key);
    for (const [key, value] of this.sessions) if (value.until <= this.now()) this.sessions.delete(key);
  }
  begin() {
    this.prune();
    if (this.flows.size >= 100) throw new GoogleLoginError(429, 'มีคำขอเข้าสู่ระบบมากเกินไป');
    const browser = random(), state = random(), nonce = random(), verifier = random();
    this.flows.set(digest(browser), { state, nonce, verifier, until: this.now() + 5 * 60000 });
    return { browser, url: this.client.authorizationUrl(state, nonce, createHash('sha256').update(verifier).digest('base64url')) };
  }
  async finish(browser: string, state: string, code: string) {
    this.prune();
    const key = digest(browser), flow = this.flows.get(key);
    this.flows.delete(key); // One attempt, including denied/failed exchanges.
    if (!flow || !state || flow.state !== state || !code || code.length > 8192) throw new GoogleLoginError(403, 'คำขอเข้าสู่ระบบหมดอายุหรือไม่ตรงกับเบราว์เซอร์');
    let identity: VerifiedIdentity;
    try { identity = await this.client.exchange(code, flow.verifier); }
    catch { throw new GoogleLoginError(403, 'ยืนยันบัญชี Google ไม่สำเร็จ'); }
    if (!identity.emailVerified || identity.nonce !== flow.nonce) throw new GoogleLoginError(403, 'ยืนยันบัญชี Google ไม่สำเร็จ');
    const principal = this.lookup(identity.subject, identity.email);
    if (!principal?.enabled || principal.subject !== identity.subject) throw new GoogleLoginError(403, 'บัญชีนี้ยังไม่ได้รับสิทธิ์เจ้าหน้าที่');
    this.prune();
    if (this.sessions.size >= 1000) throw new GoogleLoginError(503, 'จำนวน session เต็ม กรุณาลองใหม่');
    const session = random();
    this.sessions.set(digest(session), { subject: principal.subject, until: this.now() + 8 * 3600000 });
    return { session, principal };
  }
  current(session: string): StaffPrincipal | undefined {
    this.prune();
    const stored = this.sessions.get(digest(session));
    if (!stored) return;
    const principal = this.lookup(stored.subject);
    if (!principal?.enabled || principal.subject !== stored.subject) { this.sessions.delete(digest(session)); return; }
    return principal;
  }
  logout(session: string) { this.sessions.delete(digest(session)); }
}
