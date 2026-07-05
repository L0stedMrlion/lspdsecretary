import * as fs from "fs";
import * as path from "path";

const STORE_PATH = path.join(
  __dirname,
  "..",
  "data",
  "metro-alerts.json",
);

interface MetroAlertEntry {
  reason: string;
  senderName: string;
  senderUserId: string;
  timestamp: number;
  dmMessages: Array<{ userId: string; channelId: string; messageId: string }>;
}

let store = new Map<string, MetroAlertEntry>();

function loadStore(): Map<string, MetroAlertEntry> {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    if (!fs.existsSync(STORE_PATH)) return new Map();
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as [string, MetroAlertEntry][];
    return new Map(parsed);
  } catch {
    return new Map();
  }
}

function saveStore(): void {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(Array.from(store.entries()), null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save metro alert store:", err);
  }
}

// Initial load
store = loadStore();

export function registerMetroAlert(
  logMessageId: string,
  entry: MetroAlertEntry,
): void {
  store.set(logMessageId, entry);
  saveStore();
}

export function getMetroAlert(
  logMessageId: string,
): MetroAlertEntry | undefined {
  return store.get(logMessageId);
}

export function deleteMetroAlert(logMessageId: string): void {
  store.delete(logMessageId);
  saveStore();
}
