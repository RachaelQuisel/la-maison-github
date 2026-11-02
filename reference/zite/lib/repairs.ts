// Reviewed source excerpt. See ../README.md for dependencies and publication changes.
// Repair requests live in the visit's Cleaning Notes, in their own block below
// the inspection checklist. One line per request: a readable summary, then the
// full request as JSON between ⟦ ⟧ so the app can read it back.
import { Cleaning, Staff, Property, type CleaningRecordType } from 'zitejs/integrations';
import { integrations } from 'zitejs/integrations';
import { ZiteError } from 'zitejs/backend';

export type Repair = {
  id: string; taskKey: string; taskTitle: string; note: string; trade: string;
  contractorId: string; contractorName: string; inspectorId: string;
  status: 'texted' | 'booked' | 'declined'; slot: string; sentAt: string;
};

const START = '=== Repair requests ===';
const END = '=== End repair requests ===';
const FROM = 'SET_YOUR_SMS_SENDER';
export const TZ = 'America/Los_Angeles';

export const TRADES = ['Plumber', 'Spa tech', 'Electrician', 'Landscape', 'Handyman', 'Other'];

export function parseRepairs(notes = ''): Repair[] {
  const s = notes.indexOf(START);
  if (s < 0) return [];
  const e = notes.indexOf(END, s);
  return notes.slice(s, e < 0 ? undefined : e).split('\n').flatMap((l) => {
    const m = l.match(/⟦(.*)⟧\s*$/);
    try { return m ? [JSON.parse(m[1]) as Repair] : []; } catch { return []; }
  });
}

export const slotLabel = (iso: string) => iso
  ? new Date(iso).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(':00', '')
  : '';

export function writeRepairs(notes: string, repairs: Repair[]) {
  const lines = repairs.map((r) => {
    const state = r.status === 'booked' ? `Booked ${slotLabel(r.slot)}` : r.status === 'declined' ? 'Declined' : 'Texted';
    return `• ${r.trade} ${r.contractorName} — ${state} — ${r.taskTitle.replace(/\s+/g, ' ').slice(0, 60)} ⟦${JSON.stringify(r)}⟧`;
  });
  const block = [START, ...lines, END].join('\n');
  const s = notes.indexOf(START);
  if (s < 0) return notes.trim() ? `${notes.trim()}\n\n${block}` : block;
  const e = notes.indexOf(END, s);
  return notes.slice(0, s) + block + (e < 0 ? '' : notes.slice(e + END.length));
}

export async function saveRepair(cleaning: CleaningRecordType, repair: Repair) {
  const fresh = await Cleaning.findOne({ id: cleaning.id });
  const list = parseRepairs(fresh?.notes).filter((r) => r.id !== repair.id && r.taskKey !== repair.taskKey);
  // A resend for the same task replaces the earlier request; keep the latest for this id otherwise
  await Cleaning.update({ id: cleaning.id, record: { notes: writeRepairs(fresh?.notes ?? '', [...list, repair]) } });
}

export function toE164(phone = '') {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return phone.trim().startsWith('+') ? `+${d}` : '';
}

export async function sendSms(phone: string | undefined, body: string) {
  const to = toE164(phone);
  if (!to) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Bad phone', userFacingMessage: 'That person has no valid phone number in Airtable.' });
  const { accessToken, authToken } = await integrations.get('twilio');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accessToken}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${accessToken}:${authToken}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: FROM, Body: body }),
  });
  if (!res.ok) {
    console.error('Twilio error', res.status, await res.text());
    throw new ZiteError({ code: 'INTERNAL_ERROR', message: 'SMS failed', userFacingMessage: 'The text could not be sent. Check the phone number and try again.' });
  }
}

export async function propertyName(c: CleaningRecordType) {
  const id = Array.isArray(c.property) ? c.property[0] : c.property;
  const p = id ? await Property.findOne({ id }) : undefined;
  return p?.name || c.title || 'La Maison';
}

export async function loadJob(job: string) {
  const [cleaningId, id] = job.split('.');
  const cleaning = cleaningId?.startsWith('rec') ? await Cleaning.findOne({ id: cleaningId }) : undefined;
  const repair = cleaning && parseRepairs(cleaning.notes).find((r) => r.id === id);
  if (!cleaning || !repair) throw new ZiteError({ code: 'NOT_FOUND', message: 'No job', userFacingMessage: 'This job link is no longer active. Ask La Maison for a new one.' });
  return { cleaning, repair };
}

export const staffById = (id: string) => Staff.findOne({ id });

const MAINTENANCE = 'SET_MAINTENANCE_CHANNEL';
export const INSPECTIONS = 'SET_INSPECTIONS_CHANNEL';
export async function postSlack(text: string, channel = MAINTENANCE) {
  try {
    const { accessToken } = await integrations.get('slack');
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
    let j: any = await (await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers, body: JSON.stringify({ channel: channel, text }) })).json();
    if (j.error === 'not_in_channel') {
      await fetch('https://slack.com/api/conversations.join', { method: 'POST', headers, body: JSON.stringify({ channel: channel }) });
      j = await (await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers, body: JSON.stringify({ channel: channel, text }) })).json();
    }
    if (!j.ok) console.error('Slack post failed', j.error);
    return !!j.ok;
  } catch (e) { console.error('Slack post failed', e); return false; }
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const header = (v: string) => { const one = v.replace(/[\r\n]+/g, ' '); return /^[\x00-\x7F]*$/.test(one) ? one : `=?UTF-8?B?${b64(one)}?=`; };

/** Sends an HTML email from the connected La Maison Gmail account, as Rachael. */
export async function sendGmail(to: string[], subject: string, html: string) {
  const { accessToken } = await integrations.get('gmail');
  const mime = [`From: ${header('Example Host')} <owner@example.invalid>`, `To: ${to.join(', ')}`, `Subject: ${header(subject)}`,
    'MIME-Version: 1.0', 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64(html)].join('\r\n');
  const raw = b64(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`);
}
