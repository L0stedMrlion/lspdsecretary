import type { EventHandler } from 'commandkit';
import type { User } from 'discord.js';
import {
  loadAllReminders,
  removeReminder,
} from '../../../services/predvolaniReminderStore';
import { scheduleReminderForPredvolani } from '../../commands/(staff)/predvolani';

export const once = true;

const handler: EventHandler<'clientReady'> = async (readyClient) => {
  const pending = loadAllReminders();
  if (pending.length === 0) return;

  console.log(
    `[PredvolaniReminder] Restoring ${pending.length} reminder(s) after restart...`,
  );

  for (const r of pending) {
    if (r.targetTimeMs <= Date.now()) {
      removeReminder(r.id);
      console.log(
        `[PredvolaniReminder] Removed expired reminder ${r.id} for ${r.reminderUserId}`,
      );
      continue;
    }

    let recipient: User | null = null;
    try {
      recipient = await readyClient.users.fetch(r.recipientId);
    } catch {
      console.error(
        `[PredvolaniReminder] Could not fetch user ${r.recipientId} for reminder ${r.id}`,
      );
      continue;
    }

    const restored = scheduleReminderForPredvolani(
      recipient,
      r.reminderUserId,
      r.time,
      r.kancelar,
      readyClient,
      r.isIssuer,
      r.id,
      new Date(r.targetTimeMs),
    );

    if (restored) {
      const fireAt = new Date(
        Math.max(r.targetTimeMs - 15 * 60 * 1000, Date.now()),
      );
      console.log(
        `[PredvolaniReminder] Restored reminder ${r.id} for ${r.reminderUserId} — fires at ${fireAt.toLocaleTimeString('cs-CZ', { timeZone: 'Europe/Prague' })}`,
      );
    }
  }
};

export default handler;
