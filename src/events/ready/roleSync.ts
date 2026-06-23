import type { Client } from "discord.js";
import type { CommandKit } from "commandkit";
import { runRoleSync } from "../../roleSync";

export default async function (
  _c: Client<true>,
  client: Client<true>,
  _handler: CommandKit,
) {
  console.log("[RoleSync] Running startup sync to catch offline changes.");
  await runRoleSync(client);
}
