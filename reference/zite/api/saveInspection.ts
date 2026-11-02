// Reviewed source excerpt. See ../README.md for dependencies and publication changes.
import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { Cleaning } from 'zitejs/integrations';
import { loadOwnCleaning, writeResults } from '../lib/inspection';

export default createEndpoint({
  description: "Saves an inspector's checklist results onto the Airtable cleaning record",
  inputSchema: z.object({
    cleaningId: z.string(),
    name: z.string(),
    results: z.array(z.object({ key: z.string(), title: z.string(), status: z.enum(['done', 'issue', 'na']), note: z.string() })),
    status: z.enum(['In progress', 'Completed']),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input }) => {
    // Public reference only; the complete private source has no publication guard.
    throw new Error('Reference snapshot: configure identity, permissions, and conflict controls in a private project before deployment.');

    const { inspector, cleaning } = await loadOwnCleaning(input.cleaningId, input.name);
    const notes = writeResults(cleaning.notes ?? '', input.results, inspector.name ?? input.name);
    // Never pull a cleaning back from Completed just because a box was re-ticked.
    const status = cleaning.status === 'Completed' && input.status === 'In progress' ? 'Completed' : input.status;
    await Cleaning.update({ id: cleaning.id, record: { notes, status } });
    return { ok: true };
  },
});
