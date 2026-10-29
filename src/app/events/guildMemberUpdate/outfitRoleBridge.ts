import type { GuildMember } from "discord.js";
import { TARGET_GUILD_ID } from "../../../config/roleSyncConfig";
import { pushOutfitRoleUpdate } from "../../../services/outfitRoleBridge";

export default async function (previous: GuildMember, current: GuildMember): Promise<void> {
  if (current.guild.id !== TARGET_GUILD_ID) return;
  const before = previous.roles.cache;
  const after = current.roles.cache;
  if (before.size === after.size && before.every((_, id) => after.has(id))) return;
  await pushOutfitRoleUpdate(current.id, [...after.keys()]);
}
