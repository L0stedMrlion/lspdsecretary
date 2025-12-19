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
    option.setName("user").setDescription("Officer name").setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("time").setDescription("Time for visit").setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("signiture")
      .setDescription("Your signiture as LSPD member")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("kancelar")
      .setDescription("Office type")
      .setRequired(true)
      .addChoices(
        { name: "Sergeant Office (MRPD)", value: "Sergeant Office (MRPD)" },
        { name: "Captain Office (MRPD)", value: "Captain Office (MRPD)" },
        { name: "Chief Office (VSPD)", value: "Captain Office (VSPD)" },
        { name: "Commander Office (VSPD)", value: "Captain Office (VSPD)" },
        { name: "Captain Office (VSPD)", value: "Captain Office (VSPD)" },
        { name: "Sergeant Office (VSPD)", value: "Sergeant Office (VSPD)" }
      )
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
        AUTHORIZED_ROLES.includes(roleId)
      );
    } else {
      hasRole = member.roles.cache.some((role: Role) =>
        AUTHORIZED_ROLES.includes(role.id)
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

Dobrý den, <@${targetUser.id}> tímto jste předvolán, aby jste se dostavil v **${time}** do ${kancelar} kanceláře k řešení služebních nesrovnalostí.

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
      PREDVOLANI_CHANNEL_ID
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

    await interaction.reply({
      content: `✅ Předvolání bylo úspěšně odesláno pro <@${targetUser.id}> na ${time} do ${kancelar} kanceláře.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error sending předvolání:", error);
    await interaction.reply({
      content: "❌ Došlo k chybě při odesílání předvolání.",
      flags: MessageFlags.Ephemeral,
    });
  }
};

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
};

