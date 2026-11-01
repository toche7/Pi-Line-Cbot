import type { IncomingMessage, ServerResponse } from 'node:http';
import { KnowledgeError, KnowledgeStore, knowledgeDigest } from './knowledge-store.js';
import { publicAnswer, unknownAnswer, searchKnowledge } from './knowledge.js';
import { courseCatalog } from './course-catalog.js';
import { courseFieldValue, courseFields, type CourseField } from './course-reader.js';

export function knowledgeSnapshot(store: KnowledgeStore) {
  const s = store.snapshot(), published = s.versions.find(v => v.id === s.active)!.entries;
  const ids = new Set([...published,...s.draft].map(e => e.id));
  const diff = [...ids].map(id => {
    const before = published.find(e => e.id === id), after = s.draft.find(e => e.id === id);
    return { id, before, after, changed: knowledgeDigest(before) !== knowledgeDigest(after) };
  });
  return { ...s, diff, catalog: { schema: courseCatalog.schemaVersion, collectedAt: courseCatalog.collectionDate, fingerprint: courseCatalog.sourceSha256,
    warnings: courseCatalog.validationWarnings, fieldLabels: courseFields, courses: courseCatalog.courses.map(c => ({ id: c.id, name: c.name, source: c.canonical_url, capturedAt: c.provenance.retrieved_at, flags: c.flags, missing: c.missing_fields,
      fields: Object.fromEntries(Object.keys(courseFields).map(k => [k, courseFieldValue(c, k as CourseField)])), sources: c.source_refs, teacherEvidence: c.instructor_evidence, fieldSources: c.field_sources })) } };
}
export function knowledgeHandler(store: KnowledgeStore, token: string) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, value: unknown) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin' }).end(JSON.stringify(value));
    if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || !/^127\.0\.0\.1:\d+$/.test(req.headers.host || '') || (req.headers.origin && req.headers.origin !== 'http://'+req.headers.host) || (req.headers['sec-fetch-site'] && !['same-origin','none'].includes(String(req.headers['sec-fetch-site'])))) return reply(403,{error:'อนุญาตเฉพาะเว็บบนเครื่องนี้'});
    try {
      if (req.method === 'GET') return reply(200,knowledgeSnapshot(store));
      if (req.method !== 'POST') return reply(405,{error:'ไม่รองรับวิธีนี้'});
      if (!token || req.headers.origin !== 'http://'+req.headers.host || req.headers['x-knowledge-token'] !== token || req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return reply(403,{error:'คำขอไม่ผ่านการตรวจ กรุณาเปิดเว็บใหม่'});
      let bytes = 0; const chunks: Buffer[] = [];
      for await (const part of req) { const c = Buffer.from(part); bytes += c.length; if (bytes > 32768) return reply(413,{error:'ข้อมูลเกิน 32 KiB'}); chunks.push(c); }
      let input: any; try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(400,{error:'JSON ไม่ถูกต้อง'}); }
      if (input?.action === 'try') {
        if (Object.keys(input).some(k => !['action','revision','query'].includes(k)) || typeof input.query !== 'string' || !input.query.trim() || input.query.length > 2000) throw new KnowledgeError(400,'กรอกคำถามไม่เกิน 2,000 ตัวอักษร');
        const s = store.snapshot(); if (input.revision !== s.revision) throw new KnowledgeError(409,'ร่างเปลี่ยนแล้ว โหลดล่าสุดก่อนลองใหม่');
        const active = s.versions.find(v => v.id === s.active)!.entries.filter(e => !e.retired), draft = s.draft.filter(e => !e.retired);
        return reply(200,{revision:s.revision,digest:knowledgeDigest(s.draft),draft:publicAnswer(input.query,draft) ?? unknownAnswer,published:publicAnswer(input.query,active) ?? unknownAnswer,
          draftStatus:searchKnowledge(input.query,draft).status,publishedStatus:searchKnowledge(input.query,active).status, scope:'ตัวค้นและคำตอบ FAQ เท่านั้น ไม่จำลองบทสนทนา ความจำ คำขอ หรือหลักสูตร ไม่เรียกโมเดลและไม่ส่ง LINE'});
      }
      store.mutate(input); return reply(200,req.headers['x-paged-reply']==='1'?{ok:true,revision:store.snapshot().revision}:knowledgeSnapshot(store));
    } catch (e) { return reply(e instanceof KnowledgeError ? e.status : 503,{error:e instanceof KnowledgeError ? e.message : 'อ่านหรือบันทึกความรู้ไม่ได้ ข้อมูลใช้งานเดิมยังคงอยู่'}); }
  };
}
