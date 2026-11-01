import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { deploymentConfig, bindCloudChannel } from './deployment.js';
import { googleLoginConfig } from './google-login.js';

test('cloud requires explicit mode, mounted data root and exact HTTPS Google origin; local paths remain unchanged', () => {
  assert.equal(deploymentConfig({}).dataPath('runtime/news'), resolve('runtime/news'));
  assert.equal(deploymentConfig({}).host, '127.0.0.1');
  const env = { DEPLOYMENT_MODE: 'cloud', DATA_ROOT: '/trial', PUBLIC_BASE_URL: 'https://trial.example', GOOGLE_CLIENT_ID: 'fixture', GOOGLE_CLIENT_SECRET: 'fixture', GOOGLE_REDIRECT_URI: 'https://trial.example/auth/google/callback' };
  const config = deploymentConfig(env);
  assert.equal(config.host, '0.0.0.0'); assert.equal(config.dataPath('.line-memory'), '/trial/.line-memory');
  assert.ok(googleLoginConfig(env));
  assert.throws(() => deploymentConfig({ RAILWAY_ENVIRONMENT_ID: 'fixture' }));
  assert.throws(() => deploymentConfig({ ...env, DATA_ROOT: 'relative' }));
  assert.throws(() => deploymentConfig({ ...env, RAILWAY_ENVIRONMENT_ID: 'fixture' }));
  assert.doesNotThrow(() => deploymentConfig({ ...env, RAILWAY_ENVIRONMENT_ID: 'fixture', RAILWAY_VOLUME_MOUNT_PATH: '/trial' }));
  for (const origin of ['http://trial.example', 'https://trial.example/path', 'https://user:password@trial.example', 'https://trial.example/?next=evil']) assert.throws(() => deploymentConfig({ ...env, PUBLIC_BASE_URL: origin }));
  for (const callback of ['http://trial.example/auth/google/callback', 'https://other.example/auth/google/callback', env.GOOGLE_REDIRECT_URI + '?next=evil']) assert.throws(() => googleLoginConfig({ ...env, GOOGLE_REDIRECT_URI: callback }));
});
test('cloud volume starts fresh and persists a channel binding across restart', () => {
  const root = mkdtempSync(join(tmpdir(), 'trial-bind-'));
  try {
    bindCloudChannel(root, 'new-trial-channel');
    mkdirSync(join(root, 'runtime'));
    bindCloudChannel(root, 'new-trial-channel');
    assert.equal(JSON.parse(readFileSync(join(root, 'cloud-channel.json'), 'utf8')).channel, 'new-trial-channel');
    assert.throws(() => bindCloudChannel(root, 'old-local-channel'));
    const legacy = join(root, 'legacy'); mkdirSync(join(legacy, '.line-memory'), { recursive: true });
    assert.throws(() => bindCloudChannel(legacy, 'new-trial-channel'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
