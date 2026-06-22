import * as fs from "fs";
import * as path from "path";

const STORE_PATH = path.join(__dirname, "..", "data", "predvolani-reminders.json");

export interface PersistedPredvolaniReminder {
  id: string;
  recipientId: string;
  reminderUserId: string;
  time: string;
  kancelar: string;
  isIssuer: boolean;
  targetTimeMs: number;
}

function load(): PersistedPredvolaniReminder[] {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    if (!fs.existsSync(STORE_PATH)) return [];
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as PersistedPredvolaniReminder[];
  } catch {
    return [];
  }
}

function save(reminders: PersistedPredvolaniReminder[]): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(reminders, null, 2), "utf-8");
}

export function persistReminder(reminder: PersistedPredvolaniReminder): void {
  const all = load();
  all.push(reminder);
  save(all);
}

export function removeReminder(id: string): void {
  const all = load().filter((r) => r.id !== id);
  save(all);
}

export function loadAllReminders(): PersistedPredvolaniReminder[] {
  return load();
}
