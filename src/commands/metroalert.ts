import {
  MessageFlags,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SectionBuilder,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  Role,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { registerMetroAlert } from "../metroAlertStore";

const GUILD_ID = "1350602855798669382";
const METRO_ROLE_ID = "1467806169220513852";
const LOG_CHANNEL_ID = "1515479128214737047";
const ALLOWED_ROLE_IDS = [
  "1350606847069130752",
  "1350606971954266184",
  "1350607131006468198",
  "1390949498376945724",
  "1498774873898614898",
];

interface CommandRunParams {
  interaction: ChatInputCommandInteraction;
  client: Client;
  handler: any;
}

interface CommandOptions {
  devOnly: boolean;
  deleted: boolean;
}

export const data = new SlashCommandBuilder()
  .setName("alertmetro")
  .setDescription("Send Metro Alert to all users with specific role via DM")
  .addStringOption((option) =>
    option
      .setName("reason")
      .setDescription("Reason for the Metro Alert")
      .setRequired(true),
  );

export const run = async ({
  interaction,
  client,
}: CommandRunParams): Promise<void> => {
  const member = interaction.member;
  let hasPermission = false;

  if (member) {
    if (Array.isArray(member.roles)) {
      hasPermission = member.roles.some((roleId: string) =>
        ALLOWED_ROLE_IDS.includes(roleId),
      );
    } else {
      hasPermission = (member.roles as any).cache.some((role: Role) =>
        ALLOWED_ROLE_IDS.includes(role.id),
      );
    }
  }

  if (!hasPermission) {
    await interaction.reply({
      content: "❌ You do not have permission to use this command.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild =
    client.guilds.cache.get(GUILD_ID) ??
    (await client.guilds.fetch(GUILD_ID).catch(() => null));
  if (!guild) {
    await interaction.editReply({ content: "❌ Cannot access the guild." });
    return;
  }

  const reason = interaction.options.getString("reason", true);

  const metroRole =
    guild.roles.cache.get(METRO_ROLE_ID) ??
    (await guild.roles.fetch(METRO_ROLE_ID).catch(() => null));
  if (!metroRole) {
    await interaction.editReply({ content: "❌ Metro role not found." });
    return;
  }

  if (metroRole.members.size === 0) {
    await guild.members.fetch().catch(() => null);
  }

  const membersWithRole = metroRole.members;

  if (membersWithRole.size === 0) {
    await interaction.editReply({
      content: "❌ No users found with the Metro role.",
    });
    return;
  }

  const senderMember = interaction.member;
  const rawDisplayName =
    senderMember && "displayName" in senderMember
      ? senderMember.displayName
      : (senderMember as any)?.nick ||
        interaction.user.displayName ||
        interaction.user.username;

  const senderName = rawDisplayName
    .replace(/^\s*\[.*?\]\s*/, "")
    .replace(/\s*\[.*?\]\s*$/, "")
    .replace(/\s*\(.*?\)$/, "")
    .trim();

  const thumbnailUrl =
    "https://cdn.discordapp.com/attachments/1287133753356980329/1369776850716328086/hqdefault-removebg-preview.png?ex=681d179a&is=681bc61a&hm=7d099e07be279adc9bd83cf4d373eedc015bc13ef003b4bd2eceb12a0f8da5de&";

  const buildDmSection = () => {
    const text = new TextDisplayBuilder().setContent(
      `# 🥷 Metro Alert\nZdravím.\n\nTímto jste obdržel/a Metro Alert z důvodu, že **${reason}**.\n\nInformace, které jste obdržel/a nikomu **nesdělujte!** V případě, že jste dostupný/á tak prosím neprodleně respondujte.\n\nAlert byl zaslán od **${senderName}** (<@${interaction.user.id}>)\n\n**🥷 LSPD Metropolitan Division**`,
    );
    const thumbnail = new ThumbnailBuilder({ media: { url: thumbnailUrl } });
    return new SectionBuilder()
      .addTextDisplayComponents(text)
      .setThumbnailAccessory(thumbnail);
  };

  const dmResults = await Promise.allSettled(
    membersWithRole.map(async (targetMember) => {
      const msg = await targetMember.send({
        flags: MessageFlags.IsComponentsV2,
        components: [buildDmSection()],
      });
      return {
        userId: targetMember.id,
        channelId: msg.channelId,
        messageId: msg.id,
      };
    }),
  );

  const dmMessages: Array<{
    userId: string;
    channelId: string;
    messageId: string;
  }> = [];
  const successList: string[] = [];
  let failCount = 0;

  for (const result of dmResults) {
    if (result.status === "fulfilled") {
      dmMessages.push(result.value);
      successList.push(`<@${result.value.userId}>`);
    } else {
      failCount++;
    }
  }

  const resultMessage =
    `✅ Metro Alert sent to ${successList.length} users:\n${successList.join(", ")}` +
    (failCount > 0 ? `\n\n(Failed to send to ${failCount} users).` : "");

  const logText = new TextDisplayBuilder().setContent(
    `# 🥷 Metro Alert — Log\n` +
      `**Triggered by:** ${senderName} (<@${interaction.user.id}>)\n` +
      `**Reason:** ${reason}\n` +
      `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
      `**Sent to:** ${successList.length} member(s)${failCount > 0 ? ` *(${failCount} failed)*` : ""}\n`,
  );

  const logThumbnail = new ThumbnailBuilder({ media: { url: thumbnailUrl } });
  const logSection = new SectionBuilder()
    .addTextDisplayComponents(logText)
    .setThumbnailAccessory(logThumbnail);

  const resolveButton = new ButtonBuilder()
    .setCustomId("metro_resolve")
    .setLabel("✅ Resolve Alert")
    .setStyle(ButtonStyle.Success);

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    resolveButton,
  );

  try {
    const logChannel = (await client.channels.fetch(
      LOG_CHANNEL_ID,
    )) as TextChannel;
    if (logChannel) {
      const logMessage = await logChannel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [logSection, actionRow],
      });

      registerMetroAlert(logMessage.id, {
        reason,
        senderName,
        senderUserId: interaction.user.id,
        timestamp: Math.floor(Date.now() / 1000),
        dmMessages,
      });
    }
  } catch (err) {
    console.error("Failed to send Metro Alert log:", err);
  }

  await interaction.editReply({
    content:
      resultMessage.length > 2000
        ? resultMessage.substring(0, 1997) + "..."
        : resultMessage,
  });
};

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
};
