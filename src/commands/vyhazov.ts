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

import { AUTHORIZED_ROLES, LSPD_LOGO_URL } from "../constants";

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
	.setName("dismissal")
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
	const member = interaction.member;
	let hasRole = false;

	if (member) {
		if (Array.isArray(member.roles)) {
			hasRole = member.roles.some((roleId: string) =>
				AUTHORIZED_ROLES.includes(roleId),
			);
		} else {
			hasRole = (member.roles as any).cache.some((role: Role) =>
				AUTHORIZED_ROLES.includes(role.id),
			);
		}
	}

	if (!hasRole) {
		await interaction.reply({
			content: "❌ You do not have permission to use this command!",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const targetUser: User = interaction.options.getUser("user", true);
	const reason: string = interaction.options.getString("reason", true);
	const signature: string = interaction.options.getString("signature", true);

	const embedContent = `# 👮 LSPD - Termination of Employment

**From:** <@${interaction.user.id}>
**To:** <@${targetUser.id}>
**Subj.:** Termination of Employment

Hello <@${targetUser.id}>,

we hereby officially notify you of the **termination of your employment** with the Los Santos Police Department, effective immediately.

### 📝 REASON FOR TERMINATION
> ${reason}

Sincerely,
**${signature}**

👮 **Los Santos Police Department**

---
### 🧡 OOC Addendum

Your character has been deleted; this action is final and irreversible. You are welcome to return to the project at any time and continue RP with a different character. We are providing our Discord link below should you choose to return. Thank you for your understanding and for the time you've dedicated to us 💝✨
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
						await targetMember.kick(`LSPD Termination: ${reason}`);
						kickStatus = " and the user has been kicked from the server";
					} else {
						kickStatus =
							" (however, the user could not be kicked - they likely have a higher role)";
					}
				}
			} catch (fetchError) {
				kickStatus = " (user is likely no longer on the server)";
			}
		}

		await interaction.editReply({
			content: `✅ Termination notice successfully sent to <@${targetUser.id}>${kickStatus}.`,
		});
	} catch (error) {
		console.error("Error sending dismissal DM:", error);
		await interaction.editReply({
			content:
				"❌ Failed to send message to user (they likely have DMs disabled), so they were not kicked.",
		});
	}
};

export const options: CommandOptions = {
	devOnly: false,
	deleted: false,
};
