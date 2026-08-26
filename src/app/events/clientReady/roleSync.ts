import type { EventHandler } from 'commandkit';
import { runRoleSync } from '../../../services/roleSync';

export const once = true;

const handler: EventHandler<'clientReady'> = async (readyClient) => {
  console.log('[RoleSync] Running startup sync to catch offline changes.');
  await runRoleSync(readyClient);
};

export default handler;
