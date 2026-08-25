import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const legacyPath = path.join(root, "dist", "data", "predvolani-reminders.json");
const dataDir = path.join(root, "data");
const persistentPath = path.join(dataDir, "predvolani-reminders.json");

if (!fs.existsSync(legacyPath)) process.exit(0);

fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(persistentPath)) {
  fs.copyFileSync(legacyPath, persistentPath);
  console.log("[PredvolaniReminder] Migrated reminder storage out of dist before build.");
  process.exit(0);
}

try {
  const legacy = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
  const current = JSON.parse(fs.readFileSync(persistentPath, "utf8"));

  if (!Array.isArray(legacy) || !Array.isArray(current)) process.exit(0);

  const byId = new Map(current.map((reminder) => [reminder.id, reminder]));

  for (const reminder of legacy) {
    if (reminder?.id && !byId.has(reminder.id)) {
      byId.set(reminder.id, reminder);
    }
  }

  fs.writeFileSync(
    persistentPath,
    JSON.stringify([...byId.values()], null, 2),
    "utf8",
  );

  console.log("[PredvolaniReminder] Merged legacy reminder storage before build.");
} catch (error) {
  console.error("[PredvolaniReminder] Could not migrate legacy reminder storage:", error);
  process.exitCode = 1;
}
