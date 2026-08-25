import { Client, User } from "discord.js";
import type { CommandKit } from "commandkit";
import {
  loadAllReminders,
  removeReminder,
} from "../../../services/predvolaniReminderStore";
import { scheduleReminderForPredvolani } from "../../commands/(staff)/predvolani";

let hasRestored = false;

export default async function (
  _c: Client<true>,
  client: Client<true>,
  _handler: CommandKit,
) {
  if (hasRestored) return;
  hasRestored = true;

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
      recipient = await client.users.fetch(r.recipientId);
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
      client,
      r.isIssuer,
      r.id,
      new Date(r.targetTimeMs),
    );

    if (restored) {
      const fireAt = new Date(
        Math.max(r.targetTimeMs - 15 * 60 * 1000, Date.now()),
      );
      console.log(
        `[PredvolaniReminder] Restored reminder ${r.id} for ${r.reminderUserId} — fires at ${fireAt.toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague" })}`,
      );
    }
  }
}
