const { ActivityType } = require("discord.js");
import type { Client } from "discord.js";
import type { CommandKit } from "commandkit";

export default function (
  c: Client<true>,
  client: Client<true>,
  handler: CommandKit
) {
  console.log(`👮 Secretary is online.`);
  client.user.setActivity({
    name: `👮 LSPD Systems`,
    type: ActivityType.Watching,
  });
}
