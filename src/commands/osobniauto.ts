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
	.setName("osobniauto")
	.setDescription("Sends a notification about a personal vehicle being ready")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("Select the owner of the vehicle")
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("vehicle")
			.setDescription("Vehicle name/model")
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("code")
			.setDescription("Vehicle code (plate or internal ID)")
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
			content:
				"❌ You do not have permission to use this command. You must be a supervisor/officer!",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const targetUser: User = interaction.options.getUser("user", true);
	const vehicle: string = interaction.options.getString("vehicle", true);
	const code: string = interaction.options.getString("code", true);

	const embedContent = `# 🚓 LSPD Osobní Vozidlo

**Fr.:** <@${interaction.user.id}>
**To.:** <@${targetUser.id}>
**Subj.:** Převzetí vozidla

Dobrý den, <@${targetUser.id}>,

tímto Vám oznamujeme, že Vaše vozidlo je připraveno k vyzvednutí.

### 📑 INFORMACE O VOZIDLE
- **Vozidlo:** \`${vehicle}\`
- **Kód vozidla:** \`${code}\`

*Kód nikde nesdílejte, co nejdříve ho použijte k vyzvednutí vozidla*

---

Vozidlo si vyzvednete zadáním příkazu \`/claimvehicle\` s využitím výše uvedeného kódu. Poté jej naleznete ve své garáži. V případě komplikací mě neváhejte kontaktovat.

S pozdravem
<@${interaction.user.id}>

👮 **Los Santos Police Department**`;

	const textComponent = new TextDisplayBuilder().setContent(embedContent);

	const thumbnailComponent = new ThumbnailBuilder({
		media: {
			url: LSPD_LOGO_URL,
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
			content: `✅ Oznámení o vozidle bylo úspěšně odesláno uživateli <@${targetUser.id}>. (Vozidlo: ${vehicle}, Kód: ${code})`,
		});
	} catch (error) {
		console.error("Error sending vehicle notification DM:", error);
		await interaction.editReply({
			content:
				"❌ Failed to send notification to user. They may have DMs disabled.",
		});
	}
};

export const options: CommandOptions = {
	devOnly: false,
	deleted: false,
};
