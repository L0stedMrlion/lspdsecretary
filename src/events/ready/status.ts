import { ActivityType, Client } from "discord.js";
import type { CommandKit } from "commandkit";
import { SYNC_RULES, TARGET_GUILD_ID } from "../../roleSyncConfig";

const ROTATE_INTERVAL_MS = 300_000;

function buildActivities(client: Client<true>) {
  const lspdGuild = client.guilds.cache.get(TARGET_GUILD_ID);
  const officerCount = lspdGuild?.memberCount ?? 0;

  return [
    { name: "👮 LSPD Headquarters", type: ActivityType.Watching },
    { name: "🥷 All Alerts", type: ActivityType.Watching },
    { name: `👮 ${officerCount} Police Officers`, type: ActivityType.Watching },
    { name: `⚡ All Automatizations`, type: ActivityType.Competing },
    { name: `📊 All Divisions`, type: ActivityType.Watching },
    { name: `⌛ Checking all reminders`, type: ActivityType.Watching },
  ] as const;
}

export default function (
  _c: Client<true>,
  client: Client<true>,
  _handler: CommandKit,
) {
  console.log("👮 LSPD Secretary is online.");

  let index = 0;

  const rotate = () => {
    const activities = buildActivities(client);
    client.user.setActivity(activities[index % activities.length]);
    index++;
  };

  rotate();
  setInterval(rotate, ROTATE_INTERVAL_MS);
}
