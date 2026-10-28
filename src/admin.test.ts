import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { adminHandler } from './admin.js';
import { ConversationMonitor } from './monitor.js';
import { CourseRequestStore } from './course-requests.js';

test('unified admin serves both panels and APIs on one origin with existing access restrictions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'admin-'));
  try {
    const handler = adminHandler(new ConversationMonitor(join(dir, 'monitor')), new CourseRequestStore(join(dir, 'requests')));
    const request = (url: string, host = '127.0.0.1:3001') => {
      let status = 0, body = '';
      handler({ url, method: 'GET', headers: { host } } as IncomingMessage,
        { writeHead(n: number) { status = n; return this; }, end(s = '') { body = s; } } as unknown as ServerResponse);
      return { status, body };
    };
    const root = request('/');
    assert.equal(root.status, 200);
    assert.match(root.body, /role="tablist"/);
    assert.match(root.body, /id="requests-search"/);
    assert.match(root.body, /fetch\('\/api\/requests'\)/);
    assert.match(root.body, /fetch\('\/api\/conversations'\)/);
    assert.doesNotMatch(root.body, /<iframe|127\.0\.0\.1:3002/);
    for (const url of ['/api/monitor', '/api/requests']) {
      assert.equal(request(url).status, 200);
      assert.equal(request(url, 'foreign.invalid').status, 403);
    }
    assert.deepEqual(JSON.parse(request('/api/requests').body).requests, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
