// Reviewed source excerpt. See ../README.md for dependencies and publication changes.
import { z } from 'zod';
import { google } from 'googleapis';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { integrations } from 'zitejs/integrations';

const TZ = 'America/Los_Angeles';

export default createEndpoint({
  description: 'Writes a cleaner or inspector accepting or rejecting a checkout to Google Calendar',
  inputSchema: z.object({
    role: z.enum(['cleaner', 'inspector']),
    name: z.string(),
    decision: z.enum(['accept', 'reject']),
    eventId: z.string(),
    start: z.string(),
    end: z.string(),
    departingGuest: z.string(),
    arrivingGuest: z.string(),
  }),
  outputSchema: z.object({ eventId: z.string() }),
  execute: async ({ input }) => {
    // Public reference only; the complete private source has no publication guard.
    throw new Error('Reference snapshot: configure identity, permissions, and conflict controls in a private project before deployment.');

    const name = input.name.trim().replace(/\//g, '');
    if (!name) throw new ZiteError({ code: 'BAD_REQUEST', message: 'No name', userFacingMessage: 'Please enter your name first.' });
    if (!input.start) throw new ZiteError({ code: 'BAD_REQUEST', message: 'No checkout time', userFacingMessage: 'This assignment has no checkout time.' });

    const { accessToken } = await integrations.get('googleCalendar');
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const cal = google.calendar({ version: 'v3', auth });

    const guest = input.arrivingGuest || input.departingGuest || 'TBD';
    const end = input.end || new Date(new Date(input.start).getTime() + 5 * 3600e3).toISOString();
    const stamp = new Date().toLocaleString('en-US', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });
    const existing = input.eventId ? (await cal.events.get({ calendarId: 'primary', eventId: input.eventId })).data : undefined;
    const isCleaner = input.role === 'cleaner';

    const currentName = isCleaner
      ? existing?.summary?.match(/^Cleaner:\s*([^/]+)/i)?.[1].trim() ?? ''
      : /^inspection needed/i.test(existing?.summary?.trim() ?? '') ? '' : existing?.summary?.trim().split(/\s+/)[0] ?? '';
    const baseDesc = (existing?.description ?? [
      input.arrivingGuest ? `Guest checking in: ${input.arrivingGuest}` : 'No next guest yet',
      `Departing: ${input.departingGuest || 'Unknown'}`,
    ].join('\n')).replace(/^Cleaner(:[^\n]*| needed)\n?/i, '');

    const taken = isCleaner ? `Cleaner: ${name} / Guest: ${guest}` : `${name} inspection`;
    const open = isCleaner ? `Cleaner needed / Guest: ${guest}` : `Inspection needed / Guest: ${guest}`;
    const label = isCleaner ? 'Cleaner' : 'Inspector';
    let summary: string;
    let description: string;
    if (input.decision === 'accept') {
      summary = taken;
      description = `${isCleaner ? `Cleaner: ${name}\n` : ''}${baseDesc}\n\nAccepted by ${name} (${label}, ${stamp})`;
    } else {
      summary = currentName.toLowerCase() === name.toLowerCase() || !existing ? open : existing.summary ?? open;
      description = `${isCleaner && summary === open ? 'Cleaner needed\n' : ''}${baseDesc}\n\nDeclined by ${name} (${label}, ${stamp})`;
    }

    if (existing?.id) {
      const res = await cal.events.patch({ calendarId: 'primary', eventId: existing.id, requestBody: { summary, description } });
      return { eventId: res.data.id! };
    }
    const res = await cal.events.insert({
      calendarId: 'primary',
      requestBody: { summary, description, start: { dateTime: input.start, timeZone: TZ }, end: { dateTime: end, timeZone: TZ } },
    });
    return { eventId: res.data.id! };
  },
});
