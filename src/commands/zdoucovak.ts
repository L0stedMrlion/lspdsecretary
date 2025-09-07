import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
} from "discord.js";

const TARGET_ROLE_ID = "1397492562016731227";

export const data = new SlashCommandBuilder()
  .setName("zdoucovak")
  .setDescription("Odešle oznámení o doučovacím kurzu členům s danou rolí")
  .addStringOption((option) =>
    option.setName("nazev").setDescription("Téma").setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("misto").setDescription("Místo konání").setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("cas").setDescription("Čas konání").setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("kontakt")
      .setDescription("Zodpovědná osoba / instruktor")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("dresscode")
      .setDescription("Speciální pokyny nebo dresscode (volitelné)")
      .setRequired(false)
  );

export const run = async ({
  interaction,
  client,
}: {
  interaction: ChatInputCommandInteraction;
  client: Client;
}) => {
  const nazev = interaction.options.getString("nazev", true);
  const misto = interaction.options.getString("misto", true);
  const cas = interaction.options.getString("cas", true);
  const kontakt = interaction.options.getString("kontakt", true);
  const dresscode = interaction.options.getString("dresscode") ?? "neuveden";

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: "❌ Tento příkaz lze použít pouze na serveru.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const members = await guild.members.fetch();
  const membersWithRole = members.filter((m: GuildMember) =>
    m.roles.cache.has(TARGET_ROLE_ID)
  );

  const sentResults = await Promise.allSettled(
    membersWithRole.map(async (member) => {
      const content = `# 📚 Oznámení: Doučovací kurz

Dobrý den, <@${member.user.id}>,  
dovolujeme si Vás informovat o nadcházejícím doučovacím kurzu. Bližší informace s přečtěte níže.

---

## 📝 Detaily kurzu:
- **Téma kurzu:** ${nazev}
- **Místo konání:** ${misto}
- **Čas:** ${cas}
- **Vedoucí kurzu:** ${kontakt}
- **Poznámky:** ${dresscode}

---

Vaše účast je velmi vítána a bude zaznamenána. Pokud se nemůžete zúčastnit, napište si omluvenku v https://discord.com/channels/1348336228411375729/1350545128732758068.

S pozdravem,  
**Los Santos Police Department**`;

      const textComponent = new TextDisplayBuilder().setContent(content);

      const thumbnailComponent = new ThumbnailBuilder({
        media: {
          url: "https://cdn.discordapp.com/attachments/1287133753356980329/1369380612921757766/LSPD1.png",
        },
      });

      const sectionComponent = new SectionBuilder()
        .addTextDisplayComponents(textComponent)
        .setThumbnailAccessory(thumbnailComponent);

      try {
        await member.send({
          flags: MessageFlags.IsComponentsV2,
          components: [sectionComponent],
        });
        return true;
      } catch {
        return false;
      }
    })
  );

  const successful = sentResults.filter((r) => r.status === "fulfilled").length;

  await interaction.editReply({
    content: `✅ Oznámení o doučovacím kurzu bylo odesláno **${successful}** uživatelům s rolí <@&${TARGET_ROLE_ID}>.`,
  });
};

export const options = {
  devOnly: false,
  deleted: false,
};
