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
      .setDescription("Time: 15:30 · 1.1.2026 15:30 · 10m · 1h · 2h 30m")
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

function parsePragueIntlParts(date: Date): Record<string, number> {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PRAGUE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, number>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = parseInt(p.value, 10);
      return acc;
    }, {});
}

function pragueWallTimeToUTC(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
): Date {
  const isoApprox = [
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    `T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`,
  ].join("");
  const approxUtc = new Date(isoApprox);

  const parts = parsePragueIntlParts(approxUtc);
  const pragueAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offsetMs = pragueAsUtcMs - approxUtc.getTime();

  return new Date(approxUtc.getTime() - offsetMs);
}

function getNowPragueDate(): { year: number; month: number; day: number } {
  const parts = parsePragueIntlParts(new Date());
  return { year: parts.year, month: parts.month, day: parts.day };
}

function parseTimeInput(input: string): Date | null {
  const trimmed = input.trim();

  // D.M.YYYY HH:MM or D.M.YY HH:MM
  const dateTimeMatch = trimmed.match(
    /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})$/,
  );
  if (dateTimeMatch) {
    const day = parseInt(dateTimeMatch[1], 10);
    const month = parseInt(dateTimeMatch[2], 10);
    let year = parseInt(dateTimeMatch[3], 10);
    if (year < 100) year += 2000;
    const hours = parseInt(dateTimeMatch[4], 10);
    const minutes = parseInt(dateTimeMatch[5], 10);

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hours > 23 ||
      minutes > 59
    )
      return null;

    return pragueWallTimeToUTC(year, month, day, hours, minutes);
  }

  const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (timeOnlyMatch) {
    const hours = parseInt(timeOnlyMatch[1], 10);
    const minutes = parseInt(timeOnlyMatch[2], 10);
    if (hours > 23 || minutes > 59) return null;

    const today = getNowPragueDate();
    let candidate = pragueWallTimeToUTC(
      today.year,
      today.month,
      today.day,
      hours,
      minutes,
    );

    if (candidate.getTime() <= Date.now()) {
      const nextDay = new Date(
        Date.UTC(today.year, today.month - 1, today.day + 1),
      );
      candidate = pragueWallTimeToUTC(
        nextDay.getUTCFullYear(),
        nextDay.getUTCMonth() + 1,
        nextDay.getUTCDate(),
        hours,
        minutes,
      );
    }
    return candidate;
  }

  return null;
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
    targetDate = parseTimeInput(timeInput);

    if (!targetDate) {
      await interaction.reply({
        content:
          "❌ Invalid format. Examples:\n- Relative: `10m` · `1h` · `2h 30m`\n- Time only: `15:30` (today or tomorrow)\n- Date + time: `1.1.2026 15:30`",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
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

  const formattedDate = targetDate.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
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
