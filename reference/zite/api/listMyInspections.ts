// Reviewed source excerpt. See ../README.md for dependencies and publication changes.
import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { Cleaning, InspectionChecklist, type CleaningRecordType } from 'zitejs/integrations';
import { findInspector, inspectorIds, parseResults } from '../lib/inspection';

const TZ = 'America/Los_Angeles';
const day = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ });

export default createEndpoint({
  description: "Lists the inspector's assigned Airtable cleanings with checklist progress",
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({
    inspector: z.string(),
    totalTasks: z.number(),
    inspections: z.array(z.object({
      id: z.string(), title: z.string(), date: z.string(), status: z.string(),
      guestName: z.string(), checkinTime: z.string(), sameDay: z.boolean(),
      done: z.number(), issues: z.number(), reviewed: z.number(),
    })),
  }),
  execute: async ({ input }) => {
    // Public reference only; the complete private source has no publication guard.
    throw new Error('Reference snapshot: configure identity, permissions, and conflict controls in a private project before deployment.');

    const inspector = await findInspector(input.name);
    const from = day(Date.now() - 14 * 864e5);
    const to = day(Date.now() + 60 * 864e5);
    const rows: CleaningRecordType[] = [];
    let offset: string | undefined;
    do {
      const page = await Cleaning.findAll({ limit: 100, offset });
      rows.push(...page.records.filter((c) => inspectorIds(c.inspector).includes(inspector.id)));
      offset = page.offset;
    } while (offset);
    let totalTasks = 0;
    offset = undefined;
    do {
      const page = await InspectionChecklist.findAll({ limit: 100, offset });
      totalTasks += page.records.length;
      offset = page.offset;
    } while (offset);

    const inspections = rows
      .filter((c) => c.date && c.date >= from && c.date <= to && c.status !== 'Canceled')
      .map((c) => {
        const r = parseResults(c.notes);
        return {
          id: c.id, title: c.title ?? 'Inspection', date: c.date!, status: c.status ?? 'Scheduled',
          guestName: c.guestName ?? '', checkinTime: c.checkinTime ?? '', sameDay: !!c.samedayTurnover,
          done: r.filter((x) => x.status === 'done').length,
          issues: r.filter((x) => x.status === 'issue').length,
          reviewed: r.length,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    return { inspector: inspector.name ?? input.name, totalTasks, inspections };
  },
});
