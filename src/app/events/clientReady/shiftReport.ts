import type { EventHandler } from 'commandkit';
import type { Client } from 'discord.js';
import { processDueShiftReports } from '../../../services/shiftReport';

export const once = true;

const handler: EventHandler<'clientReady'> = (readyClient) => {
  const client = readyClient as Client<true>;
  void processDueShiftReports(client);
  setInterval(() => {
    void processDueShiftReports(client);
  }, 60_000);
};

export default handler;
