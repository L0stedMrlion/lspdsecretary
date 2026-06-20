import * as fs from "fs";
import * as path from "path";

const STORE_PATH = path.join(
  __dirname,
  "..",
  "data",
  "reminder-preferences.json",
);

export const DEBUG_MODE = process.env.REMINDER_DEBUG === "true";

function loadDisabledUsers(): Set<string> {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    if (!fs.existsSync(STORE_PATH)) return new Set();
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDisabledUsers(disabled: Set<string>): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify([...disabled]), "utf-8");
}

const disabledUsers = loadDisabledUsers();

export function isReminderEnabled(userId: string): boolean {
  return !disabledUsers.has(userId);
}

export function disableReminder(userId: string): void {
  disabledUsers.add(userId);
  saveDisabledUsers(disabledUsers);
}

export function enableReminder(userId: string): void {
  disabledUsers.delete(userId);
  saveDisabledUsers(disabledUsers);
}

export function scheduleReminder(
  userId: string,
  targetTime: Date,
  callback: () => void,
  debugLabel?: string,
): NodeJS.Timeout | null {
  if (!isReminderEnabled(userId)) {
    if (DEBUG_MODE)
      console.log(`[Reminder] Skipped for ${userId} — reminders disabled.`);
    return null;
  }

  if (DEBUG_MODE) {
    const label = debugLabel ?? userId;
    console.log(
      `[Reminder DEBUG] Firing in 5s for ${label} (real target: ${targetTime.toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague" })})`,
    );
    return setTimeout(callback, 5_000);
  }

  const reminderTime = new Date(targetTime.getTime() - 15 * 60 * 1000);
  const delay = reminderTime.getTime() - Date.now();

  if (delay <= 0) {
    console.log(`[Reminder] Skipped for ${userId} — time already passed.`);
    return null;
  }

  console.log(
    `[Reminder] Scheduled for ${userId} at ${reminderTime.toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague" })} (in ${Math.round(delay / 1000)}s)`,
  );
  return setTimeout(callback, delay);
}
