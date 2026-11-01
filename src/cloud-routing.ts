import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AdminRequestHandler } from './staff-auth.js';
import { Readable } from 'node:stream';

export function cloudRouting(handlers: { webhook: AdminRequestHandler; media: AdminRequestHandler; admin: AdminRequestHandler; ready: () => boolean }) {
  return (req: IncomingMessage, res: ServerResponse) => {
    if (['/healthz', '/health'].includes(req.url || '') && ['GET', 'HEAD'].includes(req.method || '')) {
      const ready = handlers.ready();
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: ready })); return;
    }
    if (req.url === '/webhook/line') return handlers.webhook(req, res);
    if (req.url?.startsWith('/news-media/')) return handlers.media(req, res);
    return handlers.admin(req, res);
  };
}

// Only StaffAuth may invoke this adapter, after its public Host/Origin, session,
// CSRF and role checks. Preserve the existing local-only panel handlers without
// trusting forwarded headers or exposing a second unauthenticated listener.
export function legacyAdminRequest(req: IncomingMessage): IncomingMessage {
  return Object.assign(Readable.from(req), {
    method: req.method, url: req.url, httpVersion: req.httpVersion,
    headers: { ...req.headers, host: '127.0.0.1:3001', ...(req.headers.origin ? { origin: 'http://127.0.0.1:3001' } : {}) },
    socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as IncomingMessage;
}
