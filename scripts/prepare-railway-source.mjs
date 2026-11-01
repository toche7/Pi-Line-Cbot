import { copyFileSync, mkdirSync, readdirSync, lstatSync, existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const requested = process.argv[2];
if (process.argv.length > 3) throw Error('Usage: node scripts/prepare-railway-source.mjs [NEW_DEST]');
if (requested && existsSync(resolve(requested))) throw Error('Destination must not exist');
const destination = requested ? resolve(requested) : mkdtempSync(join(tmpdir(), 'cbot-railway-source-'));
mkdirSync(destination, { recursive: true, mode: 0o700 });
const copy = path => {
  const source = join(project, path);
  const stat = lstatSync(source);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Source must be a regular file');
  copyFileSync(source, join(destination, path));
};
for (const path of ['Dockerfile', '.dockerignore', 'railway.json', 'package.json', 'package-lock.json', 'tsconfig.json']) copy(path);
mkdirSync(join(destination, 'src'), { mode: 0o700 });
copy('src/course-catalog-data.json');
for (const name of readdirSync(join(project, 'src')).sort()) if (/^[\w-]+\.ts$/.test(name)) copy('src/' + name);
console.log(destination);
