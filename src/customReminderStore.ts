export interface CustomReminder {
  id: string;
  userId: string;
  message: string;
  targetDate: Date;
  channelId: string;
  timeout: NodeJS.Timeout;
}

const activeReminders = new Map<string, CustomReminder>();
let idCounter = 1;

export function addReminder(
  userId: string,
  message: string,
  targetDate: Date,
  channelId: string,
  timeout: NodeJS.Timeout
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
  return id;
}

export function removeReminder(id: string): boolean {
  const reminder = activeReminders.get(id);
  if (!reminder) return false;
  clearTimeout(reminder.timeout);
  activeReminders.delete(id);
  return true;
}

export function deleteReminderReference(id: string): void {
  activeReminders.delete(id);
}

export function getUserReminders(userId: string): CustomReminder[] {
  return Array.from(activeReminders.values()).filter(
    (r) => r.userId === userId
  );
}
