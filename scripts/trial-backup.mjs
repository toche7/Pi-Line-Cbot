import { mkdirSync, readdirSync, lstatSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, sep, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const transient = name => ['.lock', '.worker-lock', '.write-lock', '.upload-lock'].includes(name) || name.endsWith('.lock') || name.endsWith('.tmp');
function files(root, prefix = '') {
  const directory = lstatSync(resolve(root, prefix));
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw Error('Backup refuses symbolic links or non-directories');
  const out = [];
  for (const name of readdirSync(resolve(root, prefix)).sort()) {
    const path = prefix ? prefix + '/' + name : name;
    const stat = lstatSync(resolve(root, path));
    if (stat.isSymbolicLink()) throw Error('Backup refuses symbolic links');
    if (transient(name)) throw Error('Source contains lock/temp files; stop writers and inspect recovery before backup');
    if (stat.isDirectory()) out.push(...files(root, path));
    else if (stat.isFile()) out.push(path);
    else throw Error('Unsupported backup entry');
  }
  return out;
}
function separate(source, target) {
  const rel = relative(source, target);
  if (!rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep))) throw Error('Destination must be outside source');
  if (existsSync(target)) throw Error('Destination must not exist');
}
function safePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Unsafe manifest path');
  return path;
}
export function backup(source, target) {
  source = resolve(source); target = resolve(target); separate(source, target);
  const paths = files(source);
  if (!paths.includes('cloud-channel.json')) throw Error('Backup requires a cloud trial data root');
  const manifest = { version: 1, createdAt: new Date().toISOString(), files: [] };
  mkdirSync(resolve(target, 'files'), { recursive: true, mode: 0o700 });
  for (const path of paths) {
    const bytes = readFileSync(resolve(source, path));
    const dest = resolve(target, 'files', path);
    mkdirSync(dirname(dest), { recursive: true, mode: 0o700 });
    writeFileSync(dest, bytes, { flag: 'wx', mode: 0o600 });
    manifest.files.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  writeFileSync(resolve(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return manifest.files.length;
}
export function restore(source, target) {
  source = resolve(source); target = resolve(target); separate(source, target);
  if (lstatSync(resolve(source, 'manifest.json')).isSymbolicLink()) throw Error('Backup refuses symbolic links');
  const manifest = JSON.parse(readFileSync(resolve(source, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw Error('Invalid backup manifest');
  const actual = files(resolve(source, 'files'));
  const expected = manifest.files.map(f => safePath(f.path));
  if (new Set(expected).size !== expected.length || JSON.stringify([...expected].sort()) !== JSON.stringify(actual.sort()) || !expected.includes('cloud-channel.json')) throw Error('Backup file inventory differs');
  // Verify everything before creating a restore destination.
  const verified = manifest.files.map(f => {
    const bytes = readFileSync(resolve(source, 'files', f.path));
    if (bytes.length !== f.bytes || hash(bytes) !== f.sha256) throw Error('Backup checksum mismatch');
    return { path: f.path, bytes };
  });
  mkdirSync(target, { recursive: true, mode: 0o700 });
  for (const { path, bytes } of verified) {
    const dest = resolve(target, path); mkdirSync(dirname(dest), { recursive: true, mode: 0o700 });
    writeFileSync(dest, bytes, { flag: 'wx', mode: 0o600 });
  }
  return verified.length;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [action, source, target, offline] = process.argv.slice(2);
    if (!['backup', 'restore'].includes(action) || !source || !target || offline !== '--offline' || process.argv.length !== 6) throw Error('Usage: node scripts/trial-backup.mjs backup|restore SOURCE NEW_DEST --offline (all writers must be stopped)');
    console.log(`${action}: ${(action === 'backup' ? backup : restore)(source, target)} files verified/copied`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
