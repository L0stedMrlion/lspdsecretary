import type { CommandMetadata } from "commandkit";
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
import { scheduleReminder } from "../../../services/reminderStore";
import {
  persistReminder,
  removeReminder as removePersisted,
  registerPredvolaniTimer,
  unregisterPredvolaniTimer,
} from "../../../services/predvolaniReminderStore";

import {
  cleanLspdNickname, getLspdMember, pragueSqlDateTime,
  recordPredvolani, cancelOwnPredvolani, isPredvolaniActive,
} from '../../../services/predvolaniDb';

const PREDVOLANI_CHANNEL_ID: string = "1350544990576574654";

const AUTHORIZED_ROLES: string[] = [
  "1350408652200345610",
  "1350408503553953802",
  "1350408400437121025",
  "1350408291796127754",
  "1350407933380395008",
  "1350407752568148071",
  "1350407562025242705",
  "1350407478386495518",
];

function cleanTimeString(input: string): string {
  const match = input.match(/(\d{1,2}:\d{2})/);
  return match ? match[1] : input.trim();
}

interface CommandRunParams {
  interaction: ChatInputCommandInteraction;
  client: Client;
  handler: any;
}

export const command = new SlashCommandBuilder()
  .setName("predvolani")
  .setDescription("Issue an official LSPD summons to a member")
  .addUserOption((option) =>
    option.setName("user").setDescription("Select the member who will receive the summons").setRequired(true),
  )
  .addStringOption((option) =>
    option.setName("time").setDescription("Appointment date and time (e.g. 17:00 or zítra 17:00)").setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("signature")
      .setDescription("Your name and rank as the officer issuing the summons")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("kancelar")
      .setDescription("Select the office where the member must report")
      .setRequired(true)
      .addChoices(
        { name: "Chief Office", value: "Chief Office" },
        { name: "Commander Office", value: "Captain Office" },
        { name: "Captain Office", value: "Captain Office" },
        { name: "Sergeant Office", value: "Sergeant Office" },
        { name: "Metro Office", value: "Metro Office" },
        { name: "Detective Office", value: "Detective Office" },
      ),
  ).toJSON();

export const chatInput = async ({
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
        "❌ Nemáte oprávnění používat tento příkaz. Pro použití musíš být supervisor!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser: User = interaction.options.getUser("user", true);
  const time: string = interaction.options.getString("time", true);
  const kancelar: string = interaction.options.getString("kancelar", true);
  const signiture: string = interaction.options.getString("signature") ?? interaction.options.getString("signiture") ?? "";

  const appointmentDate = parseTimeToDate(time);
  if (!appointmentDate || !Number.isFinite(appointmentDate.getTime()) || appointmentDate.getTime() <= Date.now()) {
    await interaction.editReply({
      content: '❌ Neplatný nebo již uplynulý termín. Použijte například `17:00`, `zítra 17:00` nebo `13.11.2026 17:00`.',
    });
    return;
  }

  let nickname: string;
  try {
    const lspdMember = await getLspdMember(client, targetUser.id);
    if (!lspdMember) {
      await interaction.editReply({
        content: '❌ Předvolaný hráč musí být na LSPD Discordu (1348336228411375729), aby bylo možné načíst jeho přezdívku.',
      });
      return;
    }
    nickname = cleanLspdNickname(lspdMember.nickname ?? lspdMember.displayName);
  } catch (error) {
    console.error('Unable to fetch nickname from LSPD Discord:', error);
    await interaction.editReply({ content: '❌ Nepodařilo se načíst člena z LSPD Discordu.' });
    return;
  }

  const { eventDate, eventTime } = pragueSqlDateTime(appointmentDate);

  const embedContent = `# 👮 LSPD Předvolání

**Fr.:** <@${interaction.user.id}>
**To.:** <@${targetUser.id}>
**Subj.:** Předvolání

Dobrý den, <@${targetUser.id}> tímto jste předvolán/a, abyste se dostavil/a v **${time}** do ${kancelar} k řešení služebních nesrovnalostí.

## Co to pro Vás znamená?
Další informace podle interních předpisů Vám nemusí být sděleny. Pokud se do 24 hodin od výzvy nedostavíte, můžete být suspendován. Jedinou výjimkou je, že e-mailově domluvíte, že se z nějakého důvodu nedokáže dostavit.

S pozdravem,
${signiture}

👮 **Los Santos Police Department**`;

  const textComponent = new TextDisplayBuilder().setContent(embedContent);

  const thumbnailComponent = new ThumbnailBuilder({
    media: {
      url: "https://cdn.discordapp.com/attachments/1287133753356980329/1369380612921757766/LSPD1.png?ex=68603493&is=685ee313&hm=715794e0df178e34b0c31252e01d713f40d7f924dc2caf15d956bae6b7929ae0&",
    },
  });

  const sectionComponent = new SectionBuilder()
    .addTextDisplayComponents(textComponent)
    .setThumbnailAccessory(thumbnailComponent);

  let createdPredvolaniId: number | undefined;
  let delivered = false;
  let phase: 'database' | 'discord' = 'database';

  try {
    // Create the entry first: no untracked summon may be published.
    createdPredvolaniId = await recordPredvolani({
      discordId: targetUser.id,
      guildNickname: nickname,
      eventDate,
      eventTime,
      office: kancelar,
      createdBy: interaction.user.id,
    });

    phase = 'discord';
    try {
      const channel = await client.channels.fetch(PREDVOLANI_CHANNEL_ID);
      if (channel && channel.isTextBased() && 'send' in channel) {
        await channel.send({
          flags: MessageFlags.IsComponentsV2,
          components: [sectionComponent],
        });
        delivered = true;
      } else {
        console.error('[predvolani] Destination channel does not support sending messages:', PREDVOLANI_CHANNEL_ID);
      }
    } catch (channelError) {
      console.error('[predvolani] Failed to publish to channel:', channelError);
    }

    try {
      await targetUser.send({
        flags: MessageFlags.IsComponentsV2,
        components: [sectionComponent],
      });
      delivered = true;
    } catch (dmError) {
      console.error(`[predvolani] DM failed for user ${targetUser.id}:`, dmError);
    }

    if (!delivered) {
      throw Object.assign(new Error('Both channel message and direct message failed'), {
        code: 'PREDVOLANI_NO_DELIVERY',
      });
    }

    let targetReminder = false;
    let issuerReminder = false;
    try {
      targetReminder = scheduleReminderForPredvolani(
        targetUser, targetUser.id, time, kancelar, client,
        false, undefined, appointmentDate, createdPredvolaniId,
      );
    } catch (error) {
      console.error('[predvolani] Failed to schedule recipient reminder:', error);
    }
    try {
      issuerReminder = scheduleReminderForPredvolani(
        interaction.user, interaction.user.id, time, kancelar, client,
        true, undefined, appointmentDate, createdPredvolaniId,
      );
    } catch (error) {
      console.error('[predvolani] Failed to schedule issuer reminder:', error);
    }

    await interaction.editReply({
      content: `✅ Předvolání bylo úspěšně odesláno pro <@${targetUser.id}> na ${time} do ${kancelar} kanceláře.${targetReminder || issuerReminder ? ' 🔔 Připomenutí bylo nastaveno 15 minut před termínem.' : ''}`,
    });
  } catch (error) {
    if (createdPredvolaniId && !delivered) {
      try {
        await cancelOwnPredvolani(createdPredvolaniId, interaction.user.id);
      } catch (rollbackError) {
        console.error('[predvolani] Unable to roll back unpublished summons:', rollbackError);
      }
    }
    console.error(`[predvolani] ${phase} failure:`, error);
    const errorCode = getPredvolaniErrorCode(error);
    const reply = phase === 'database'
      ? `❌ Předvolání nebylo odesláno: chyba databáze (${errorCode}). ${databaseErrorHint(errorCode)}`
      : `❌ Předvolání se nepodařilo doručit ani do kanálu, ani do DM (${errorCode}). Podrobnosti jsou v logu bota.`;
    await interaction.editReply({ content: reply });
  }
};

function getPredvolaniErrorCode(error: unknown): string {
  const candidate = error as { code?: unknown } | null;
  return candidate && typeof candidate.code === 'string'
    ? candidate.code.slice(0, 50)
    : error instanceof Error && error.message.includes('Missing DB_USER or DB_NAME')
      ? 'DB_CONFIG_MISSING'
      : 'UNKNOWN';
}

function databaseErrorHint(code: string): string {
  switch (code) {
    case 'DB_CONFIG_MISSING':
      return 'Nastavte DB_USER a DB_NAME v prostředí kontejneru nebo v jeho .env.';
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
    case 'ENOTFOUND':
    case 'EHOSTUNREACH':
      return 'Zkontrolujte DB_HOST/IP a DB_PORT. 127.0.0.1 v Dockeru označuje samotný kontejner.';
    case 'ER_ACCESS_DENIED_ERROR':
      return 'Zkontrolujte DB_USER, DB_PASSWORD a oprávnění databázového účtu.';
    case 'ER_BAD_DB_ERROR':
    case 'ER_NO_DB_ERROR':
      return 'Zkontrolujte DB_NAME a existenci databáze.';
    case 'ER_NO_SUCH_TABLE':
    case 'ER_BAD_FIELD_ERROR':
    case 'ER_NO_DEFAULT_FOR_FIELD':
      return 'Zkontrolujte tabulku lion_predvolani a její sloupce.';
    case 'ER_TABLEACCESS_DENIED_ERROR':
    case 'ER_DBACCESS_DENIED_ERROR':
      return 'Databázový uživatel nemá potřebná práva pro tabulku lion_predvolani.';
    default:
      return 'Podrobnosti najdete v logu lspdsecretary pod [predvolani].';
  }
}

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

export function parseTimeToDate(timeStr: string): Date | null {
  const now = new Date();
  const p = getPragueNowParts(now);
  const normalized = timeStr.trim().toLowerCase();

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
    return buildPragueDate(
      p.year,
      p.month,
      p.day + 2,
      hours,
      minutes,
      p.offsetMs,
    );
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
  predvolaniId?: number,
): boolean {
  const targetTime = overrideTargetTime ?? parseTimeToDate(time);
  if (!targetTime) return false;

  const reminderId =
    persistedId ??
    `${reminderUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const cleanTime = cleanTimeString(time);

  const body = isIssuer
    ? `# 🔔 Předvolání Reminder\n\nDobrý den <@${reminderUserId}>, za **15 minut** začíná předvolání, které jste vystavil/a pro **${kancelar}** v **${cleanTime}**.\n\n> Tyto remindery lze vypnout pomoci /predvolanireminder <Výběr - Disable/Enable Notifications>\n\n👮 **Los Santos Police Department**`
    : `# 🔔 Předvolání Reminder\n\nDobrý den <@${reminderUserId}>, za **15 minut** jste předvolán/a do **${kancelar}** na čas **${cleanTime}**.\n\n> Tyto remindery lze vypnout pomoci /predvolanireminder <Výběr - Disable/Enable Notifications>\n\n👮 **Los Santos Police Department**`;

  if (!persistedId) {
    persistReminder({
      id: reminderId,
      recipientId: recipient.id,
      reminderUserId,
      time,
      kancelar,
      isIssuer,
      targetTimeMs: targetTime.getTime(),
      predvolaniId,
    });
  }

  const timer = scheduleReminder(reminderUserId, targetTime, async () => {
    unregisterPredvolaniTimer(reminderId);
    removePersisted(reminderId);
    if (predvolaniId !== undefined) {
      try {
        if (!(await isPredvolaniActive(predvolaniId))) return;
      } catch (error) {
        console.error(`Unable to check status for summon ${predvolaniId}:`, error);
        return; // fail closed; never send a possibly cancelled reminder
      }
    }

    try {
      const text = new TextDisplayBuilder().setContent(body);

      const thumbnail = new ThumbnailBuilder({
        media: {
          url: "https://cdn.discordapp.com/attachments/1287133753356980329/1369380612921757766/LSPD1.png?ex=68603493&is=685ee313&hm=715794e0df178e34b0c31252e01d713f40d7f924dc2caf15d956bae6b7929ae0&",
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

  registerPredvolaniTimer(reminderId, timer);
  return true;
}

export const metadata: CommandMetadata = {};
