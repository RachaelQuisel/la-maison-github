// Reviewed source excerpt. See ../README.md for dependencies and publication changes.
import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { Cleaning, type CleaningRecordType } from 'zitejs/integrations';
import { loadJob, parseRepairs, propertyName, staffById, TZ } from '../lib/repairs';

function ptISO(day: string, hour: number) {
  const guess = new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
  const shown = Number(guess.toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }));
  return new Date(guess.getTime() + ((hour - shown + 24) % 24) * 3600e3).toISOString();
}

export default createEndpoint({
  description: 'Loads a contractor repair job and its open times from its texted link',
  inputSchema: z.object({ job: z.string() }),
  outputSchema: z.object({
    property: z.string(), taskTitle: z.string(), note: z.string(), trade: z.string(),
    contractorName: z.string(), inspectorName: z.string(), status: z.string(), slot: z.string(),
    slots: z.array(z.string()),
  }),
  execute: async ({ input }) => {
    // Public reference only; the complete private source has no publication guard.
    throw new Error('Reference snapshot: configure identity, permissions, and conflict controls in a private project before deployment.');

    const { cleaning, repair } = await loadJob(input.job);
    const all: CleaningRecordType[] = [];
    let offset: string | undefined;
    do {
      const page = await Cleaning.findAll({ limit: 100, offset });
      all.push(...page.records);
      offset = page.offset;
    } while (offset);
    const taken = new Set(all.flatMap((c) => parseRepairs(c.notes))
      .filter((r) => r.contractorId === repair.contractorId && r.status === 'booked' && r.id !== repair.id).map((r) => r.slot));
    const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
    const slots: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const day = d.toISOString().slice(0, 10);
      for (const h of [9, 13]) { const s = ptISO(day, h); if (!taken.has(s)) slots.push(s); }
    }
    const inspector = await staffById(repair.inspectorId);
    return {
      property: await propertyName(cleaning), taskTitle: repair.taskTitle, note: repair.note, trade: repair.trade,
      contractorName: repair.contractorName, inspectorName: inspector?.firstName || inspector?.name || 'your inspector',
      status: repair.status, slot: repair.slot, slots,
    };
  },
});
