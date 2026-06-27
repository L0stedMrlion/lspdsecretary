import { Client } from "discord.js";
import type { CommandKit } from "commandkit";
import {
  loadAllPersistedReminders,
  removePersistedReminder,
  addReminder,
  deleteReminderReference,
} from "../../customReminderStore";

let hasRestored = false;

export default async function (
  _c: Client<true>,
  client: Client<true>,
  _handler: CommandKit,
) {
  if (hasRestored) return;
  hasRestored = true;

  const pending = loadAllPersistedReminders();
  if (pending.length === 0) return;

  console.log(`[CustomReminder] Restoring ${pending.length} reminder(s) after restart...`);

  for (const r of pending) {
    const delay = r.targetDateMs - Date.now();

    if (delay <= 0) {
      console.log(`[CustomReminder] Skipping expired reminder ${r.id} for ${r.userId}`);
      removePersistedReminder(r.id);
      continue;
    }

    const targetDate = new Date(r.targetDateMs);
    let reminderId = r.id;

    const timeout = setTimeout(async () => {
      deleteReminderReference(reminderId);
      try {
        const channel = await client.channels.fetch(r.channelId);
        if (channel && channel.isTextBased()) {
          await (channel as any).send({ content: r.message });
        }
      } catch (err) {
        console.error(`[CustomReminder] Failed to send restored reminder ${r.id} to channel ${r.channelId}:`, err);
      }
    }, delay);

    addReminder(r.userId, r.message, targetDate, r.channelId, timeout, r.id);

    console.log(
      `[CustomReminder] Restored reminder ${r.id} for ${r.userId} — fires at ${targetDate.toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}`,
    );
  }
}
