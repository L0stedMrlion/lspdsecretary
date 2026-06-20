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
  .setName("predvolani")
  .setDescription("Sends LSPD Předvolání")
  .addUserOption((option) =>
    option.setName("user").setDescription("Officer name").setRequired(true),
  )
  .addStringOption((option) =>
    option.setName("time").setDescription("Time for visit").setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("signiture")
      .setDescription("Your signiture as LSPD member")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("kancelar")
      .setDescription("Office type")
      .setRequired(true)
      .addChoices(
        { name: "Chief Office", value: "Chief Office" },
        { name: "Commander Office", value: "Captain Office" },
        { name: "Captain Office", value: "Captain Office" },
        { name: "Sergeant Office", value: "Sergeant Office" },
        { name: "Metro Office", value: "Metro Office" },
        { name: "Detective Office", value: "Detective Office" },
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
        "❌ Nemáte oprávnění používat tento příkaz. Pro použití musíš být supervisor!",
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

  const embedContent = `# 👮 LSPD Předvolání

**Fr.:** <@${interaction.user.id}>
**To.:** <@${targetUser.id}>
**Subj.:** Předvolání

Dobrý den, <@${targetUser.id}> tímto jste předvolán, abyste se dostavil v **${time}** do ${kancelar} k řešení služebních nesrovnalostí.

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

function parseTimeToDate(timeStr: string): Date | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  const now = new Date();

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

  const pragueYear = get("year");
  const pragueMonth = get("month") - 1;
  const pragueDay = get("day");

  const pragueNowUtcMs = Date.UTC(pragueYear, pragueMonth, pragueDay, get("hour"), get("minute"), get("second"));
  const pragueOffsetMs = pragueNowUtcMs - now.getTime();

  const pragueTargetMs = Date.UTC(pragueYear, pragueMonth, pragueDay, hours, minutes, 0, 0);
  let targetUtcMs = pragueTargetMs - pragueOffsetMs;

  if (targetUtcMs <= now.getTime()) {
    targetUtcMs += 24 * 60 * 60 * 1000;
  }

  return new Date(targetUtcMs);
}

function scheduleReminderForPredvolani(
  recipient: User,
  reminderUserId: string,
  time: string,
  kancelar: string,
  client: Client,
  isIssuer: boolean = false,
): boolean {
  const targetTime = parseTimeToDate(time);
  if (!targetTime) return false;

  const body = isIssuer
    ? `# 🔔 Předvolání Reminder\n\nDobrý den <@${reminderUserId}>, za **15 minut** začíná předvolání, které jste vystavil/a pro **${kancelar}** v **${time}**.\n\n> Tyto remindery lze vypnout pomoci /predvolanireminder <Výběr - Disable/Enable Notifications>\n\n👮 **Los Santos Police Department**`
    : `# 🔔 Předvolání Reminder\n\nDobrý den <@${reminderUserId}>, za **15 minut** jste předvolán do **${kancelar}** na čas **${time}**.\n\n> Tyto remindery lze vypnout pomoci /predvolanireminder <Výběr - Disable/Enable Notifications>\n\n👮 **Los Santos Police Department**`;

  const timer = scheduleReminder(reminderUserId, targetTime, async () => {
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

  return timer !== null;
}

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
};
