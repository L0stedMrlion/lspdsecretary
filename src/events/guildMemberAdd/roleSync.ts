import { GuildMember } from "discord.js";
import { SYNC_RULES, TARGET_GUILD_ID } from "../../roleSyncConfig";

export default async function (member: GuildMember) {
  if (member.guild.id !== TARGET_GUILD_ID) return;

  for (const rule of SYNC_RULES) {
    const sourceGuild = member.client.guilds.cache.get(rule.sourceGuildId);
    if (!sourceGuild) continue;

    const sourceMember = await sourceGuild.members
      .fetch(member.id)
      .catch(() => null);
    if (!sourceMember) continue;

    const shouldHave = sourceMember.roles.cache.has(rule.sourceRoleId);
    const hasRole = member.roles.cache.has(rule.targetRoleId);

    if (shouldHave === hasRole) continue;

    try {
      if (shouldHave) {
        await member.roles.add(rule.targetRoleId);
        console.log(`[RoleSync] + ${member.id} → ${rule.targetRoleId}`);
      } else {
        await member.roles.remove(rule.targetRoleId);
        console.log(`[RoleSync] - ${member.id} → ${rule.targetRoleId}`);
      }
    } catch (err: any) {
      console.error(
        `[RoleSync] Role sync failed for ${member.id}: ${err.message}`,
      );
    }
  }
}
