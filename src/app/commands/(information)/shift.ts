import type { ChatInputCommandContext, CommandData, CommandMetadata } from 'commandkit';
import { MessageFlags } from 'discord.js';
import { SHIFT_GUILD_ID } from '../../../config/shiftReportConfig';
import { buildShiftReportComponents, latestShiftReport } from '../../../services/shiftReport';

export const command: CommandData = {
  name: 'shift',
  description: 'Shows the latest LSPD Daily Shift Report',
};

export async function chatInput({ interaction }: ChatInputCommandContext): Promise<void> {
  if (interaction.guildId !== SHIFT_GUILD_ID) {
    await interaction.reply({
      content: '❌ This command is only available in the LSPD server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const report = await latestShiftReport();
    if (!report) {
      await interaction.editReply({
        content: '📊 No Daily Shift Report has been published yet.',
      });
      return;
    }

    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: buildShiftReportComponents(report),
    });
  } catch (error) {
    console.error('[ShiftReport] Unable to show latest report:', error);
    await interaction.editReply({
      content: '❌ Could not load the latest Daily Shift Report.',
    });
  }
}

export const metadata: CommandMetadata = {
  userPermissions: [],
  botPermissions: [],
};
