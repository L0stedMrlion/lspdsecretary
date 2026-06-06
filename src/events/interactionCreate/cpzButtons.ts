import {
  Interaction,
  MessageFlags,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { LSPD_LOGO_URL } from "../../constants";

export default async function (interaction: Interaction) {
  try {
    if (!interaction.isButton()) return;

    const { customId, message } = interaction;

    if (customId === "cpz_resolve") {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }

      const oldComponents = message.components as any[];
      if (!oldComponents || oldComponents.length === 0) return;

      try {
        const section = oldComponents[0];

        const confirmButton = new ButtonBuilder()
          .setCustomId("cpz_confirm_resolve")
          .setLabel("Confirm Resolve")
          .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
          .setCustomId("cpz_cancel_resolve")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          confirmButton,
          cancelButton,
        );

        await interaction.editReply({
          content: "",
          flags: MessageFlags.IsComponentsV2,
          components: [section, actionRow],
        });
      } catch (error) {
        console.error("Error preparing confirm/cancel for CPZ report:", error);
      }
    }

    if (customId === "cpz_cancel_resolve") {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }

      const oldComponents = message.components as any[];
      if (!oldComponents || oldComponents.length === 0) return;

      try {
        const section = oldComponents[0];

        const resolvedButton = new ButtonBuilder()
          .setCustomId("cpz_resolve")
          .setLabel("✅ Resolved")
          .setStyle(ButtonStyle.Success);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          resolvedButton,
        );

        await interaction.editReply({
          content: "",
          flags: MessageFlags.IsComponentsV2,
          components: [section, actionRow],
        });
      } catch (error) {
        console.error("Error cancelling CPZ resolve:", error);
      }
    }

    if (customId === "cpz_confirm_resolve") {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }

      const oldComponents = message.components as any[];
      if (!oldComponents || oldComponents.length === 0) return;

      try {
        const section = oldComponents[0];
        let currentContent = "";

        if (
          section.components &&
          section.components[0] &&
          section.components[0].content
        ) {
          currentContent = section.components[0].content;
        }

        if (currentContent) {
          let newContent = currentContent.replace(
            "# 🔒 LSPD CPZ REPORT",
            "# ✅ RESOLVED LSPD CPZ REPORT",
          );

          newContent += `\n**VYŘEŠIL:** <@${interaction.user.id}>`;

          const newTextComponent = new TextDisplayBuilder().setContent(
            newContent,
          );
          const newThumbnail = new ThumbnailBuilder({
            media: { url: LSPD_LOGO_URL },
          });

          const newSection = new SectionBuilder()
            .addTextDisplayComponents(newTextComponent)
            .setThumbnailAccessory(newThumbnail);

          await interaction.editReply({
            content: "",
            flags: MessageFlags.IsComponentsV2,
            components: [newSection],
          });
        } else {
          await interaction.editReply({
            content: "✅ **Report Resolved**",
            components: [],
          });
        }
      } catch (error) {
        console.error("Error confirming CPZ report resolution:", error);
        await interaction
          .editReply({
            content: "✅ **Report Resolved (Fallback)**",
            components: [],
          })
          .catch(() => {});
      }
    }
  } catch (error: any) {
    if (error.code === 10062) return;
    console.error("Critical error in CPZ buttons:", error);
  }
}
