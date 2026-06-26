import * as fs from "fs";
import * as path from "path";

// File paths for persistence (saved in your root data/ folder)
const PREFERENCES_PATH = path.join(
  __dirname,
  "..",
  "data",
  "reminder-preferences.json",
);
const REMINDERS_STORE_PATH = path.join(
  __dirname,
  "..",
  "data",
  "active-reminders.json",
);

export const DEBUG_MODE = process.env.REMINDER_DEBUG === "true";

export interface CustomReminder {
  id: string;
  userId: string;
  message: string;
  targetDate: Date;
  channelId: string;
  timeout?: NodeJS.Timeout;
}

const activeReminders = new Map<string, CustomReminder>();
let idCounter = 1;

// ==========================================
// 1. USER PREFERENCES (ENABLE/DISABLE STATUS)
// ==========================================

function loadDisabledUsers(): Set<string> {
  try {
    fs.mkdirSync(path.dirname(PREFERENCES_PATH), { recursive: true });
    if (!fs.existsSync(PREFERENCES_PATH)) return new Set();
    const raw = fs.readFileSync(PREFERENCES_PATH, "utf-8");
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDisabledUsers(disabled: Set<string>): void {
  fs.mkdirSync(path.dirname(PREFERENCES_PATH), { recursive: true });
  fs.writeFileSync(PREFERENCES_PATH, JSON.stringify([...disabled]), "utf-8");
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

// ==========================================
// 2. ACTIVE REMINDERS (PERSISTENCE LAYER)
// ==========================================

function saveRemindersToDisk(): void {
  try {
    fs.mkdirSync(path.dirname(REMINDERS_STORE_PATH), { recursive: true });
    const dataToSave = Array.from(activeReminders.values()).map((r) => ({
      id: r.id,
      userId: r.userId,
      message: r.message,
      targetDate: r.targetDate.toISOString(),
      channelId: r.channelId,
    }));
    fs.writeFileSync(
      REMINDERS_STORE_PATH,
      JSON.stringify(dataToSave, null, 2),
      "utf-8",
    );
  } catch (error) {
    console.error("[Reminder Store] Failed to save reminders:", error);
  }
}

export function loadRemindersFromDisk(): Omit<CustomReminder, "timeout">[] {
  try {
    if (!fs.existsSync(REMINDERS_STORE_PATH)) return [];
    const raw = fs.readFileSync(REMINDERS_STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as any[];

    let maxId = 0;
    const loaded = parsed.map((item) => {
      const idNum = parseInt(item.id, 10);
      if (idNum > maxId) maxId = idNum;

      return {
        id: item.id,
        userId: item.userId,
        message: item.message,
        targetDate: new Date(item.targetDate),
        channelId: item.channelId,
      };
    });

    idCounter = maxId + 1; // Prevent ID overlap upon reboot
    return loaded;
  } catch (error) {
    console.error("[Reminder Store] Failed to load reminders:", error);
    return [];
  }
}

export function addReminder(
  userId: string,
  message: string,
  targetDate: Date,
  channelId: string,
  timeout: NodeJS.Timeout,
): string {
  const id = String(idCounter++);
  activeReminders.set(id, {
    id,
    userId,
    message,
    targetDate,
    channelId,
    timeout,
  });

  saveRemindersToDisk();
  return id;
}

export function registerRehydratedReminder(reminder: CustomReminder): void {
  activeReminders.set(reminder.id, reminder);
  saveRemindersToDisk();
}

export function removeReminder(id: string): boolean {
  const reminder = activeReminders.get(id);
  if (!reminder) return false;
  if (reminder.timeout) clearTimeout(reminder.timeout);
  activeReminders.delete(id);

  saveRemindersToDisk();
  return true;
}

export function deleteReminderReference(id: string): void {
  activeReminders.delete(id);
  saveRemindersToDisk();
}

export function getUserReminders(userId: string): CustomReminder[] {
  return Array.from(activeReminders.values()).filter(
    (r) => r.userId === userId,
  );
}
