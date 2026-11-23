import { LSPD_GUILD_ID } from './constants';

export const SHIFT_GUILD_ID = LSPD_GUILD_ID;
export const SHIFT_CHANNEL_ID = process.env.SHIFT_REPORT_CHANNEL_ID || '1350406951967785014';
export const SHIFT_TIME_ZONE = 'Europe/Prague';
export const SHIFT_JOB = 'police';
export const SHIFT_MIN_PATROL_SECONDS = 300;
export const SHIFT_LOGO_URL =
  process.env.SHIFT_REPORT_LOGO_URL ||
  'https://cdn.discordapp.com/attachments/1287133753356980329/1369380612921757766/LSPD1.png';
