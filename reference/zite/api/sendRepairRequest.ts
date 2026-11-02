// Reviewed source excerpt. See ../README.md for dependencies and publication changes.
import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { loadOwnCleaning } from '../lib/inspection';
import { postSlack, propertyName, saveRepair, sendSms, staffById, type Repair } from '../lib/repairs';

export default createEndpoint({
  description: 'Texts a contractor about an inspection issue with a link to pick a time',
  inputSchema: z.object({
    cleaningId: z.string(), name: z.string(), taskKey: z.string(), taskTitle: z.string(),
    note: z.string(), trade: z.string(), contractorId: z.string(), message: z.string().min(1),
  }),
  outputSchema: z.object({
    repair: z.object({ id: z.string(), taskKey: z.string(), trade: z.string(), contractorName: z.string(), status: z.string(), slot: z.string() }),
  }),
  execute: async ({ input }) => {
    // Public reference only; the complete private source has no publication guard.
    throw new Error('Reference snapshot: configure identity, permissions, and conflict controls in a private project before deployment.');

    const { inspector, cleaning } = await loadOwnCleaning(input.cleaningId, input.name);
    const c = await staffById(input.contractorId);
    if (!c) throw new ZiteError({ code: 'NOT_FOUND', message: 'No contractor', userFacingMessage: 'That contractor is no longer on the Staff list.' });
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const link = `${process.env.ZITE_APP_URL}/?job=${cleaning.id}.${id}`;
    await sendSms(c.phone, `${input.message.trim()}\n\nPick a time: ${link}`);
    const contractorName = c.firstName ? `${c.firstName} ${c.lastName?.[0] ?? ''}.`.replace(' .', '') : c.name ?? 'Contractor';
    const repair: Repair = {
      id, taskKey: input.taskKey, taskTitle: input.taskTitle, note: input.note, trade: input.trade,
      contractorId: c.id, contractorName, inspectorId: inspector.id, status: 'texted', slot: '', sentAt: new Date().toISOString(),
    };
    await saveRepair(cleaning, repair);
    await postSlack(`:wrench: ${input.trade} texted — ${contractorName} for "${input.taskTitle}"${input.note ? ` (${input.note})` : ''} at ${await propertyName(cleaning)}. Sent by ${inspector.firstName || inspector.name || 'inspector'}.`);
    return { repair };
  },
});
