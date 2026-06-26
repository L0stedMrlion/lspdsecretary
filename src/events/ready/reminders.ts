import { Client, TextChannel } from "discord.js";
import type { CommandKit } from "commandkit";
import {
  loadRemindersFromDisk,
  registerRehydratedReminder,
  deleteReminderReference,
} from "../../reminderStore";
import { isReminderEnabled, DEBUG_MODE } from "../../reminderStore";

export default async function (
  _c: Client<true>,
  client: Client<true>,
  _handler: CommandKit,
) {
  console.log("[Reminder Loader] Rehydrating active reminders from disk...");
  const savedReminders = loadRemindersFromDisk();

  for (const rawReminder of savedReminders) {
    if (!isReminderEnabled(rawReminder.userId)) {
      console.log(
        `[Reminder Loader] Skipped ID ${rawReminder.id} — Reminders disabled for user ${rawReminder.userId}.`,
      );
      continue;
    }

    const triggerReminder = async () => {
      try {
        const channel = await client.channels
          .fetch(rawReminder.channelId)
          .catch(() => null);
        if (channel && channel instanceof TextChannel) {
          await channel.send({
            content: `🔔 <@${rawReminder.userId}> **Reminder:** ${rawReminder.message}`,
          });
        }
      } catch (err) {
        console.error(
          `[Reminder Run] Failed to execute reminder ID ${rawReminder.id}:`,
          err,
        );
      } finally {
        deleteReminderReference(rawReminder.id);
      }
    };

    let delay = 0;

    if (DEBUG_MODE) {
      console.log(
        `[Reminder Loader DEBUG] Forcing ID ${rawReminder.id} to fire in 5 seconds.`,
      );
      delay = 5_000;
    } else {
      const reminderTime = new Date(
        rawReminder.targetDate.getTime() - 15 * 60 * 1000,
      );
      delay = reminderTime.getTime() - Date.now();
    }

    if (delay <= 0) {
      console.log(
        `[Reminder Loader] ID ${rawReminder.id} missed its window while offline. Triggering now!`,
      );
      await triggerReminder();
      continue;
    }

    console.log(
      `[Reminder Loader] Rescheduled ID ${rawReminder.id} for in ${Math.round(delay / 1000)}s.`,
    );
    const freshTimeout = setTimeout(triggerReminder, delay);

    registerRehydratedReminder({
      ...rawReminder,
      timeout: freshTimeout,
    });
  }

  console.log(
    "[Reminder Loader] All persistent reminders have been successfully reloaded.",
  );
}
