import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
// Both local and Docker builds hash the same allowlisted source inputs.
const hash=createHash('sha256');
const files=['package.json','package-lock.json','tsconfig.json',...readdirSync('src').filter(n=>/^[\w-]+\.ts$/.test(n)||n==='course-catalog-data.json').sort().map(n=>'src/'+n)];
for(const file of files){const bytes=readFileSync(file);hash.update(file+'\0'+bytes.length+'\0');hash.update(bytes)}
writeFileSync(new URL('./build-info.json',import.meta.url),JSON.stringify({code:hash.digest('hex'),builtAt:new Date().toISOString()})+'\n');
