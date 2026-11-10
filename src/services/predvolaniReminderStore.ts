import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'predvolani-reminders.json',
);

export interface PersistedPredvolaniReminder {
  id: string;
  recipientId: string;
  reminderUserId: string;
  time: string;
  kancelar: string;
  isIssuer: boolean;
  targetTimeMs: number;
  predvolaniId?: number;
}

function load(): PersistedPredvolaniReminder[] {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    if (!fs.existsSync(STORE_PATH)) return [];
    return JSON.parse(
      fs.readFileSync(STORE_PATH, 'utf-8'),
    ) as PersistedPredvolaniReminder[];
  } catch {
    return [];
  }
}

function save(reminders: PersistedPredvolaniReminder[]): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(reminders, null, 2), 'utf-8');
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

const runningReminders = new Map<string, NodeJS.Timeout>();

export function registerPredvolaniTimer(id: string, timer: NodeJS.Timeout): void {
  const old = runningReminders.get(id);
  if (old) clearTimeout(old);
  runningReminders.set(id, timer);
}

export function unregisterPredvolaniTimer(id: string): void {
  runningReminders.delete(id);
}

export function cancelRemindersForPredvolani(predvolaniId: number): void {
  const all = load();
  const removed = all.filter((r) => r.predvolaniId === predvolaniId);
  for (const reminder of removed) {
    const timer = runningReminders.get(reminder.id);
    if (timer) clearTimeout(timer);
    runningReminders.delete(reminder.id);
  }
  if (removed.length > 0) {
    save(all.filter((r) => r.predvolaniId !== predvolaniId));
  }
}
