// Reviewed source excerpt. See ../README.md for dependencies and publication changes.
import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { InspectionChecklist } from 'zitejs/integrations';
import { loadOwnCleaning, parseResults } from '../lib/inspection';
import { parseRepairs } from '../lib/repairs';

const status = z.enum(['done', 'issue', 'na']);

export default createEndpoint({
  description: 'Loads one inspection visit with its checklist and saved results from Airtable',
  inputSchema: z.object({ cleaningId: z.string(), name: z.string() }),
  outputSchema: z.object({
    visit: z.object({ id: z.string(), title: z.string(), date: z.string(), status: z.string(), guestName: z.string() }),
    tasks: z.array(z.object({
      key: z.string(), title: z.string(), area: z.string(), priority: z.string(),
      instructions: z.string(), reason: z.string(),
    })),
    results: z.array(z.object({ key: z.string(), status, note: z.string() })),
    repairs: z.array(z.object({ id: z.string(), taskKey: z.string(), trade: z.string(), contractorName: z.string(), status: z.string(), slot: z.string() })),
  }),
  execute: async ({ input }) => {
    // Public reference only; the complete private source has no publication guard.
    throw new Error('Reference snapshot: configure identity, permissions, and conflict controls in a private project before deployment.');

    const { cleaning } = await loadOwnCleaning(input.cleaningId, input.name);
    const tasks: { key: string; title: string; area: string; priority: string; instructions: string; reason: string }[] = [];
    let offset: string | undefined;
    do {
      const page = await InspectionChecklist.findAll({ limit: 100, offset });
      for (const t of page.records) tasks.push({
        key: t.itemId?.trim() || t.id, title: t.task ?? 'Untitled task', area: t.area ?? 'Other',
        priority: t.priority ?? '', instructions: t.notes ?? '', reason: t.whyWeCheckThis ?? '',
      });
      offset = page.offset;
    } while (offset);
    tasks.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
    return {
      visit: { id: cleaning.id, title: cleaning.title ?? 'Inspection', date: cleaning.date ?? '', status: cleaning.status ?? 'Scheduled', guestName: cleaning.guestName ?? '' },
      tasks,
      results: parseResults(cleaning.notes),
      repairs: parseRepairs(cleaning.notes),
    };
  },
});
