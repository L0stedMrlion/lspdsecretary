import { GuildMember } from "discord.js";
import { TARGET_GUILD_ID, SYNC_RULES, type SyncRule } from "../../roleSyncConfig";

export default async function (oldMember: GuildMember, newMember: GuildMember) {
  const rules = SYNC_RULES.filter(
    (r: SyncRule) => r.sourceGuildId === newMember.guild.id,
  );
  if (rules.length === 0) return;

  const targetGuild = newMember.client.guilds.cache.get(TARGET_GUILD_ID);
  if (!targetGuild) {
    console.warn(`[RoleSync] Target guild ${TARGET_GUILD_ID} not in cache.`);
    return;
  }

  const targetMember = await targetGuild.members
    .fetch(newMember.id)
    .catch(() => null);
  if (!targetMember) return;

  for (const rule of rules) {
    if (rule.sourceGuildId !== newMember.guild.id) continue;

    const shouldHave = newMember.roles.cache.has(rule.sourceRoleId);
    const hasRole = targetMember.roles.cache.has(rule.targetRoleId);

    if (shouldHave && !hasRole) {
      await targetMember.roles
        .add(rule.targetRoleId)
        .catch((err) =>
          console.error(
            `[RoleSync] Failed to add role to ${targetMember.id}: ${err.message}`,
          ),
        );
      console.log(`[RoleSync] +role ${rule.targetRoleId} → ${targetMember.id}`);
    } else if (!shouldHave && hasRole) {
      await targetMember.roles
        .remove(rule.targetRoleId)
        .catch((err) =>
          console.error(
            `[RoleSync] Failed to remove role from ${targetMember.id}: ${err.message}`,
          ),
        );
      console.log(`[RoleSync] -role ${rule.targetRoleId} → ${targetMember.id}`);
    }
  }
}
