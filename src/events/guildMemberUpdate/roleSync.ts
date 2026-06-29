import { GuildMember } from "discord.js";
import { TARGET_GUILD_ID, SYNC_RULES, type SyncRule } from "../../roleSyncConfig";

export default async function (oldMember: GuildMember, newMember: GuildMember) {
  const rules = SYNC_RULES.filter(
    (r: SyncRule) => r.sourceGuildId === newMember.guild.id,
  );

  if (rules.length === 0) return;

  const targetGuild = newMember.client.guilds.cache.get(TARGET_GUILD_ID);
  if (!targetGuild) {
    console.warn(`[RoleSync] Target guild not in cache.`);
    return;
  }

  const targetMember = await targetGuild.members.fetch(newMember.id).catch(() => null);
  if (!targetMember) return;

  for (const rule of rules) {
    const shouldHave = newMember.roles.cache.has(rule.sourceRoleId);
    const hasRole = targetMember.roles.cache.has(rule.targetRoleId);

    if (shouldHave === hasRole) continue;

    try {
      if (shouldHave) {
        await targetMember.roles.add(rule.targetRoleId);
        console.log(`[RoleSync] + ${targetMember.id} → ${rule.targetRoleId}`);
      } else {
        await targetMember.roles.remove(rule.targetRoleId);
        console.log(`[RoleSync] - ${targetMember.id} → ${rule.targetRoleId}`);
      }
    } catch (err: any) {
      console.error(`[RoleSync] Role sync failed for ${targetMember.id}: ${err.message}`);
    }
  }
}
