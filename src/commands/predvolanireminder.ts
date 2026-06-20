import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	Client,
	MessageFlags,
} from 'discord.js';
import { isReminderEnabled, enableReminder, disableReminder } from '../reminderStore';

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
	.setName('predvolanireminder')
	.setDescription('Enable or disable 15-minute předvolání reminders for yourself')
	.addStringOption((option) =>
		option
			.setName('action')
			.setDescription('Enable or disable reminders')
			.setRequired(true)
			.addChoices(
				{ name: '🔔 Enable reminders', value: 'enable' },
				{ name: '🔕 Disable reminders', value: 'disable' }
			)
	);

export const run = async ({ interaction }: CommandRunParams): Promise<void> => {
	const action = interaction.options.getString('action', true);
	const userId = interaction.user.id;

	if (action === 'enable') {
		enableReminder(userId);
		await interaction.reply({
			content: '🔔 Připomenutí předvolání bylo **zapnuto**. Obdržíte DM 15 minut před termínem.',
			flags: MessageFlags.Ephemeral,
		});
	} else {
		disableReminder(userId);
		await interaction.reply({
			content: '🔕 Připomenutí předvolání bylo **vypnuto**. Již neobdržíte DM připomenutí.',
			flags: MessageFlags.Ephemeral,
		});
	}
};

export const options: CommandOptions = {
	devOnly: false,
	deleted: false,
};
