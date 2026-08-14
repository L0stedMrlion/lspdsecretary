import type { GuildMember } from "discord.js";

const GUILD_ID = "1297571085528596552";
const ROLE_ID = "1297589335092363284";

export default async function (member: GuildMember) {
  if (member.guild.id !== GUILD_ID) return;

  try {
    await member.roles.add(ROLE_ID, "Automatic join role");
  } catch (error) {
    console.error(`[AutoRole] Failed to add role to member ${member.id}:`, error);
  }
}
