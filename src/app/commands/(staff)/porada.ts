import type { ChatInputCommandContext, CommandData, CommandMetadata } from 'commandkit';
import { showMeetingCommand } from '../../../services/meetingApprovals';

export const command: CommandData = {
  name: 'porada',
  description: 'Ovládací panel pravidelných porad LSPD',
};

export async function chatInput({ interaction }: ChatInputCommandContext): Promise<void> {
  try {
    await showMeetingCommand(interaction);
  } catch (error) {
    console.error('[Meetings] Command failed:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('Nepodařilo se načíst panel porad.');
    } else {
      await interaction.reply('Nepodařilo se načíst panel porad.');
    }
  }
}

export const metadata: CommandMetadata = {
  userPermissions: [],
  botPermissions: [],
};
