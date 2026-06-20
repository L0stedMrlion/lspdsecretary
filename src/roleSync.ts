import { Client } from "discord.js";
import { TARGET_GUILD_ID, SYNC_RULES } from "./roleSyncConfig";

export async function runRoleSync(client: Client<true>): Promise<void> {
  const targetGuild = client.guilds.cache.get(TARGET_GUILD_ID);
  if (!targetGuild) {
    console.warn(
      `[RoleSync] Target guild ${TARGET_GUILD_ID} not found in cache.`,
    );
    return;
  }

  await targetGuild.members.fetch();

  const sourceGuildIds = [...new Set(SYNC_RULES.map((r) => r.sourceGuildId))];

  const sourceGuilds = new Map<
    string,
    Awaited<ReturnType<typeof targetGuild.members.fetch>>
  >();
  for (const guildId of sourceGuildIds) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.warn(
        `[RoleSync] Source guild ${guildId} not in cache — skipping.`,
      );
      continue;
    }
    sourceGuilds.set(guildId, await guild.members.fetch());
  }

  let added = 0;
  let removed = 0;

  for (const rule of SYNC_RULES) {
    const sourceMembers = sourceGuilds.get(rule.sourceGuildId);
    if (!sourceMembers) continue;

    const qualifiedUserIds = new Set(
      [...sourceMembers.values()]
        .filter((m) => m.roles.cache.has(rule.sourceRoleId))
        .map((m) => m.id),
    );

    for (const targetMember of targetGuild.members.cache.values()) {
      const shouldHave = qualifiedUserIds.has(targetMember.id);
      const hasRole = targetMember.roles.cache.has(rule.targetRoleId);

      if (shouldHave && !hasRole) {
        await targetMember.roles
          .add(rule.targetRoleId)
          .catch((err) =>
            console.error(
              `[RoleSync] Failed to add role to ${targetMember.id}: ${err.message}`,
            ),
          );
        added++;
      } else if (!shouldHave && hasRole) {
        await targetMember.roles
          .remove(rule.targetRoleId)
          .catch((err) =>
            console.error(
              `[RoleSync] Failed to remove role from ${targetMember.id}: ${err.message}`,
            ),
          );
        removed++;
      }
    }
  }

  console.log(
    `[RoleSync] Sync complete — +${added} roles added, -${removed} roles removed.`,
  );
}
