import {
  Client,
  Interaction,
  MessageFlags,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Role,
} from "discord.js";
import { getMetroAlert, deleteMetroAlert } from "../../metroAlertStore";

const GUILD_ID = "1350602855798669382";
const ALLOWED_ROLE_IDS = [
  "1350606847069130752",
  "1350606971954266184",
  "1350607131006468198",
  "1390949498376945724",
  "1498774873898614898",
];

const METRO_THUMBNAIL_URL =
  "https://cdn.discordapp.com/attachments/1287133753356980329/1369776850716328086/hqdefault-removebg-preview.png?ex=681d179a&is=681bc61a&hm=7d099e07be279adc9bd83cf4d373eedc015bc13ef003b4bd2eceb12a0f8da5de&";

async function hasAllowedRole(
  interaction: Interaction,
  client: Client,
): Promise<boolean> {
  let member = interaction.member;

  if (!member && interaction.guildId) {
    const guild =
      client.guilds.cache.get(interaction.guildId) ??
      (await client.guilds.fetch(interaction.guildId).catch(() => null));
    if (guild) {
      member = await guild.members.fetch(interaction.user.id).catch(() => null);
    }
  } else if (!member) {
    const guild =
      client.guilds.cache.get(GUILD_ID) ??
      (await client.guilds.fetch(GUILD_ID).catch(() => null));
    if (guild) {
      member = await guild.members.fetch(interaction.user.id).catch(() => null);
    }
  }

  if (!member) return false;

  if (Array.isArray(member.roles)) {
    return member.roles.some((roleId: string) =>
      ALLOWED_ROLE_IDS.includes(roleId),
    );
  }

  return (member.roles as any).cache.some((role: Role) =>
    ALLOWED_ROLE_IDS.includes(role.id),
  );
}

async function editDmMessages(
  client: Client,
  logMessageId: string,
  resolverUserId: string,
): Promise<void> {
  const alert = getMetroAlert(logMessageId);
  if (!alert) return;

  const resolvedTimestamp = Math.floor(Date.now() / 1000);
  const resolvedText = new TextDisplayBuilder().setContent(
    `# ✅ Metro Alert — Resolved\nZdravím.\n\nTento Metro Alert byl označen za vyřešený od **${alert.senderName}** (<@${alert.senderUserId}>) v čase <t:${resolvedTimestamp}:F>.\n\n**Důvod alertu:** ${alert.reason}\n\nAlert byl zaslán od **${alert.senderName}** (<@${alert.senderUserId}>)\n\n**🥷 LSPD Metropolitan Division**`,
  );

  const resolvedThumbnail = new ThumbnailBuilder({
    media: { url: METRO_THUMBNAIL_URL },
  });

  const resolvedSection = new SectionBuilder()
    .addTextDisplayComponents(resolvedText)
    .setThumbnailAccessory(resolvedThumbnail);

  for (const { channelId, messageId } of alert.dmMessages) {
    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isDMBased()) continue;

      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) continue;

      await message.edit({
        flags: MessageFlags.IsComponentsV2,
        components: [resolvedSection],
      });
    } catch (err) {
      console.error(`[MetroAlert] Failed to edit DM ${messageId}:`, err);
    }
  }
}

export default async function (interaction: Interaction, client: Client) {
  try {
    if (!interaction.isButton()) return;

    const { customId, message } = interaction;

    if (
      customId !== "metro_resolve" &&
      customId !== "metro_confirm_resolve" &&
      customId !== "metro_cancel_resolve"
    )
      return;

    const allowed = await hasAllowedRole(interaction, client);
    if (!allowed) {
      await interaction.reply({
        content: "❌ You do not have permission to resolve a Metro Alert.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    const oldComponents = message.components as any[];
    if (!oldComponents || oldComponents.length === 0) return;

    const section = oldComponents[0];

    if (customId === "metro_resolve") {
      const confirmButton = new ButtonBuilder()
        .setCustomId("metro_confirm_resolve")
        .setLabel("Confirm Resolve")
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId("metro_cancel_resolve")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary);

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        confirmButton,
        cancelButton,
      );

      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [section, actionRow],
      });
    }

    if (customId === "metro_cancel_resolve") {
      const resolveButton = new ButtonBuilder()
        .setCustomId("metro_resolve")
        .setLabel("✅ Resolve Alert")
        .setStyle(ButtonStyle.Success);

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        resolveButton,
      );

      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [section, actionRow],
      });
    }

    if (customId === "metro_confirm_resolve") {
      let currentContent = "";

      if (
        section.components &&
        section.components[0] &&
        section.components[0].content
      ) {
        currentContent = section.components[0].content;
      }

      const resolvedTimestamp = Math.floor(Date.now() / 1000);
      const newContent = currentContent
        ? currentContent.replace(
            "# 🥷 Metro Alert — Log",
            "# ✅ RESOLVED — Metro Alert Log",
          ) +
          `\n**Resolved by:** <@${interaction.user.id}> (<t:${resolvedTimestamp}:F>)`
        : `✅ **Metro Alert Resolved** by <@${interaction.user.id}> (<t:${resolvedTimestamp}:F>)`;

      const newTextComponent = new TextDisplayBuilder().setContent(newContent);
      const newThumbnail = new ThumbnailBuilder({
        media: { url: METRO_THUMBNAIL_URL },
      });

      const newSection = new SectionBuilder()
        .addTextDisplayComponents(newTextComponent)
        .setThumbnailAccessory(newThumbnail);

      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [newSection],
      });

      await editDmMessages(client, message.id, interaction.user.id);
      deleteMetroAlert(message.id);
    }
  } catch (error: any) {
    if (error.code === 10062) return;
    console.error("Critical error in Metro Alert buttons:", error);
  }
}
