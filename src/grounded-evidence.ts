import { courseInstructors } from './course-instructors.js';
import { activeKnowledge } from './knowledge-store.js';
import { courseCatalog } from './course-catalog.js';
import { courseFields, courseFieldValue } from './course-reader.js';
import { readInstructorProfile } from './instructor-profile.js';
import { identityAnswer } from './knowledge.js';
import { renderCapabilities, type ConversationCapabilities } from './capabilities.js';
import { renderPrivateChatHelp } from './private-chat-help.js';
import { requestCapabilityAnswer } from './course-requests.js';
import type { HumanSupportStatus } from './human-request.js';

export type Evidence = { id: string; title: string; text: string; url?: string; urls?: string[]; sourceNotes?: string[]; capturedAt?: string };
const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
const tokens = (s: string) => [...new Set([...new Intl.Segmenter('th', { granularity: 'word' }).segment(s.toLowerCase())]
  .filter(p => p.isWordLike && p.segment.length > 1).map(p => normalize(p.segment)))];

export function publicEvidence(): Evidence[] {
  const docs: Evidence[] = activeKnowledge().map(k => ({ id: 'faq:' + k.id, title: k.title,
    text: [k.text, ...(k.conflict ? ['Unresolved source conflict: ' + k.conflictNote] : [])].join('\n'),
    url: k.source, capturedAt: k.capturedAt }));
  for (const c of courseCatalog.courses) docs.push({ id: 'course:' + c.id, title: c.name,
    text: Object.keys(courseFields).map(key => `${key}: ${courseFieldValue(c, key as keyof typeof courseFields) ?? 'not recorded'}`).join('\n')
      + '\nHistorical snapshot only, not proof of current enrollment/availability. Flags: ' + c.flags.join(', '),
    url: c.canonical_url, capturedAt: courseCatalog.collectionDate });
  const names = new Map<string, string>();
  for (const c of courseCatalog.courses) for (const teacher of courseInstructors(c)) names.set(normalize(teacher.name), teacher.name);
  for (const [key, name] of names) docs.push({ id: 'person:' + key, title: name,
    text: readInstructorProfile(name), url: courseCatalog.courses.flatMap(c => courseInstructors(c)).find(t => normalize(t.name) === key)?.source_url, capturedAt: courseCatalog.collectionDate });
  return docs;
}
export function hostEvidence(capabilities?: ConversationCapabilities, support?: HumanSupportStatus): Evidence[] {
  return [{ id: 'host:identity', title: 'Bot identity', text: identityAnswer },
    ...(capabilities ? [{ id: 'host:capabilities', title: 'Enabled services in this channel', text: renderCapabilities(capabilities) },
      { id: 'host:private-chat', title: 'How to add this bot and open private LINE chat', text: renderPrivateChatHelp(capabilities) },
      ...(capabilities.requests ? [{ id: 'host:requests', title: 'Booking/contact request capabilities, not completed actions', text: requestCapabilityAnswer }] : [])] : []),
    ...(support ? [{ id: 'host:support', title: 'Actual current human support state', text: JSON.stringify(support) + '\nWaiting is not acceptance, external notification or a promised reply time.' }] : [])];
}
// The LLM supplies a contextual search query (and can translate/expand it).
// This bounded lexical retriever never executes source instructions or opens URLs.
export function retrieveEvidence(query: string, documents: Evidence[], limit = 6, preferredIds: string[] = []) {
  const words = tokens(query), whole = normalize(query);
  if (!whole || !words.length) return [];
  return documents.map(doc => {
    const title = normalize(doc.id + ' ' + doc.title), text = normalize(doc.text);
    const score = words.reduce((n, word) => n + (title.includes(word) ? 5 : 0) + (text.includes(word) ? 1 : 0), 0)
      + (title.includes(whole) ? 10 : 0) + (preferredIds.includes(doc.id) ? 100 : 0);
    return { doc, score };
  }).filter(hit => hit.score > 0).sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id))
    .slice(0, limit).map(hit => ({ ...hit.doc, text: hit.doc.text.slice(0, 2400) }));
}


// Rehydrate only still-published evidence belonging to this conversation's
// previously cited sources. Never trust old model prose as a new factual source.
export function conversationEvidence(documents: Evidence[], ids: string[] = [], previousAnswer = '', catalog?: unknown) {
  const remembered = ids.map(id => documents.find(doc => doc.id === id)).filter((doc): doc is Evidence => !!doc);
  if (ids.length) return remembered.slice(0, 6).map(doc => ({ ...doc, text: doc.text.slice(0, 2400) }));
  // Compatibility for conversations created before source pointers were saved.
  const urls = new Set(previousAnswer.match(/https:\/\/[^\s)]+/g) ?? []);
  const shown = catalog && typeof catalog === 'object' && 'shownIds' in catalog && Array.isArray(catalog.shownIds) ? catalog.shownIds : [];
  const candidates = documents.filter(doc => doc.url && urls.has(doc.url) || shown.includes(doc.id.replace(/^course:/, '')) && doc.id.startsWith('course:'));
  const ranked = retrieveEvidence(previousAnswer, candidates);
  return [...new Map([...ranked, ...candidates].map(doc => [doc.id, doc])).values()].slice(0, 6)
    .map(doc => ({ ...doc, text: doc.text.slice(0, 2400) }));
}

export function citedPublicIds(references: { id: string }[], evidence: Map<string, Evidence>, documents: Evidence[]) {
  const ids = new Set<string>();
  for (const reference of references) {
    const doc = evidence.get(reference.id);
    if (!doc) continue;
    if (documents.some(current => current.id === doc.id)) ids.add(doc.id);
    if (doc.id === 'turn:catalog') for (const current of documents) {
      if (current.id.startsWith('course:') && current.url && doc.urls?.includes(current.url)) ids.add(current.id);
    }
  }
  return [...ids].slice(0, 6);
}
