import {
  MessageFlags,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SectionBuilder,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  User,
  TextChannel,
  Role,
} from "discord.js";
import { scheduleReminder } from "../reminderStore";
import {
  persistReminder,
  removeReminder as removePersisted,
} from "../predvolaniReminderStore";

const PREDVOLANI_CHANNEL_ID: string = "1350544990576574654";

const AUTHORIZED_ROLES: string[] = [
  "1508904336627863627",
  "1508904336577794137",
  "1508904336577794132",
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
  .setName("predvolanisahp")
  .setDescription("Sends SAHP Předvolání")
  .addUserOption((option) =>
    option.setName("user").setDescription("Trooper name").setRequired(true),
  )
  .addStringOption((option) =>
    option.setName("time").setDescription("Time for visit").setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("signiture")
      .setDescription("Your signiture as SAHP member")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("kancelar")
      .setDescription("Office type")
      .setRequired(true)
      .addChoices(
        { name: "ES & HCS Office", value: "ES & HCS Office" },
        { name: "Supervisory Staff Office", value: "Supervisory Staff Office" },
      ),
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
      hasRole = member.roles.cache.some((role: Role) =>
        AUTHORIZED_ROLES.includes(role.id),
      );
    }
  }

  if (!hasRole) {
    await interaction.reply({
      content:
        "❌ Nemáte oprávnění používat tento příkaz. Pro použití musíte být supervisor!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser: User = interaction.options.getUser("user", true);
  const time: string = interaction.options.getString("time", true);
  const kancelar: string = interaction.options.getString("kancelar", true);
  const signiture: string = interaction.options.getString("signiture", true);

  const currentTime = new Date().toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });

  const embedContent = `# 🤠 SAHP Předvolání

**Fr.:** <@${interaction.user.id}>
**To.:** <@${targetUser.id}>
**Subj.:** Předvolání

Dobrý den, <@${targetUser.id}> tímto jste předvolán, abyste se dostavil v **${time}** do ${kancelar} k řešení služebních nesrovnalostí.

## Co to pro Vás znamená?
Další informace podle interních předpisů Vám nemusí být sděleny. Pokud se do 24 hodin od výzvy nedostavíte, můžete být suspendován. Jedinou výjimkou je, že e-mailově domluvíte, že se z nějakého důvodu nedokáže dostavit.

S pozdravem,
${signiture}

🤠 **San Andreas Highway Patrol**`;

  const textComponent = new TextDisplayBuilder().setContent(embedContent);

  const thumbnailComponent = new ThumbnailBuilder({
    media: {
      url: "https://cdn.discordapp.com/attachments/1518885492953714722/1519704316275851375/SAHP.png?ex=6a3e866f&is=6a3d34ef&hm=4698e31b9d6e6aacfe317d1a459844c3c4fb2483b7a7060a18097e1a2e405f30&",
    },
  });

  const sectionComponent = new SectionBuilder()
    .addTextDisplayComponents(textComponent)
    .setThumbnailAccessory(thumbnailComponent);

  try {
    const channel = (await client.channels.fetch(
      PREDVOLANI_CHANNEL_ID,
    )) as TextChannel;
    if (channel) {
      await channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [sectionComponent],
      });
    }

    try {
      await targetUser.send({
        flags: MessageFlags.IsComponentsV2,
        components: [sectionComponent],
      });
    } catch (dmError) {
      console.error(`Failed to send DM to user ${targetUser.id}:`, dmError);
    }

    const targetReminder = scheduleReminderForPredvolani(
      targetUser,
      targetUser.id,
      time,
      kancelar,
      client,
    );

    const issuerReminder = scheduleReminderForPredvolani(
      interaction.user,
      interaction.user.id,
      time,
      kancelar,
      client,
      true,
    );

    const anyReminder = targetReminder || issuerReminder;
    await interaction.editReply({
      content: `✅ Předvolání bylo úspěšně odesláno pro <@${targetUser.id}> na ${time} do ${kancelar} kanceláře.${anyReminder ? " 🔔 Připomenutí bylo nastaveno 15 minut před termínem." : ""}`,
    });
  } catch (error) {
    console.error("Error sending předvolání:", error);
    await interaction.editReply({
      content: "❌ Došlo k chybě při odesílání předvolání.",
    });
  }
};

function getPragueNowParts(now: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  offsetMs: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)!.value, 10);

  const year = get("year");
  const month = get("month") - 1;
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");

  const pragueNowUtcMs = Date.UTC(year, month, day, hour, minute, second);
  const offsetMs = pragueNowUtcMs - now.getTime();

  return { year, month, day, hour, minute, second, offsetMs };
}

function buildPragueDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  offsetMs: number,
): Date {
  const utcMs = Date.UTC(year, month, day, hour, minute, 0, 0) - offsetMs;
  return new Date(utcMs);
}

function parseTimeToDate(timeStr: string): Date | null {
  const now = new Date();
  const p = getPragueNowParts(now);
  const normalized = timeStr.trim().toLowerCase();

  // za X hodin / za X minut
  const relativeMatch = normalized.match(
    /^za\s+(\d+)\s*(hodin[au]?|hodiny|minut[au]?|minuty|h|m)$/,
  );
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const isHours = unit.startsWith("h");
    return new Date(now.getTime() + amount * (isHours ? 3600000 : 60000));
  }

  const timePartMatch = normalized.match(/(\d{1,2}):(\d{2})/);
  const hours = timePartMatch ? parseInt(timePartMatch[1], 10) : null;
  const minutes = timePartMatch ? parseInt(timePartMatch[2], 10) : null;

  if (hours === null || minutes === null) return null;

  const fullDateMatch = normalized.match(
    /^(\d{1,2})[.\s]\s*(\d{1,2})[.\s]\s*(\d{4})/,
  );
  if (fullDateMatch) {
    const day = parseInt(fullDateMatch[1], 10);
    const month = parseInt(fullDateMatch[2], 10) - 1;
    const year = parseInt(fullDateMatch[3], 10);
    return buildPragueDate(year, month, day, hours, minutes, p.offsetMs);
  }

  const dayMonthMatch = normalized.match(/^(\d{1,2})[.\s]\s*(\d{1,2})\.?/);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const month = parseInt(dayMonthMatch[2], 10) - 1;
    let year = p.year;
    const candidate = buildPragueDate(
      year,
      month,
      day,
      hours,
      minutes,
      p.offsetMs,
    );
    if (candidate.getTime() <= now.getTime()) year++;
    return buildPragueDate(year, month, day, hours, minutes, p.offsetMs);
  }

  if (normalized.startsWith("pozítří") || normalized.startsWith("pozitri")) {
    const targetDate = buildPragueDate(
      p.year,
      p.month,
      p.day + 2,
      hours,
      minutes,
      p.offsetMs,
    );
    return targetDate;
  }

  if (normalized.startsWith("zítra") || normalized.startsWith("zitra")) {
    return buildPragueDate(
      p.year,
      p.month,
      p.day + 1,
      hours,
      minutes,
      p.offsetMs,
    );
  }

  if (normalized.startsWith("dnes")) {
    return buildPragueDate(p.year, p.month, p.day, hours, minutes, p.offsetMs);
  }

  const bare = buildPragueDate(
    p.year,
    p.month,
    p.day,
    hours,
    minutes,
    p.offsetMs,
  );
  if (bare.getTime() <= now.getTime()) {
    return buildPragueDate(
      p.year,
      p.month,
      p.day + 1,
      hours,
      minutes,
      p.offsetMs,
    );
  }
  return bare;
}

export function scheduleReminderForPredvolani(
  recipient: User,
  reminderUserId: string,
  time: string,
  kancelar: string,
  client: Client,
  isIssuer: boolean = false,
  persistedId?: string,
  overrideTargetTime?: Date,
): boolean {
  const targetTime = overrideTargetTime ?? parseTimeToDate(time);
  if (!targetTime) return false;

  const body = isIssuer
    ? `# 🔔 Předvolání Reminder\n\nDobrý den <@${reminderUserId}>, za **15 minut** začíná předvolání, které jste vystavil/a pro **${kancelar}** v **${time}**.\n\n🤠 **San Andreas Highway Patrol**`
    : `# 🔔 Předvolání Reminder\n\nDobrý den <@${reminderUserId}>, za **15 minut** jste předvolán do **${kancelar}** na čas **${time}**.\n> Tyto remindery lze vypnout pomoci /predvolanireminder <Výběr - Disable/Enable Notifications>\n\n🤠 **San Andreas Highway Patrol**`;

  const reminderId =
    persistedId ??
    `${reminderUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (!persistedId) {
    persistReminder({
      id: reminderId,
      recipientId: recipient.id,
      reminderUserId,
      time,
      kancelar,
      isIssuer,
      targetTimeMs: targetTime.getTime(),
    });
  }

  const timer = scheduleReminder(reminderUserId, targetTime, async () => {
    removePersisted(reminderId);
    try {
      const text = new TextDisplayBuilder().setContent(body);
      const thumbnail = new ThumbnailBuilder({
        media: {
          url: "https://cdn.discordapp.com/attachments/1518885492953714722/1519704316275851375/SAHP.png?ex=6a3e866f&is=6a3d34ef&hm=4698e31b9d6e6aacfe317d1a459844c3c4fb2483b7a7060a18097e1a2e405f30&",
        },
      });
      const section = new SectionBuilder()
        .addTextDisplayComponents(text)
        .setThumbnailAccessory(thumbnail);

      await recipient.send({
        flags: MessageFlags.IsComponentsV2,
        components: [section],
      });
    } catch (err) {
      console.error(`Reminder DM failed for ${recipient.id}:`, err);
    }
  });

  if (timer === null) {
    removePersisted(reminderId);
    return false;
  }

  return true;
}

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
};