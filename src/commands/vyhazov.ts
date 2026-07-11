import {
  MessageFlags,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SectionBuilder,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  User,
  Role,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { LSPD_LOGO_URL } from "../constants";

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
  .setName("vyhazov")
  .setDescription("Sends an official notice of employment termination")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The player to whom the notice will be sent")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("reason")
      .setDescription("The reason for termination of employment")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("signature")
      .setDescription("Your signature (e.g., Name and Rank)")
      .setRequired(true),
  );

export const run = async ({
  interaction,
  client,
  handler,
}: CommandRunParams): Promise<void> => {
  if (interaction.user.id !== "710549603216261141") {
    await interaction.reply({
      content: "❌ You do not have permission to use this command.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser: User = interaction.options.getUser("user", true);
  const reason: string = interaction.options.getString("reason", true);
  const signature: string = interaction.options.getString("signature", true);

  const embedContent = `# 👮 LSPD - Ukončení pracovního poměru

**Fr.:** <@${interaction.user.id}>
**To.:** <@${targetUser.id}>
**Subj.:** Ukončení pracovního poměru

Dobrý den, <@${targetUser.id}>,

tímto Vám oficiálně oznamujeme **ukončení Vašeho pracovního poměru** u Los Santos Police Department s okamžitou platností.

### 📝 DŮVOD UKONČENÍ
> ${reason}

S pozdravem,
**${signature}**

👮 **Los Santos Police Department**

---
### 🧡 OOC Dodatek

Vaše postava byla smazána a tato akce byla definitivní a nelze navrátit. Kdykoliv se můžete na projekt vrátit a pokračovat v RP za jinou postavu. Níže vám zasíláme Discord, pokud by jste se rozhodl vrátit. Děkujeme za pochopení a čas, který jste nám věnoval 💝✨
`;

  const textComponent = new TextDisplayBuilder().setContent(embedContent);

  const thumbnailComponent = new ThumbnailBuilder({
    media: {
      url: LSPD_LOGO_URL,
    },
  });

  const sectionComponent = new SectionBuilder()
    .addTextDisplayComponents(textComponent)
    .setThumbnailAccessory(thumbnailComponent);

  const discordButton = new ButtonBuilder()
    .setLabel("🦁 Lion Police RP Discord")
    .setStyle(ButtonStyle.Link)
    .setURL("https://discord.gg/rrZ7RpEUkb");

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    discordButton,
  );

  try {
    await targetUser.send({
      flags: MessageFlags.IsComponentsV2,
      components: [sectionComponent, actionRow],
    });

    let kickStatus = "";
    if (interaction.guild) {
      try {
        const targetMember = await interaction.guild.members.fetch(
          targetUser.id,
        );
        if (targetMember) {
          if (targetMember.kickable) {
            await targetMember.kick(`LSPD Vyhazov: ${reason}`);
            kickStatus = " a uživatel byl vyhozen ze serveru";
          } else {
            kickStatus =
              " (uživatele však nebylo možné vyhodit - pravděpodobně má vyšší roli)";
          }
        }
      } catch (fetchError) {
        kickStatus = " (uživatel již pravděpodobně není na serveru)";
      }
    }

    await interaction.editReply({
      content: `✅ Oznámení o vyhazovu bylo úspěšně odesláno uživateli <@${targetUser.id}>${kickStatus}.`,
    });
  } catch (error) {
    console.error("Error sending dismissal DM:", error);
    await interaction.editReply({
      content:
        "❌ Nepodařilo se odeslat zprávu uživateli (pravděpodobně má vypnuté DM), tudíž nebyl ani vyhozen.",
    });
  }
};

export const options: CommandOptions = {
  devOnly: false,
  deleted: false,
};
