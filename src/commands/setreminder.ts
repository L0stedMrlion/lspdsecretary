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
import { addReminder, deleteReminderReference } from "../customReminderStore";

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
  .setName("setreminder")
  .setDescription("Set a reminder for a specific time with a custom message.")
  .addStringOption((option) =>
    option
      .setName("time")
      .setDescription("Time (e.g., 15:30 or relative like 10m, 1h, 2h 30m)")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription("The message you want to be reminded of")
      .setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription(
        "The channel where the reminder should be sent (optional)",
      )
      .setRequired(false),
  );

function parseRelativeTime(timeStr: string): number | null {
  const regex = /(\d+)\s*([smhd])/g;
  let totalMs = 0;
  let match;
  let found = false;
  while ((match = regex.exec(timeStr)) !== null) {
    found = true;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case "s":
        totalMs += value * 1000;
        break;
      case "m":
        totalMs += value * 60 * 1000;
        break;
      case "h":
        totalMs += value * 60 * 60 * 1000;
        break;
      case "d":
        totalMs += value * 24 * 60 * 60 * 1000;
        break;
    }
  }
  return found ? totalMs : null;
}

const PRAGUE_TZ = "Europe/Prague";

function parseAbsoluteTime(timeStr: string): Date | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  const now = new Date();

  const pragueNow = new Date(
    now.toLocaleString("en-US", { timeZone: PRAGUE_TZ }),
  );
  const candidate = new Date(pragueNow);
  candidate.setHours(hours, minutes, 0, 0);

  if (candidate.getTime() <= pragueNow.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }

  const utcOffset = now.getTime() - pragueNow.getTime();
  return new Date(candidate.getTime() + utcOffset);
}

export const run = async ({
  interaction,
  client,
}: CommandRunParams): Promise<void> => {
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

  const timeInput = interaction.options.getString("time", true);
  const messageInput = interaction.options.getString("message", true);
  const targetChannel = interaction.options.getChannel("channel");
  const channelId = targetChannel?.id || interaction.channelId;

  let targetDate: Date | null = null;
  const relativeMs = parseRelativeTime(timeInput);

  if (relativeMs !== null) {
    targetDate = new Date(Date.now() + relativeMs);
  } else {
    targetDate = parseAbsoluteTime(timeInput);
  }

  if (!targetDate) {
    await interaction.reply({
      content:
        "❌ Invalid time format. Use `HH:MM` (e.g., `15:30`) or a relative time (e.g., `10m`, `1h`, `2h 30m`).",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const delay = targetDate.getTime() - Date.now();
  if (delay <= 0) {
    await interaction.reply({
      content:
        "❌ The specified time has already passed. Please enter a future time.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const formattedTime = targetDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });

  const formattedDate = targetDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Prague",
  });

  let reminderId = "";

  const timeout = setTimeout(async () => {
    if (reminderId) deleteReminderReference(reminderId);
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        await (channel as any).send({
          content: `${messageInput}`,
        });
      }
    } catch (err) {
      console.error(`Failed to send reminder to channel ${channelId}:`, err);
    }
  }, delay);

  reminderId = addReminder(
    interaction.user.id,
    messageInput,
    targetDate,
    channelId,
    timeout,
  );

  const confirmEmbedContent = `# 🔔 Reminder Set\n\nYour reminder has been successfully saved (ID: **${reminderId}**) and will be sent to <#${channelId}>.\n\n**Time:** ${formattedDate} at ${formattedTime}\n**Message:**\n> ${messageInput}`;

  const textComponent = new TextDisplayBuilder().setContent(
    confirmEmbedContent,
  );
  const thumbnailComponent = new ThumbnailBuilder({
    media: {
      url: LSPD_LOGO_URL,
    },
  });
  const sectionComponent = new SectionBuilder()
    .addTextDisplayComponents(textComponent)
    .setThumbnailAccessory(thumbnailComponent);

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [sectionComponent],
  });
};

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
};
