import 'dotenv/config';
import mysql, { type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import type { Client, GuildMember } from 'discord.js';
import { LSPD_GUILD_ID } from '../config/constants';

const pool = mysql.createPool({
  host: process.env.IP || process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,
});

export interface PredvolaniRecord extends RowDataPacket {
  id: number;
  discord_id: string;
  guild_nickname: string;
  event_date: string;
  event_time: string;
  reason: string | null;
}

export function cleanLspdNickname(nickname: string): string {
  return nickname
    .replace(/^\s*(?:\[[^\]\r\n]{1,35}\]\s*)+/u, '')
    .replace(/(?:\s*\([^()\r\n]{1,64}\)\s*)+$/u, '')
    .replace(/\s+/gu, ' ')
    .trim() || nickname.trim();
}

export async function getLspdMember(client: Client, userId: string): Promise<GuildMember | null> {
  const guild = await client.guilds.fetch(LSPD_GUILD_ID);
  return guild.members.fetch(userId).catch(() => null);
}

export function pragueSqlDateTime(date: Date): { eventDate: string; eventTime: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    eventDate: `${value('year')}-${value('month')}-${value('day')}`,
    eventTime: `${value('hour')}:${value('minute')}`,
  };
}

export function czechDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

let initialization: Promise<void> | undefined;

export function ensurePredvolaniTable(): Promise<void> {
  if (!process.env.DB_USER || !process.env.DB_NAME) {
    return Promise.reject(new Error('Missing DB_USER or DB_NAME in .env'));
  }
  if (!initialization) {
    initialization = (async () => {
      try {
        await pool.query('SELECT 1 FROM lion_predvolani LIMIT 0');
        return;
      } catch (error) {
        if ((error as { code?: string }).code !== 'ER_NO_SUCH_TABLE') throw error;
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lion_predvolani (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          discord_id VARCHAR(20) NOT NULL,
          guild_nickname VARCHAR(100) NOT NULL,
          event_date DATE NOT NULL,
          event_time CHAR(5) NOT NULL,
          reason TEXT NULL,
          status VARCHAR(12) NOT NULL DEFAULT 'active',
          created_by VARCHAR(20) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          cancelled_by VARCHAR(20) NULL,
          cancelled_at TIMESTAMP NULL,
          INDEX idx_predvolani_active (status, event_date, event_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}

export async function recordPredvolani(input: {
  discordId: string;
  guildNickname: string;
  eventDate: string;
  eventTime: string;
  office: string;
  createdBy: string;
}): Promise<number> {
  await ensurePredvolaniTable();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO lion_predvolani
      (discord_id, guild_nickname, event_date, event_time, reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [input.discordId, input.guildNickname.slice(0, 100), input.eventDate,
      input.eventTime, input.office, input.createdBy],
  );
  return result.insertId;
}

const fields = `id, discord_id, guild_nickname,
  DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date, event_time, reason`;

export async function listOwnActivePredvolani(issuerId: string): Promise<PredvolaniRecord[]> {
  await ensurePredvolaniTable();
  const [rows] = await pool.execute<PredvolaniRecord[]>(
    `SELECT ${fields} FROM lion_predvolani WHERE status = 'active' AND created_by = ?
      ORDER BY event_date, event_time, id LIMIT 500`,
    [issuerId],
  );
  return rows;
}

export async function getOwnActivePredvolani(id: number, issuerId: string): Promise<PredvolaniRecord | null> {
  await ensurePredvolaniTable();
  const [rows] = await pool.execute<PredvolaniRecord[]>(
    `SELECT ${fields} FROM lion_predvolani
      WHERE id = ? AND created_by = ? AND status = 'active' LIMIT 1`,
    [id, issuerId],
  );
  return rows[0] ?? null;
}

export async function cancelOwnPredvolani(id: number, issuerId: string): Promise<boolean> {
  await ensurePredvolaniTable();
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE lion_predvolani SET status='cancelled', cancelled_by=?, cancelled_at=CURRENT_TIMESTAMP
      WHERE id=? AND created_by=? AND status='active'`,
    [issuerId, id, issuerId],
  );
  return result.affectedRows === 1;
}

export async function isPredvolaniActive(id: number): Promise<boolean> {
  await ensurePredvolaniTable();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM lion_predvolani WHERE id = ? AND status = 'active' LIMIT 1`,
    [id],
  );
  return rows.length > 0;
}
