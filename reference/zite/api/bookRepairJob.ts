// Reviewed source excerpt. See ../README.md for dependencies and publication changes.
import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { loadJob, postSlack, sendGmail, propertyName, saveRepair, sendSms, slotLabel, staffById } from '../lib/repairs';

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default createEndpoint({
  description: 'Lets a contractor book an open time (or decline) for a repair job, then texts both sides',
  inputSchema: z.object({ job: z.string(), slot: z.string().optional(), decline: z.boolean().optional() }),
  outputSchema: z.object({ status: z.string(), slot: z.string() }),
  execute: async ({ input }) => {
    // Public reference only; the complete private source has no publication guard.
    throw new Error('Reference snapshot: configure identity, permissions, and conflict controls in a private project before deployment.');

    const { cleaning, repair } = await loadJob(input.job);
    if (!input.decline && !input.slot) throw new ZiteError({ code: 'BAD_REQUEST', message: 'No slot', userFacingMessage: 'Pick a time first.' });
    const next = { ...repair, status: input.decline ? 'declined' as const : 'booked' as const, slot: input.decline ? '' : input.slot! };
    await saveRepair(cleaning, next);
    const [place, contractor, inspector] = await Promise.all([propertyName(cleaning), staffById(repair.contractorId), staffById(repair.inspectorId)]);
    const when = slotLabel(next.slot);
    const jobs: Promise<unknown>[] = [];
    if (next.status === 'booked') {
      jobs.push(sendSms(contractor?.phone, `La Maison: you're booked for ${when} at ${place} — ${repair.taskTitle}${repair.note ? ` (${repair.note})` : ''}.`));
      if (inspector?.phone) jobs.push(sendSms(inspector.phone, `La Maison: ${repair.trade.toLowerCase()} confirmed — ${repair.contractorName}, ${when} at ${place} for "${repair.taskTitle}".`));
      const to = [contractor?.email, inspector?.email].filter((e): e is string => !!e);
      const link = `${process.env.ZITE_APP_URL}/?job=${input.job}`;
      if (to.length) jobs.push(sendGmail(to, `Booked: ${repair.trade} at ${place} — ${when}`,
        `<p><b>${esc(repair.contractorName)}</b> is booked for <b>${esc(when)}</b> at <b>${esc(place)}</b>.</p>`
        + `<p><b>Issue found on inspection:</b> ${esc(repair.taskTitle)}</p>`
        + (repair.note ? `<p><b>Inspector's note:</b> ${esc(repair.note)}</p>` : '')
        + `<p><a href="${link}" style="display:inline-block;background:#357556;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">View or change the booking</a></p>`
        + `<p style="color:#777;font-size:13px">Reply to this email to reach La Maison.</p>`));
    } else if (inspector?.phone) {
      jobs.push(sendSms(inspector.phone, `La Maison: ${repair.contractorName} can't take "${repair.taskTitle}" at ${place}. Open the checklist to text someone else.`));
    }
    const results = await Promise.allSettled([...jobs, postSlack(next.status === 'booked'
      ? `:white_check_mark: ${repair.contractorName} booked ${when} at ${place} for "${repair.taskTitle}".`
      : `:x: ${repair.contractorName} declined "${repair.taskTitle}" at ${place}.`)]);
    results.forEach((r) => r.status === 'rejected' && console.error('Confirmation text failed', r.reason));
    return { status: next.status, slot: next.slot };
  },
});
