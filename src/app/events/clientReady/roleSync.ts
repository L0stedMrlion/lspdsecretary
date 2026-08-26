import type { EventHandler } from 'commandkit';
import type { Client } from 'discord.js';
import { runRoleSync } from '../../../services/roleSync';

export const once = true;

const handler: EventHandler<'clientReady'> = async (readyClient) => {
  const client = readyClient as unknown as Client<true>;
  console.log('[RoleSync] Running startup sync to catch offline changes.');
  await runRoleSync(client);
};

export default handler;
