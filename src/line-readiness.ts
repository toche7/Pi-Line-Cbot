// Configuration presence only. Never echo environment values, tokens or user IDs.
const fields = ['LINE_CHANNEL_ID', 'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_ALLOWED_USER_IDS', 'PUBLIC_BASE_URL'];
const missing = fields.filter(key => !process.env[key]?.trim());
for (const key of fields) console.log(`${key}: ${missing.includes(key) ? 'missing' : 'configured'}`);
console.log(`Dry run: ${process.env.LINE_DRY_RUN !== 'false'}`);
console.log(`Tester count: ${(process.env.LINE_ALLOWED_USER_IDS || '').split(',').filter(s => s.trim()).length}`);
let endpointValid = false;
if (process.env.PUBLIC_BASE_URL?.trim()) {
  try {
    const url = new URL(process.env.PUBLIC_BASE_URL);
    endpointValid = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch { /* Invalid URL: do not echo supplied value. */ }
}
console.log(`HTTPS base URL valid (syntax only): ${endpointValid}`);
console.log('LINE server persistence: .line-memory; separate directory/lock from Terminal .customer-memory; retention 90 days.');
console.log('No API request, deployment or LINE message was sent; configured does not prove credentials are valid.');
if (missing.length || !endpointValid) {
  console.log('Not ready for OA test. Fill missing fields locally and choose HTTPS hosting.');
  process.exitCode = 1;
} else console.log('Configuration fields present. Next: verify target test OA/testers, HTTPS reachability and signed webhook in dry run.');
