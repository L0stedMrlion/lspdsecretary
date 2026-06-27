import * as fs from "fs";
import * as path from "path";

const STORE_PATH = path.join(__dirname, "..", "data", "custom-reminders.json");

export interface CustomReminder {
  id: string;
  userId: string;
  message: string;
  targetDate: Date;
  channelId: string;
  timeout: NodeJS.Timeout;
}

export interface PersistedCustomReminder {
  id: string;
  userId: string;
  message: string;
  targetDateMs: number;
  channelId: string;
}

const activeReminders = new Map<string, CustomReminder>();
let idCounter = 1;

function loadFromDisk(): PersistedCustomReminder[] {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    if (!fs.existsSync(STORE_PATH)) return [];
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as PersistedCustomReminder[];
  } catch {
    return [];
  }
}

function saveToDisk(reminders: PersistedCustomReminder[]): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(reminders, null, 2), "utf-8");
}

export function persistCustomReminder(r: PersistedCustomReminder): void {
  const all = loadFromDisk();
  const existing = all.findIndex((x) => x.id === r.id);
  if (existing !== -1) {
    all[existing] = r;
  } else {
    all.push(r);
  }
  saveToDisk(all);
}

export function removePersistedReminder(id: string): void {
  const all = loadFromDisk().filter((r) => r.id !== id);
  saveToDisk(all);
}

export function loadAllPersistedReminders(): PersistedCustomReminder[] {
  return loadFromDisk();
}

export function addReminder(
  userId: string,
  message: string,
  targetDate: Date,
  channelId: string,
  timeout: NodeJS.Timeout,
  forcedId?: string
): string {
  const id = forcedId ?? String(idCounter++);
  if (!forcedId) {
    const existing = loadFromDisk();
    const maxId = existing.reduce((max, r) => Math.max(max, parseInt(r.id, 10) || 0), 0);
    if (maxId >= idCounter) idCounter = maxId + 1;
  }

  activeReminders.set(id, { id, userId, message, targetDate, channelId, timeout });

  persistCustomReminder({ id, userId, message, targetDateMs: targetDate.getTime(), channelId });

  return id;
}

export function removeReminder(id: string): boolean {
  const reminder = activeReminders.get(id);
  if (!reminder) return false;
  clearTimeout(reminder.timeout);
  activeReminders.delete(id);
  removePersistedReminder(id);
  return true;
}

export function deleteReminderReference(id: string): void {
  activeReminders.delete(id);
  removePersistedReminder(id);
}

export function getUserReminders(userId: string): CustomReminder[] {
  return Array.from(activeReminders.values()).filter((r) => r.userId === userId);
}
