import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SectionBuilder,
  Role,
} from "discord.js";
import { AUTHORIZED_ROLES, LSPD_GUILD_ID, LSPD_LOGO_URL } from "../constants";
import { getUserReminders, removeReminder } from "../customReminderStore";

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
  .setName("cancelreminder")
  .setDescription("Cancel an active reminder or list your scheduled reminders.")
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription(
        "The ID of the reminder to cancel (leave empty to view all your reminders)",
      )
      .setRequired(false),
  );

export const run = async ({ interaction, client }: CommandRunParams): Promise<void> => {
  const lspdGuild = client.guilds.cache.get(LSPD_GUILD_ID);
  let hasRole = false;

  if (lspdGuild) {
    try {
      const lspdMember = await lspdGuild.members.fetch(interaction.user.id);
      hasRole = lspdMember.roles.cache.some((role: Role) =>
        AUTHORIZED_ROLES.includes(role.id),
      );
    } catch {
      hasRole = false;
    }
  }

  if (!hasRole) {
    await interaction.reply({
      content: "❌ You do not have permission to use this command!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const reminderId = interaction.options.getString("id");
  const userId = interaction.user.id;
  const userReminders = getUserReminders(userId);

  if (!reminderId) {
    if (userReminders.length === 0) {
      await interaction.reply({
        content: "ℹ️ You have no active reminders.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let embedContent = `# 📋 Your Active Reminders\n\n`;
    for (const rem of userReminders) {
      const timeStr = rem.targetDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Prague",
      });
      const dateStr = rem.targetDate.toLocaleDateString("en-US", {
        day: "numeric",
        month: "numeric",
        timeZone: "Europe/Prague",
      });

      const msgPreview =
        rem.message.length > 50
          ? rem.message.slice(0, 47) + "..."
          : rem.message;

      embedContent += `**ID: \`${rem.id}\`** | 📅 ${dateStr} at ${timeStr} | 📺 <#${rem.channelId}>\n> ${msgPreview}\n\n`;
    }
    embedContent += `To cancel a reminder, use: \`/cancelreminder id:<ID>\``;

    const textComponent = new TextDisplayBuilder().setContent(embedContent);
    const thumbnailComponent = new ThumbnailBuilder({
      media: {
        url: LSPD_LOGO_URL,
      },
    });
    const sectionComponent = new SectionBuilder()
      .addTextDisplayComponents(textComponent)
      .setThumbnailAccessory(thumbnailComponent);

    await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [sectionComponent],
    });
    return;
  }

  const reminderToCancel = userReminders.find((r) => r.id === reminderId);
  if (!reminderToCancel) {
    await interaction.reply({
      content: `❌ Reminder with ID \`${reminderId}\` was not found or does not belong to you.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  removeReminder(reminderId);

  await interaction.reply({
    content: `✅ Reminder with ID \`${reminderId}\` has been successfully cancelled.`,
    flags: MessageFlags.Ephemeral,
  });
};

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
};
