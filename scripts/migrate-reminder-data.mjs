import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const targetDirectory = path.join(projectRoot, 'data');
const legacyDirectories = [
  path.join(projectRoot, 'dist', 'data'),
  path.join(projectRoot, 'src', 'data'),
];
const reminderFiles = [
  'custom-reminders.json',
  'predvolani-reminders.json',
  'reminder-preferences.json',
];

fs.mkdirSync(targetDirectory, { recursive: true });

for (const fileName of reminderFiles) {
  const targetPath = path.join(targetDirectory, fileName);
  if (fs.existsSync(targetPath)) continue;

  const legacyPath = legacyDirectories
    .map((directory) => path.join(directory, fileName))
    .find((candidate) => fs.existsSync(candidate));

  if (!legacyPath) continue;

  fs.copyFileSync(legacyPath, targetPath, fs.constants.COPYFILE_EXCL);
  console.log(`[ReminderMigration] Preserved ${fileName} in data/.`);
}
