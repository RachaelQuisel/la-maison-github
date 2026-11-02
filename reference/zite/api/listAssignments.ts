// Reviewed source excerpt. See ../README.md for dependencies and publication changes.
import { z } from 'zod';
import { google, calendar_v3 } from 'googleapis';
import { createEndpoint } from 'zitejs/backend';
import { integrations } from 'zitejs/integrations';

const TZ = 'America/Los_Angeles';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const startOf = (e: calendar_v3.Schema$Event) => e.start?.dateTime ?? e.start?.date ?? '';
const endOf = (e: calendar_v3.Schema$Event) => e.end?.dateTime ?? e.end?.date ?? '';
const isBooking = (e: calendar_v3.Schema$Event) =>
  /^(airbnb|vrbo|lodgify|direct)\s*:/i.test(e.summary ?? '') || /Reservation:/i.test(e.description ?? '');
const guestOf = (e: calendar_v3.Schema$Event) =>
  e.description?.match(/Guest:\s*(.+)/i)?.[1].trim() ?? e.summary?.split(':').slice(1).join(':').trim() ?? '';

export default createEndpoint({
  description: 'Builds cleaning assignment cards from guest checkouts on Google Calendar',
  inputSchema: z.object({}),
  outputSchema: z.object({
    assignments: z.array(z.object({
      id: z.string(),
      date: z.string(),
      start: z.string(),
      end: z.string(),
      departingGuest: z.string(),
      arrivingGuest: z.string(),
      cleaner: z.string(),
      cleaningEventId: z.string(),
      inspector: z.string(),
      inspectionEventId: z.string(),
      sameDay: z.boolean(),
      canceled: z.boolean(),
    })),
  }),
  execute: async () => {
    // Public reference only; the complete private source has no publication guard.
    throw new Error('Reference snapshot: configure identity, permissions, and conflict controls in a private project before deployment.');

    const { accessToken } = await integrations.get('googleCalendar');
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const cal = google.calendar({ version: 'v3', auth });

    const now = Date.now();
    const today = dayKey(new Date(now).toISOString());
    const horizon = dayKey(new Date(now + 60 * 864e5).toISOString());
    const events: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;
    do {
      const res = await cal.events.list({
        calendarId: 'primary',
        timeMin: new Date(now - 30 * 864e5).toISOString(),
        timeMax: new Date(now + 61 * 864e5).toISOString(),
        singleEvents: true, showDeleted: true, maxResults: 2500, pageToken,
      });
      events.push(...(res.data.items ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    const live = events.filter((e) => e.status !== 'cancelled');
    const bookings = live.filter(isBooking);
    const cleaners = new Map<string, { name: string; guest: string; eventId: string }>();
    const inspectors = new Map<string, { name: string; eventId: string }>();
    for (const e of live) {
      const s = e.summary ?? '';
      const c = s.match(/^Cleaner(?::\s*([^/]+)|\s+needed)/i);
      if (c) cleaners.set(dayKey(startOf(e)), { name: c[1]?.trim() ?? '', guest: s.match(/Guest:\s*(.+)/i)?.[1].trim() ?? '', eventId: e.id! });
      else if (/inspection/i.test(s)) inspectors.set(dayKey(startOf(e)), { name: /^inspection needed/i.test(s.trim()) ? '' : s.trim().split(/\s+/)[0], eventId: e.id! });
    }
    const inRange = (d: string) => d >= today && d <= horizon;

    const cards = bookings
      .filter((b) => inRange(dayKey(endOf(b))))
      .map((b) => {
        const date = dayKey(endOf(b));
        const next = bookings.find((n) => n !== b && dayKey(startOf(n)) === date);
        return {
          id: b.id!, date, start: endOf(b), end: next ? startOf(next) : '',
          departingGuest: guestOf(b), arrivingGuest: next ? guestOf(next) : '',
          cleaner: cleaners.get(date)?.name ?? '', cleaningEventId: cleaners.get(date)?.eventId ?? '',
          inspector: inspectors.get(date)?.name ?? '', inspectionEventId: inspectors.get(date)?.eventId ?? '',
          sameDay: !!next, canceled: false,
        };
      });

    const checkoutDays = new Set(cards.map((c) => c.date));
    const canceledDays = new Map<string, string>();
    for (const [d, c] of cleaners) if (inRange(d) && !checkoutDays.has(d)) canceledDays.set(d, c.guest);
    for (const e of events) {
      if (e.status === 'cancelled' && isBooking(e) && endOf(e)) {
        const d = dayKey(endOf(e));
        if (inRange(d) && !checkoutDays.has(d) && !canceledDays.has(d)) canceledDays.set(d, guestOf(e));
      }
    }
    for (const [d, guest] of canceledDays) {
      cards.push({
        id: `canceled-${d}`, date: d, start: '', end: '', departingGuest: guest, arrivingGuest: '',
        cleaner: cleaners.get(d)?.name ?? '', cleaningEventId: cleaners.get(d)?.eventId ?? '',
        inspector: inspectors.get(d)?.name ?? '', inspectionEventId: inspectors.get(d)?.eventId ?? '', sameDay: false, canceled: true,
      });
    }

    cards.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { assignments: cards };
  },
});
