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
} from "discord.js";

const GUILD_ID = "1350602855798669382";
const METRO_ROLE_ID = "1350606847069130752";
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

  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) {
    await interaction.editReply({ content: "❌ Cannot access the guild." });
    return;
  }

  const reason = interaction.options.getString("reason", true);

  const allMembers = await guild.members.fetch().catch(() => null);
  if (!allMembers) {
    await interaction.editReply({
      content: "❌ Failed to fetch guild members.",
    });
    return;
  }

  const membersWithRole = allMembers.filter((m) =>
    m.roles.cache.has(METRO_ROLE_ID),
  );

  if (membersWithRole.size === 0) {
    await interaction.editReply({
      content: "❌ No users found with the specified role.",
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

  const textComponent = new TextDisplayBuilder().setContent(
    `# 🥷 Metro Alert\nZdravím.\n\nTímto jste obdržel/a Metro Alert z důvodu, že **${reason}**.\n\nInformace, které jste obdržel/a nikomu **nesdělujte!** V případě, že jste dostupný/á tak prosím neprodleně respondujte.\n\nAlert byl zaslán od **${senderName}** <@${interaction.user.id}>\n\n**🥷 LSPD Metropolitan Division**`,
  );

  const thumbnailComponent = new ThumbnailBuilder({
    media: {
      url: "https://cdn.discordapp.com/attachments/1287133753356980329/1369776850716328086/hqdefault-removebg-preview.png?ex=681d179a&is=681bc61a&hm=7d099e07be279adc9bd83cf4d373eedc015bc13ef003b4bd2eceb12a0f8da5de&",
    },
  });

  const sectionComponent = new SectionBuilder()
    .addTextDisplayComponents(textComponent)
    .setThumbnailAccessory(thumbnailComponent);

  let successList: string[] = [];
  let failCount = 0;

  for (const [userId, targetMember] of membersWithRole) {
    try {
      await targetMember.send({
        flags: MessageFlags.IsComponentsV2,
        components: [sectionComponent],
      });
      successList.push(`<@${userId}>`);
    } catch {
      failCount++;
    }
  }

  const resultMessage = `✅ Metro Alert sent to ${successList.length} users:\n${successList.join(", ")}${
    failCount > 0 ? `\n\n(Failed to send to ${failCount} users).` : ""
  }`;

  const logText = new TextDisplayBuilder().setContent(
    `# 📋 Metro Alert — Log\n` +
      `**Triggered by:** ${senderName} (<@${interaction.user.id}>)\n` +
      `**Reason:** ${reason}\n` +
      `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
      `**Sent to:** ${successList.length} member(s)${failCount > 0 ? ` *(${failCount} failed)*` : ""}\n`,
  );

  const logThumbnail = new ThumbnailBuilder({
    media: {
      url: "https://cdn.discordapp.com/attachments/1287133753356980329/1369776850716328086/hqdefault-removebg-preview.png?ex=681d179a&is=681bc61a&hm=7d099e07be279adc9bd83cf4d373eedc015bc13ef003b4bd2eceb12a0f8da5de&",
    },
  });

  const logSection = new SectionBuilder()
    .addTextDisplayComponents(logText)
    .setThumbnailAccessory(logThumbnail);

  try {
    const logChannel = (await client.channels.fetch(
      LOG_CHANNEL_ID,
    )) as TextChannel;
    if (logChannel) {
      await logChannel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [logSection],
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
