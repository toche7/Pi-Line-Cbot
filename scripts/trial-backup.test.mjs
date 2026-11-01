import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backup, restore } from './trial-backup.mjs';

test('offline backup restores exact inventory and bytes into a separate new root', () => {
  const root = mkdtempSync(join(tmpdir(), 'trial-backup-'));
  try {
    const source = join(root, 'data'), archive = join(root, 'backup'), target = join(root, 'restore');
    mkdirSync(join(source, 'runtime/news-images'), { recursive: true });
    writeFileSync(join(source, 'cloud-channel.json'), '{"version":1,"channel":"trial"}\n');
    writeFileSync(join(source, 'runtime/news-images/image.jpg'), Buffer.from([0, 1, 255, 3]));
    assert.equal(backup(source, archive), 2); assert.equal(restore(archive, target), 2);
    assert.deepEqual(readFileSync(join(target, 'runtime/news-images/image.jpg')), readFileSync(join(source, 'runtime/news-images/image.jpg')));
    assert.throws(() => restore(archive, target), /must not exist/);
    writeFileSync(join(archive, 'files/cloud-channel.json'), 'tampered');
    assert.throws(() => restore(archive, join(root, 'bad')), /checksum/); assert.equal(existsSync(join(root, 'bad')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('backup rejects live locks, nested destinations, symlinks and manifest traversal', () => {
  const root = mkdtempSync(join(tmpdir(), 'trial-unsafe-'));
  try {
    const source = join(root, 'data'); mkdirSync(source); writeFileSync(join(source, 'cloud-channel.json'), '{}');
    assert.throws(() => backup(source, join(source, 'backup')), /outside/);
    writeFileSync(join(source, '.write-lock'), ''); assert.throws(() => backup(source, join(root, 'locked')), /lock/); rmSync(join(source, '.write-lock'));
    symlinkSync('/etc/passwd', join(source, 'link')); assert.throws(() => backup(source, join(root, 'linked')), /symbolic/); rmSync(join(source, 'link'));
    const archive = join(root, 'backup'); backup(source, archive);
    writeFileSync(join(archive, 'manifest.json'), JSON.stringify({ version: 1, files: [{ path: '../escape', bytes: 0, sha256: '' }] }));
    assert.throws(() => restore(archive, join(root, 'escape')), /Unsafe/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
