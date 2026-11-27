import type { EventHandler } from 'commandkit';
import type { Client } from 'discord.js';
import { processMeetings } from '../../../services/meetingApprovals';

export const once = true;

const handler: EventHandler<'clientReady'> = (readyClient) => {
  const client = readyClient as unknown as Client<true>;
  void processMeetings(client);
  setInterval(() => { void processMeetings(client); }, 15_000);
};

export default handler;
