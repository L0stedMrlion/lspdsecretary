import type { Client } from "discord.js";
import type { CommandKit } from "commandkit";
import { runRoleSync } from "../../roleSync";

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export default async function (_c: Client<true>, client: Client<true>, _handler: CommandKit) {
  console.log("[RoleSync] Starting hourly role sync scheduler.");

  await runRoleSync(client);

  setInterval(() => runRoleSync(client), INTERVAL_MS);
}
