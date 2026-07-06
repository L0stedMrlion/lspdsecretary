import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  User,
  Role,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
} from "discord.js";

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

export const data = new SlashCommandBuilder()
  .setName("vyhodnocesgt")
  .setDescription("Odešle vyhodnocení SGT zkoušek danému hráči")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("Hráč, kterému se odesílá vyhodnocení")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("ic_jmeno")
      .setDescription("IC Jméno kandidáta")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("vysledek")
      .setDescription("Výsledek zkoušky")
      .setRequired(true)
      .addChoices(
        { name: "Prospěl(a)", value: "Prospěl ✅" },
        { name: "Neprospěl(a)", value: "Neprospěl ❌" },
      ),
  )
  .addStringOption((option) =>
    option
      .setName("body")
      .setDescription("Počet bodů (např. 15/20)")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("podpis")
      .setDescription("Váš podpis (např. John Doe, Captain)")
      .setRequired(true),
  );

export const run = async ({
  interaction,
  client,
}: {
  interaction: ChatInputCommandInteraction;
  client: Client;
}) => {
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

  const targetUser = interaction.options.getUser("user", true);
  const icJmenoCandidate = interaction.options.getString("ic_jmeno", true);
  const vysledek = interaction.options.getString("vysledek", true);
  const body = interaction.options.getString("body", true);
  const podpis = interaction.options.getString("podpis", true);
  const poznamky =
    interaction.options.getString("poznamky") ?? "Žádné další poznámky.";

  const content = `# 📑 Vyhodnocení SGT Zkoušek

Dobrý den **${icJmenoCandidate}**,

zasíláme Vám oficiální vyhodnocení Vašich zkoušek na **Sergeant Training**.

---

## 📊 Výsledky zkoušky
**Kandidát:** ${icJmenoCandidate}
**Výsledek:** **${vysledek}**
**Bodové hodnocení:** ${body} (první hodnota je písemná zk.; druhá ústní. Poté součet)

**👥 Zkušební komise:**
- **Chief of Police** - M. Reynolds
- **Captain** - E. Russo
- **Lieutenant** - B. Holloway

---

## 📊 Statistický přehled výsledků
*Bylo hodnoceno celkem 6 účastníků.*
- **Průměr:** 19,08 bodu
- **Medián:** 19,5 bodu
- **Nejlepší výsledek:** 24 bodů
- **Rozpětí:** 11,5 bodu

---

Opravený písemný test Vám byl zaslán na e-mail se správným řešením. Pokud máte jakékoliv dotazy k výsledku, kontaktujte **M. Reynolds**.

S pozdravem,
${podpis}  

**👮 Los Santos Police Department**`;

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
    await targetUser.send({
      flags: MessageFlags.IsComponentsV2,
      components: [sectionComponent],
    });

    await interaction.editReply({
      content: `✅ Vyhodnocení SGT zkoušek bylo úspěšně odesláno uživateli **${icJmenoCandidate}**.`,
    });
  } catch (error) {
    console.error("Error sending SGT evaluation:", error);
    await interaction.editReply({
      content: `❌ Nepodařilo se odeslat vyhodnocení uživateli **${icJmenoCandidate}**. Pravděpodobně má uzavřené DM.`,
    });
  }
};

export const options = {
  devOnly: false,
  deleted: false,
};
