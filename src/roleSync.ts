import { Client, Guild, GuildMember } from "discord.js";
import { TARGET_GUILD_ID, SYNC_RULES } from "./roleSyncConfig";

async function safeFetchMembers(guild: Guild) {
  try {
    return await guild.members.fetch();
  } catch (err: any) {
    console.error(`[RoleSync] Failed to fetch members from ${guild.id}:`, err);
    return null;
  }
}

export async function runRoleSync(client: Client<true>): Promise<void> {
  const targetGuild = client.guilds.cache.get(TARGET_GUILD_ID);
  if (!targetGuild) {
    console.warn(`[RoleSync] Target guild not found in cache.`);
    return;
  }

  const sourceGuildIds = [...new Set(SYNC_RULES.map((r) => r.sourceGuildId))];

  const sourceGuildMembers = new Map<string, Map<string, GuildMember>>();

  for (const guildId of sourceGuildIds) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.warn(`[RoleSync] Source guild ${guildId} not in cache — skipping.`);
      continue;
    }

    const members = await safeFetchMembers(guild);
    if (!members) continue;

    sourceGuildMembers.set(guildId, members);
  }

  const targetMembers = await safeFetchMembers(targetGuild);
  if (!targetMembers) return;

  let added = 0;
  let removed = 0;

  for (const rule of SYNC_RULES) {
    const sourceMembers = sourceGuildMembers.get(rule.sourceGuildId);
    if (!sourceMembers) continue;

    const qualifiedUserIds = new Set(
      [...sourceMembers.values()]
        .filter((m) => m.roles.cache.has(rule.sourceRoleId))
        .map((m) => m.id),
    );

    for (const member of targetMembers.values()) {
      const shouldHave = qualifiedUserIds.has(member.id);
      const hasRole = member.roles.cache.has(rule.targetRoleId);

      if (shouldHave && !hasRole) {
        await member.roles.add(rule.targetRoleId).catch((err: any) => {
          console.error(
            `[RoleSync] Failed to add role to ${member.id}: ${err.message}`,
          );
        });
        added++;
      }

      if (!shouldHave && hasRole) {
        await member.roles.remove(rule.targetRoleId).catch((err: any) => {
          console.error(
            `[RoleSync] Failed to remove role from ${member.id}: ${err.message}`,
          );
        });
        removed++;
      }
    }
  }

  console.log(
    `[RoleSync] Sync complete — +${added} roles added, -${removed} roles removed.`,
  );
}
