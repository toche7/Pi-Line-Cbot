import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleStaffLogin, googleLoginConfig, googleIdentityClient, type GoogleIdentityClient } from './google-login.js';
import type { StaffPrincipal } from './staff-policy.js';
function fixture() {
  let now = 1000000, nonce = '', exchanges = 0;
  let account: StaffPrincipal | undefined = { subject: 'fixture-sub', email: 'fixture@example.test', role: 'admin', enabled: true, extras: [] };
  const client: GoogleIdentityClient = {
    authorizationUrl: (state, n, challenge) => { nonce = n; assert.match(challenge, /^[\w-]{43}$/); return 'https://accounts.google.com/?state=' + state; },
    exchange: async (_code, verifier) => { exchanges++; assert.match(verifier, /^[\w-]{43}$/); return { subject: 'fixture-sub', email: 'fixture@example.test', nonce, emailVerified: true }; },
  };
  const login = new GoogleStaffLogin(client, sub => account?.subject === sub ? account : undefined, () => now);
  const begin = () => { const flow = login.begin(); return { ...flow, state: new URL(flow.url).searchParams.get('state')! }; };
  return { login, client, begin, exchanges: () => exchanges, advance: (ms: number) => { now += ms; }, setAccount: (value: StaffPrincipal | undefined) => { account = value; } };
}
test('Google staff login binds state/browser, uses one-time flows and revocable expiring sessions without network', async () => {
  const f = fixture(), flow = f.begin();
  const result = await f.login.finish(flow.browser, flow.state, 'fixture-code');
  assert.equal(f.login.current(result.session)?.role, 'admin');
  await assert.rejects(f.login.finish(flow.browser, flow.state, 'fixture-code'));
  assert.equal(f.exchanges(), 1);
  f.setAccount({ ...result.principal, role: 'staff' });
  assert.equal(f.login.current(result.session)?.role, 'staff');
  f.setAccount({ ...result.principal, enabled: false });
  assert.equal(f.login.current(result.session), undefined);
  f.setAccount(result.principal);
  assert.equal(f.login.current(result.session), undefined);
  const next = f.begin(), session = await f.login.finish(next.browser, next.state, 'second-code');
  f.advance(8 * 3600000);
  assert.equal(f.login.current(session.session), undefined);
});
test('Google login rejects state mismatch, expired flows, missing accounts and failed/unverified identity', async () => {
  const f = fixture();
  let flow = f.begin();
  await assert.rejects(f.login.finish(flow.browser, 'wrong', 'code'));
  await assert.rejects(f.login.finish(flow.browser, flow.state, 'code'));
  assert.equal(f.exchanges(), 0);
  flow = f.begin(); f.advance(5 * 60000);
  await assert.rejects(f.login.finish(flow.browser, flow.state, 'code'));
  f.setAccount(undefined); flow = f.begin();
  await assert.rejects(f.login.finish(flow.browser, flow.state, 'code'), /ยังไม่ได้รับสิทธิ์/);
  const deny = new GoogleStaffLogin({ authorizationUrl: s => 'https://example.test/?state=' + s,
    exchange: async () => ({ subject: 'test', email: 'test@example.test', nonce: 'wrong', emailVerified: false }) }, () => { throw Error('must not lookup'); });
  const d = deny.begin();
  await assert.rejects(deny.finish(d.browser, new URL(d.url).searchParams.get('state')!, 'code'), /ยืนยันบัญชี/);
});
test('logout and process restart invalidate sessions; browser cookies cannot forge Google identity', async () => {
  const f = fixture(), flow = f.begin(), result = await f.login.finish(flow.browser, flow.state, 'code');
  assert.equal(f.login.current('forged'), undefined);
  f.login.logout(result.session);
  assert.equal(f.login.current(result.session), undefined);
  assert.equal(fixture().login.current(result.session), undefined);
});
test('Google config fails closed on partial config and restricts callbacks to current local admin', () => {
  assert.equal(googleLoginConfig({}), undefined);
  assert.throws(() => googleLoginConfig({ GOOGLE_CLIENT_ID: 'fixture' }));
  const env = { GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-secret', GOOGLE_REDIRECT_URI: 'http://127.0.0.1:3001/auth/google/callback' };
  const config = googleLoginConfig(env)!;
  const url = new URL(googleIdentityClient(config).authorizationUrl('state', 'nonce', 'challenge'));
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('scope'), 'openid email profile');
  assert.equal(url.searchParams.get('nonce'), 'nonce');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.has('client_secret'), false);
  for (const value of ['https://evil.example/auth/google/callback', env.GOOGLE_REDIRECT_URI + '?next=evil', 'http://127.0.0.1:3000/auth/google/callback']) {
    assert.throws(() => googleLoginConfig({ ...env, GOOGLE_REDIRECT_URI: value }));
  }
});
