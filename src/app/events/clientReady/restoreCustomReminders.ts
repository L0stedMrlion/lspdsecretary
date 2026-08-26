import type { EventHandler } from 'commandkit';
import {
  loadAllPersistedReminders,
  removePersistedReminder,
  addReminder,
  deleteReminderReference,
} from '../../../services/customReminderStore';

export const once = true;

const handler: EventHandler<'clientReady'> = async (readyClient) => {
  const pending = loadAllPersistedReminders();
  if (pending.length === 0) return;

  console.log(
    `[CustomReminder] Restoring ${pending.length} reminder(s) after restart...`,
  );

  for (const r of pending) {
    const delay = r.targetDateMs - Date.now();

    if (delay <= 0) {
      console.log(
        `[CustomReminder] Skipping expired reminder ${r.id} for ${r.userId}`,
      );
      removePersistedReminder(r.id);
      continue;
    }

    const targetDate = new Date(r.targetDateMs);
    let reminderId = r.id;

    const timeout = setTimeout(async () => {
      deleteReminderReference(reminderId);
      try {
        const channel = await readyClient.channels.fetch(r.channelId);
        if (channel && channel.isTextBased()) {
          await (channel as any).send({ content: r.message });
        }
      } catch (err) {
        console.error(
          `[CustomReminder] Failed to send restored reminder ${r.id} to channel ${r.channelId}:`,
          err,
        );
      }
    }, delay);

    addReminder(r.userId, r.message, targetDate, r.channelId, timeout, r.id);

    console.log(
      `[CustomReminder] Restored reminder ${r.id} for ${r.userId} — fires at ${targetDate.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}`,
    );
  }
};

export default handler;
