// Reviewed source excerpt. See ../README.md for dependencies and publication changes.
import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { postSlack, INSPECTIONS, TZ } from '../lib/repairs';

export default createEndpoint({
  description: 'Posts a finished inspection checklist (done and not done) to the #inspections Slack channel',
  inputSchema: z.object({
    inspector: z.string(),
    done: z.array(z.string()),
    notDone: z.array(z.string()),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input }) => {
    // Public reference only; the complete private source has no publication guard.
    throw new Error('Reference snapshot: configure identity, permissions, and conflict controls in a private project before deployment.');

    const name = input.inspector.trim();
    if (name.length < 2) throw new ZiteError({ code: 'BAD_REQUEST', message: 'No name', userFacingMessage: 'Please enter your name before submitting.' });
    const date = new Date().toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const clip = (t: string) => t.replace(/\s+/g, ' ').slice(0, 140);
    const text = [
      `*Inspection checklist submitted*`,
      `*Inspector:* ${name}`,
      `*Date:* ${date}`,
      `*Completed:* ${input.done.length} of ${input.done.length + input.notDone.length}`,
      '',
      `:white_check_mark: *Completed (${input.done.length})*`,
      ...(input.done.length ? input.done.map((t) => `• ${clip(t)}`) : ['_None_']),
      '',
      `:x: *Not completed (${input.notDone.length})*`,
      ...(input.notDone.length ? input.notDone.map((t) => `• ${clip(t)}`) : ['_None_']),
    ].join('\n').slice(0, 39000);
    const ok = await postSlack(text, INSPECTIONS);
    if (!ok) throw new ZiteError({ code: 'INTERNAL_ERROR', message: 'Slack failed', userFacingMessage: 'Couldn’t send to Slack. Please try again.' });
    return { ok };
  },
});
