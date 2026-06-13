import { Invoice, Deal } from '../models';
import { env, hasEmail } from '../env';
import { sendInvoiceEmail } from './invoiceEmail';

/**
 * Automated overdue-invoice chasing. Scans periodically (started on boot) and:
 *  1. transitions `sent` invoices past their due date to `overdue` (the app had
 *     no server-side transition for this before);
 *  2. emails a reminder for each `overdue` invoice that still has a client email,
 *     throttled to one reminder per `intervalDays` and capped at `max`.
 * Entirely best-effort — a single failure never stops the rest, and the whole
 * scheduler is a no-op when email isn't configured.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function isPastDue(dueDate: string): boolean {
  return !!dueDate && new Date(dueDate).getTime() < Date.now();
}

function dueForReminder(lastReminderAt: string, count: number): boolean {
  if (count >= env.REMINDERS.max) return false;
  if (!lastReminderAt) return true;
  return Date.now() - new Date(lastReminderAt).getTime() >= env.REMINDERS.intervalDays * DAY_MS;
}

/** One scan pass. Returns counts for logging/visibility. */
export async function runInvoiceReminders(): Promise<{ marked: number; reminded: number }> {
  if (!hasEmail) return { marked: 0, reminded: 0 };

  const candidates = await Invoice.find({ status: { $in: ['sent', 'overdue'] } });
  let marked = 0;
  let reminded = 0;

  for (const invoice of candidates) {
    try {
      const dueDate = invoice.get('dueDate') as string;
      if (!isPastDue(dueDate)) continue;

      // 1. Transition sent → overdue.
      if (invoice.get('status') === 'sent') {
        invoice.set('status', 'overdue');
        await invoice.save();
        marked++;
      }

      // 2. Send a throttled reminder.
      if (!dueForReminder(invoice.get('lastReminderAt') ?? '', invoice.get('reminderCount') ?? 0)) continue;
      const deal = invoice.get('dealId') ? await Deal.findById(invoice.get('dealId')) : null;
      const to = deal?.get('clientEmail');
      if (!deal || !to) continue;

      await sendInvoiceEmail(invoice.toJSON() as never, deal.toJSON() as never, { reminder: true });
      invoice.set('lastReminderAt', new Date().toISOString());
      invoice.set('reminderCount', (invoice.get('reminderCount') ?? 0) + 1);
      await invoice.save();
      reminded++;
    } catch (err) {
      console.error(`[reminders] invoice ${invoice.id} failed:`, (err as Error).message);
    }
  }

  if (marked || reminded) console.log(`[reminders] marked ${marked} overdue, sent ${reminded} reminders`);
  return { marked, reminded };
}

/** Start the periodic scan. No-op without email. Runs shortly after boot, then on an interval. */
export function startInvoiceReminderScheduler(): void {
  if (!hasEmail) {
    console.log('[reminders] email not configured — automated reminders disabled');
    return;
  }
  // First pass ~30s after boot so startup isn't blocked.
  setTimeout(() => { void runInvoiceReminders().catch(() => {}); }, 30_000);
  setInterval(() => { void runInvoiceReminders().catch(() => {}); }, env.REMINDERS.scanHours * 60 * 60 * 1000);
  console.log(`[reminders] scheduler started (every ${env.REMINDERS.scanHours}h)`);
}
