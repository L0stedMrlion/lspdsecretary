import type { Interaction } from 'discord.js';
import { handleMeetingInteraction } from '../../../services/meetingApprovals';

export default async function (interaction: Interaction) {
  await handleMeetingInteraction(interaction);
}
