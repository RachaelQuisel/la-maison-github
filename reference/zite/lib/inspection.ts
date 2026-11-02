// Reviewed source excerpt. See ../README.md for dependencies and publication changes.
// Shared by the inspection endpoints. Results for each visit live inside that
// visit's Cleaning record (Notes), between two marker lines, so Airtable keeps
// one history per visit and the master checklist is never modified.
import { Staff, Cleaning, type StaffRecordType } from 'zitejs/integrations';
import { ZiteError } from 'zitejs/backend';

export type ResultStatus = 'done' | 'issue' | 'na';
export type Result = { key: string; status: ResultStatus; note: string };

const START = '=== Inspection checklist';
const END = '=== End inspection ===';
const MARK: Record<ResultStatus, string> = { done: '✓', issue: '⚠', na: '–' };
const UNMARK: Record<string, ResultStatus> = { '✓': 'done', '⚠': 'issue', '–': 'na' };

const ids = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const norm = (s = '') => s.trim().toLowerCase();

export async function findInspector(name: string) {
  const n = norm(name);
  if (!n) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Missing name', userFacingMessage: 'Open your personal link to see your inspections.' });
  const staff: StaffRecordType[] = [];
  let offset: string | undefined;
  do {
    const page = await Staff.findAll({ limit: 100, offset });
    staff.push(...page.records);
    offset = page.offset;
  } while (offset);
  const first = n.split(/\s+/)[0];
  const match = staff.find((s) => [s.name, s.shorthand].some((x) => norm(x) === n))
    ?? staff.find((s) => norm(s.firstName) === first || norm(s.shorthand) === first);
  if (!match) throw new ZiteError({ code: 'NOT_FOUND', message: `No staff ${name}`, userFacingMessage: `We couldn't find "${name}" on the La Maison staff list.` });
  return match;
}

export async function loadOwnCleaning(cleaningId: string, name: string) {
  const [inspector, cleaning] = await Promise.all([findInspector(name), Cleaning.findOne({ id: cleaningId })]);
  if (!cleaning || !ids(cleaning.inspector).includes(inspector.id)) {
    throw new ZiteError({ code: 'FORBIDDEN', message: 'Not assigned', userFacingMessage: 'That inspection is not assigned to you.' });
  }
  return { inspector, cleaning };
}

export const inspectorIds = ids;

export function parseResults(notes = ''): Result[] {
  const s = notes.indexOf(START);
  if (s < 0) return [];
  const e = notes.indexOf(END, s);
  const block = notes.slice(s, e < 0 ? undefined : e).split('\n').slice(1);
  const out: Result[] = [];
  for (const line of block) {
    const m = line.match(/^(✓|⚠|–) \[([^\]]+)\][^—]*(?:— (.*))?$/);
    if (m) out.push({ key: m[2], status: UNMARK[m[1]], note: (m[3] ?? '').trim() });
  }
  return out;
}

export function writeResults(notes: string, results: (Result & { title: string })[], by: string) {
  const stamp = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' });
  const clean = (t: string) => t.replace(/\s+/g, ' ').replace(/[—\[\]]/g, '-').trim();
  const lines = results.map((r) => {
    const title = clean(r.title).slice(0, 80);
    const note = r.note ? ` — ${r.note.replace(/\s+/g, ' ').trim()}` : '';
    return `${MARK[r.status]} [${r.key}] ${title}${note}`;
  });
  const block = [`${START} (updated ${stamp} by ${by}) ===`, ...lines, END].join('\n');
  const s = notes.indexOf(START);
  if (s < 0) return notes.trim() ? `${notes.trim()}\n\n${block}` : block;
  const e = notes.indexOf(END, s);
  return notes.slice(0, s) + block + (e < 0 ? '' : notes.slice(e + END.length));
}
