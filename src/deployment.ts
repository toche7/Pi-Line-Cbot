import { isAbsolute, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export function publicOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('PUBLIC_BASE_URL must be an HTTPS origin');
  return url.origin;
}

export function deploymentConfig(env: NodeJS.ProcessEnv) {
  if (env.DEPLOYMENT_MODE && !['local', 'cloud'].includes(env.DEPLOYMENT_MODE)) throw Error('Invalid deployment mode');
  const cloud = env.DEPLOYMENT_MODE === 'cloud';
  if (env.RAILWAY_ENVIRONMENT_ID && !cloud) throw Error('Railway requires explicit cloud mode');
  if (cloud && (!env.DATA_ROOT || !isAbsolute(env.DATA_ROOT))) throw Error('Cloud requires an absolute DATA_ROOT');
  if (cloud && env.RAILWAY_ENVIRONMENT_ID && resolve(env.DATA_ROOT!) !== resolve(env.RAILWAY_VOLUME_MOUNT_PATH || '/__missing_volume__')) throw Error('DATA_ROOT must match Railway volume mount');
  const origin = cloud ? publicOrigin(env.PUBLIC_BASE_URL || '') : '';
  const dataPath = (path: string) => resolve(env.DATA_ROOT || '.', path);
  return { cloud, origin, dataPath, host: cloud ? '0.0.0.0' : env.HOST || '127.0.0.1' };
}

// Bind a fresh cloud volume to exactly one LINE channel. Never import a local
// runtime tree to bypass this check; selected public knowledge is a separate step.
export function bindCloudChannel(root: string, channel: string) {
  if (!channel) throw Error('Missing cloud LINE channel');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const file = resolve(root, 'cloud-channel.json');
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    if (saved.version !== 1 || saved.channel !== channel) throw Error('Cloud volume belongs to another LINE channel');
  } else {
    // Refuse legacy operational data, including queued sends and staff grants.
    for (const path of ['runtime', '.line-memory', '.line-monitor']) if (existsSync(resolve(root, path))) throw Error('Cloud volume must start with fresh operational data');
    writeFileSync(file, JSON.stringify({ version: 1, channel }) + '\n', { flag: 'wx', mode: 0o600 });
  }
}
