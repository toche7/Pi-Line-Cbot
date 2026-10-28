import { openSync, closeSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { NewsService } from './news.js';

// One host owns recovery and dispatch. No HTTP path can authorize a campaign.
export class NewsWorker {
  private timer?: ReturnType<typeof setInterval>;
  private pending?: Promise<void>;
  private stopped = false;
  private fd?: number;
  private lock: string;
  constructor(private service: NewsService, private onError: () => void = () => {}) { this.lock = join(service.store.root, '.worker-lock'); }
  start() {
    if (this.fd !== undefined) throw Error('News worker already started');
    this.fd = openSync(this.lock, 'wx', 0o600);
    try { this.service.recover(); }
    catch (e) { this.release(); throw e; }
    this.timer = setInterval(() => this.pump(), 1000);
  }
  pump() {
    if (this.stopped || this.fd === undefined || this.pending) return;
    this.pending = Promise.resolve().then(async () => {
      if (this.service.store.list().some(c => c.status === 'queued')) await this.service.tick();
    }).catch(() => {
      // A failed result write may leave inflight: suspend until supervised restart/recovery.
      this.stopped = true; if (this.timer) clearInterval(this.timer); this.onError();
    }).finally(() => { this.pending = undefined; });
  }
  private release() { if (this.fd !== undefined) { closeSync(this.fd); this.fd = undefined; unlinkSync(this.lock); } }
  async close() { this.stopped = true; if (this.timer) clearInterval(this.timer); await this.pending; this.release(); }
}
