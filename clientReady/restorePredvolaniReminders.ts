import { Client, User } from "discord.js";
import type { CommandKit } from "commandkit";
import { loadAllReminders } from "../../predvolaniReminderStore";
import { scheduleReminderForPredvolani } from "../../commands/predvolani";

export default async function (
  _c: Client<true>,
  client: Client<true>,
  _handler: CommandKit,
) {
  const pending = loadAllReminders();
  if (pending.length === 0) return;

  console.log(`[PredvolaniReminder] Restoring ${pending.length} reminder(s) after restart...`);

  for (const r of pending) {
    const fireAt = r.targetTimeMs - 15 * 60 * 1000;
    if (fireAt <= Date.now()) {
      console.log(`[PredvolaniReminder] Skipping expired reminder ${r.id} for ${r.reminderUserId}`);
      continue;
    }

    let recipient: User | null = null;
    try {
      recipient = await client.users.fetch(r.recipientId);
    } catch {
      console.error(`[PredvolaniReminder] Could not fetch user ${r.recipientId} for reminder ${r.id}`);
      continue;
    }

    const targetTime = new Date(r.targetTimeMs);
    scheduleReminderForPredvolani(
      recipient,
      r.reminderUserId,
      r.time,
      r.kancelar,
      client,
      r.isIssuer,
      r.id,
      new Date(r.targetTimeMs),
    );

    console.log(
      `[PredvolaniReminder] Restored reminder ${r.id} for ${r.reminderUserId} — fires at ${targetTime.toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague" })}`,
    );
  }
}
