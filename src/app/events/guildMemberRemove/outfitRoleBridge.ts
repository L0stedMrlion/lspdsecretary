import type { GuildMember, PartialGuildMember } from "discord.js";
import { TARGET_GUILD_ID } from "../../../config/roleSyncConfig";
import { pushOutfitRoleUpdate } from "../../../services/outfitRoleBridge";

export default async function (member: GuildMember | PartialGuildMember): Promise<void> {
  if (member.guild.id !== TARGET_GUILD_ID) return;
  await pushOutfitRoleUpdate(member.id, []);
}
