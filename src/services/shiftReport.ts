import 'dotenv/config';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import {
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  escapeMarkdown,
  type Client,
  type TextChannel,
} from 'discord.js';
import {
  SHIFT_CHANNEL_ID,
  SHIFT_GUILD_ID,
  SHIFT_JOB,
  SHIFT_LOGO_URL,
  SHIFT_MIN_PATROL_SECONDS,
  SHIFT_TIME_ZONE,
} from '../config/shiftReportConfig';

interface OfficerActivity {
  name: string;
  seconds: number;
  patrols: number;
}

export interface ShiftReportSnapshot {
  date: string;
  totalSeconds: number;
  activeOfficers: number;
  totalPatrols: number;
  averageOfficerSeconds: number;
  previousDaySeconds: number;
  previousWeekSeconds: number;
  topOfficers: OfficerActivity[];
}

interface PatrolRow extends RowDataPacket {
  fullname: string | null;
  total_seconds: number | string;
  patrols: number | string;
}

interface ReportRow extends RowDataPacket {
  report_date: string;
  snapshot: string | ShiftReportSnapshot;
  message_id: string | null;
}

interface DateRow extends RowDataPacket {
  report_date: string;
}

interface LockRow extends RowDataPacket {
  acquired: number | string | null;
}

const pool = mysql.createPool({
  host: process.env.IP || process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,
});

const tableName = /^[a-zA-Z0-9_]+$/.test(process.env.DB_PATROL_TABLE || '')
  ? process.env.DB_PATROL_TABLE!
  : 'duty_patrols';

const localFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SHIFT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

let initialization: Promise<void> | undefined;
let running = false;

function dateParts(date: Date) {
  const parts = localFormatter.formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function isoDay(parts: { year: number; month: number; day: number }): string {
  return String(parts.year).padStart(4, '0') + '-' +
    String(parts.month).padStart(2, '0') + '-' +
    String(parts.day).padStart(2, '0');
}

function addDays(day: string, count: number): string {
  const date = new Date(day + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function pragueMidnightSeconds(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, date);
  const local = dateParts(new Date(utcMidnight));
  const wallClockAtUtcMidnight = Date.UTC(
    local.year, local.month - 1, local.day,
    local.hour, local.minute, local.second,
  );
  const offset = wallClockAtUtcMidnight - utcMidnight;
  return Math.floor((utcMidnight - offset) / 1000);
}

export function latestDueShiftDate(now: Date = new Date()): string {
  const local = dateParts(now);
  return addDays(isoDay(local), local.hour >= 6 ? -1 : -2);
}

function displayDate(day: string): string {
  return new Date(day + 'T12:00:00.000Z').toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';
}

function formatComparisonDuration(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return '(' + hours + 'h' + (minutes ? ' ' + minutes + 'm' : '') + ')';
}

function formatTrend(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '⚪ 0.0% (no change)' : '⚪ N/A (no previous activity)';
  const percent = ((current - previous) / previous) * 100;
  const indicator = percent > 0 ? '🟢 +' : percent < 0 ? '🔴 −' : '⚪ ';
  return indicator + Math.abs(percent).toFixed(1) + '%';
}

function safeName(value: string): string {
  return escapeMarkdown(value.replace(/@/g, '＠')).slice(0, 90) || 'Unknown Officer';
}

export function buildShiftReportComponents(report: ShiftReportSnapshot) {
  const reportId = 'LSPD-SHIFT-' + report.date;
  const header = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '# 👮 LSPD | Daily Shift Report\n' +
        '**' + displayDate(report.date) + '**',
      ),
    )
    .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: SHIFT_LOGO_URL } }));

  const summary = new TextDisplayBuilder().setContent(
    '### 📊 Department Activity\n' +
    '⏱️ **Total Patrol Time:** ' + formatDuration(report.totalSeconds) + '\n' +
    '🚔 **Completed Patrols:** ' + report.totalPatrols + '\n' +
    '👮 **Active Officers:** ' + report.activeOfficers + '\n' +
    '⌛ **Average per Officer:** ' + formatDuration(report.averageOfficerSeconds),
  );

  const comparisons = new TextDisplayBuilder().setContent(
    '### 📈 Activity Comparison\n' +
    '**Previous day:** ' + formatTrend(report.totalSeconds, report.previousDaySeconds) +
    ' ' + formatComparisonDuration(report.previousDaySeconds) + '\n' +
    '**Same day last week:** ' + formatTrend(report.totalSeconds, report.previousWeekSeconds) +
    ' ' + formatComparisonDuration(report.previousWeekSeconds),
  );

  const medals = ['🥇', '🥈', '🥉'];
  const officers = report.topOfficers.map((officer, index) =>
    medals[index] + ' **' + safeName(officer.name) + '** - ' +
    formatDuration(officer.seconds) + '  (  ' +
    officer.patrols + (officer.patrols === 1 ? ' patrol' : ' patrols)'),
  );

  const leaderboard = new TextDisplayBuilder().setContent(
    '### 🏆 Top 3 Most Active Officers\n' +
    (officers.length > 0 ? officers.join('\n') : '*No completed patrols were recorded.*'),
  );

  const footer = new TextDisplayBuilder().setContent(
    '-# Automatically generated by LSPD Secretary\n' +
    '-# Report ID: ' + reportId,
  );

  const separator = () => new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);

  return [
    new ContainerBuilder()
      .setAccentColor(0x1b416b)
      .addSectionComponents(header)
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(summary)
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(comparisons)
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(leaderboard)
      .addTextDisplayComponents(footer),
  ];
}

function ensureTable(): Promise<void> {
  if (!initialization) {
    if (!process.env.DB_USER || !process.env.DB_NAME) {
      return Promise.reject(new Error('Shift reports require DB_USER and DB_NAME'));
    }

    initialization = pool.query(
      'CREATE TABLE IF NOT EXISTS lion_shift_reports (' +
      'report_date DATE NOT NULL PRIMARY KEY,' +
      'snapshot JSON NOT NULL,' +
      'message_id VARCHAR(32) NULL,' +
      'sent_at DATETIME NULL,' +
      'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' +
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    ).then(() => undefined).catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}

async function readReport(day: string): Promise<ReportRow | null> {
  const [rows] = await pool.execute<ReportRow[]>(
    'SELECT DATE_FORMAT(report_date, "%Y-%m-%d") AS report_date, snapshot, message_id ' +
    'FROM lion_shift_reports WHERE report_date = ? LIMIT 1',
    [day],
  );
  return rows[0] || null;
}

function parseSnapshot(snapshot: ReportRow['snapshot']): ShiftReportSnapshot {
  return typeof snapshot === 'string'
    ? JSON.parse(snapshot) as ShiftReportSnapshot
    : snapshot;
}

export async function latestShiftReport(): Promise<ShiftReportSnapshot | null> {
  await ensureTable();
  const [rows] = await pool.query<ReportRow[]>(
    'SELECT DATE_FORMAT(report_date, "%Y-%m-%d") AS report_date, snapshot, message_id ' +
    'FROM lion_shift_reports WHERE message_id IS NOT NULL ' +
    'ORDER BY report_date DESC LIMIT 1',
  );
  return rows[0] ? parseSnapshot(rows[0].snapshot) : null;
}

async function queryPeriod(day: string): Promise<{
  officers: OfficerActivity[];
  totalSeconds: number;
  totalPatrols: number;
}> {
  const start = pragueMidnightSeconds(day);
  const end = pragueMidnightSeconds(addDays(day, 1));
  const endExpression = 'COALESCE(NULLIF(end_time, 0), start_time + duration)';
  const overlap = 'GREATEST(0, LEAST(' + endExpression + ', ?) - GREATEST(start_time, ?))';

  const sql = [
    'SELECT identifier, MAX(fullname) AS fullname,',
    'SUM(' + overlap + ') AS total_seconds, COUNT(*) AS patrols',
    'FROM ' + tableName,
    'WHERE job = ? AND duration >= ? AND start_time < ? AND ' + endExpression + ' > ?',
    'GROUP BY identifier HAVING total_seconds > 0',
    'ORDER BY total_seconds DESC, fullname ASC',
  ].join(' ');

  const [rows] = await pool.execute<PatrolRow[]>(
    sql,
    [end, start, SHIFT_JOB, SHIFT_MIN_PATROL_SECONDS, end, start],
  );

  const officers = rows.map((row) => ({
    name: String(row.fullname || 'Unknown Officer'),
    seconds: Number(row.total_seconds || 0),
    patrols: Number(row.patrols || 0),
  }));

  return {
    officers,
    totalSeconds: officers.reduce((sum, officer) => sum + officer.seconds, 0),
    totalPatrols: officers.reduce((sum, officer) => sum + officer.patrols, 0),
  };
}

async function buildSnapshot(day: string): Promise<ShiftReportSnapshot> {
  const [current, previous, lastWeek] = await Promise.all([
    queryPeriod(day),
    queryPeriod(addDays(day, -1)),
    queryPeriod(addDays(day, -7)),
  ]);

  return {
    date: day,
    totalSeconds: current.totalSeconds,
    activeOfficers: current.officers.length,
    totalPatrols: current.totalPatrols,
    averageOfficerSeconds: current.officers.length
      ? Math.round(current.totalSeconds / current.officers.length)
      : 0,
    previousDaySeconds: previous.totalSeconds,
    previousWeekSeconds: lastWeek.totalSeconds,
    topOfficers: current.officers.slice(0, 3),
  };
}

async function latestSentDate(): Promise<string | null> {
  const [rows] = await pool.query<DateRow[]>(
    'SELECT DATE_FORMAT(report_date, "%Y-%m-%d") AS report_date ' +
    'FROM lion_shift_reports WHERE message_id IS NOT NULL ' +
    'ORDER BY report_date DESC LIMIT 1',
  );
  return rows[0]?.report_date || null;
}

async function oldestUnsentDate(): Promise<string | null> {
  const [rows] = await pool.query<DateRow[]>(
    'SELECT DATE_FORMAT(report_date, "%Y-%m-%d") AS report_date ' +
    'FROM lion_shift_reports WHERE message_id IS NULL ' +
    'ORDER BY report_date ASC LIMIT 1',
  );
  return rows[0]?.report_date || null;
}

async function findPreviouslySentMessage(
  channel: TextChannel,
  day: string,
  clientId: string,
): Promise<string | null> {
  let before: string | undefined;
  const marker = 'LSPD-SHIFT-' + day;

  for (let page = 0; page < 5; page++) {
    const messages = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!messages.size) break;

    for (const message of messages.values()) {
      if (message.author.id !== clientId) continue;
      if (JSON.stringify(message.components.map((component) => component.toJSON())).includes(marker)) {
        return message.id;
      }
    }

    before = messages.last()?.id;
    if (messages.size < 100) break;
  }
  return null;
}

async function publishDay(client: Client<true>, day: string): Promise<void> {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [locks] = await connection.query<LockRow[]>(
      'SELECT GET_LOCK(?, 1) AS acquired',
      ['lion_shift_report_' + day],
    );
    if (Number(locks[0]?.acquired) !== 1) return;
    locked = true;

    let stored = await readReport(day);
    if (stored?.message_id) return;

    if (!stored) {
      const snapshot = await buildSnapshot(day);
      await pool.execute(
        'INSERT IGNORE INTO lion_shift_reports (report_date, snapshot) VALUES (?, ?)',
        [day, JSON.stringify(snapshot)],
      );
      stored = await readReport(day);
    }

    if (!stored) throw new Error('Unable to save shift report ' + day);
    if (stored.message_id) return;

    const guild = await client.guilds.fetch(SHIFT_GUILD_ID);
    const channel = await guild.channels.fetch(SHIFT_CHANNEL_ID);
    if (!channel || !channel.isTextBased() || !('send' in channel) || !('messages' in channel)) {
      throw new Error('Shift report channel is not a message channel');
    }

    const textChannel = channel as TextChannel;
    const existing = await findPreviouslySentMessage(textChannel, day, client.user.id);
    const messageId = existing || (await textChannel.send({
      flags: MessageFlags.IsComponentsV2,
      components: buildShiftReportComponents(parseSnapshot(stored.snapshot)),
      allowedMentions: { parse: [] },
    })).id;

    await pool.execute(
      'UPDATE lion_shift_reports SET message_id = ?, sent_at = UTC_TIMESTAMP() ' +
      'WHERE report_date = ? AND message_id IS NULL',
      [messageId, day],
    );
    console.log('[ShiftReport] Report sent for ' + day + ' (' + messageId + ')');
  } finally {
    if (locked) {
      await connection.query('SELECT RELEASE_LOCK(?)', ['lion_shift_report_' + day])
        .catch((error) => console.error('[ShiftReport] Could not release lock', error));
    }
    connection.release();
  }
}

export async function processDueShiftReports(client: Client<true>): Promise<void> {
  if (running) return;
  running = true;

  try {
    await ensureTable();
    const dueDate = latestDueShiftDate();
    const [lastSent, oldestPending] = await Promise.all([
      latestSentDate(),
      oldestUnsentDate(),
    ]);

    let nextDate = lastSent ? addDays(lastSent, 1) : dueDate;
    if (oldestPending && oldestPending < nextDate) nextDate = oldestPending;

    for (let count = 0; count < 7 && nextDate <= dueDate; count++) {
      await publishDay(client, nextDate);
      nextDate = addDays(nextDate, 1);
    }
  } catch (error) {
    console.error('[ShiftReport] Failed to process scheduled reports:', error);
  } finally {
    running = false;
  }
}
