import {
  MessageFlags,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SectionBuilder,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  TextChannel,
  Role,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { AUTHORIZED_ROLES, LSPD_LOGO_URL } from "../constants";

const CPZ_CHANNELS: Record<string, string> = {
  CPZ1SW: "1512828344016568591",
  CPZ2SW: "1512828784431206561",
  CPZ3SW: "1512828817486647437",
  CPZ4SW: "1512828842618912808",
  CPZ5SW: "1512828862818553957",
  CPZ6SW: "1512828892547776674",
  CPZ7SW: "1512828923342356510",
  CPZ8SW: "1512828947996348548",
  CPZ9SW: "1512828967575355573",
  CPZ10SW: "1512828988567982080",
  CPZ11SW: "1512829013670760458",
  CPZ12SW: "1512829042649206866",
};

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
  .setName("cpzreportswat")
  .setDescription("Submits a SWAT CPZ report")
  .addStringOption((option) =>
    option
      .setName("cpz")
      .setDescription("Select a SWAT CPZ cell")
      .setRequired(true)
      .addChoices(
        { name: "CPZ 1 (SWAT Operations)", value: "CPZ1SW" },
        { name: "CPZ 2 (SWAT Operations)", value: "CPZ2SW" },
        { name: "CPZ 3 (SWAT Operations)", value: "CPZ3SW" },
        { name: "CPZ 4 (SWAT Operations)", value: "CPZ4SW" },
        { name: "CPZ 5 (SWAT Operations)", value: "CPZ5SW" },
        { name: "CPZ 6 (SWAT Operations)", value: "CPZ6SW" },
        { name: "CPZ 7 (SWAT Operations)", value: "CPZ7SW" },
        { name: "CPZ 8 (SWAT Operations)", value: "CPZ8SW" },
        { name: "CPZ 9 (SWAT Operations)", value: "CPZ9SW" },
        { name: "CPZ 10 (SWAT Operations)", value: "CPZ10SW" },
        { name: "CPZ 11 (SWAT Operations)", value: "CPZ11SW" },
        { name: "CPZ 12 (SWAT Operations)", value: "CPZ12SW" },
      ),
  )
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("Hold Person's Name")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("dob")
      .setDescription("Date of Birth (e.g. 01/01/1990)")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("incident_id")
      .setDescription("Incident ID number")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("reason")
      .setDescription("Reason for imprisonment")
      .setRequired(true),
  );

export const run = async ({
  interaction,
  client,
  handler,
}: CommandRunParams): Promise<void> => {
  const member = interaction.member;
  let hasRole = false;

  if (member) {
    if (Array.isArray(member.roles)) {
      hasRole = member.roles.some((roleId: string) =>
        AUTHORIZED_ROLES.includes(roleId),
      );
    } else {
      hasRole = (member.roles as any).cache.some((role: Role) =>
        AUTHORIZED_ROLES.includes(role.id),
      );
    }
  }

  if (!hasRole) {
    await interaction.reply({
      content:
        "❌ You do not have permission to use this command. You must be a police officer!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const cpzKey = interaction.options.getString("cpz", true);
  const targetChannelId = CPZ_CHANNELS[cpzKey];
  const name = interaction.options.getString("name", true);
  const dob = interaction.options.getString("dob", true);
  const incidentId = interaction.options.getString("incident_id", true);
  const reason = interaction.options.getString("reason", true);

  const embedContent = `# 🔒 LSPD CPZ REPORT: ${cpzKey}

### 👤 OSOBNÍ ÚDAJE DRŽENÉ OSOBY
- **Celé Jméno:** \`${name}\`
- **Datum Narození:** \`${dob}\`
- **Číslo Incidentu v MDT:** \`#${incidentId}\`

### 📑 INFORMACE O ZADRŽENÍ
- **Místo Výkonu:** Vespucci Police Department
- **Číslo CPZ:** \`${cpzKey}\`
- **Důvod Zadržení v CPZ:** \`${reason}\`

---
**ARRESTING OFFICER:** <@${interaction.user.id}>
**ČAS ZÁPISU:** <t:${Math.floor(Date.now() / 1000)}:F>`;

  const textComponent = new TextDisplayBuilder().setContent(embedContent);

  const thumbnailComponent = new ThumbnailBuilder({
    media: {
      url: LSPD_LOGO_URL,
    },
  });

  const sectionComponent = new SectionBuilder()
    .addTextDisplayComponents(textComponent)
    .setThumbnailAccessory(thumbnailComponent);

  const resolvedButton = new ButtonBuilder()
    .setCustomId("cpz_resolve")
    .setLabel("✅ Resolved")
    .setStyle(ButtonStyle.Success);

  const actionRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    resolvedButton,
  );

  try {
    const channel = (await client.channels.fetch(
      targetChannelId,
    )) as TextChannel;
    if (channel) {
      await channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [sectionComponent, actionRow1],
      });
    }

    await interaction.editReply({
      content: `✅ CPZ Report for **${name}** has been successfully submitted to **${cpzKey}**.`,
    });
  } catch (error) {
    console.error("Error sending CPZ report:", error);
    await interaction.editReply({
      content: "❌ Error while sending CPZ report.",
    });
  }
};

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
};
