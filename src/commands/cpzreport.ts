import {
	MessageFlags,
	TextDisplayBuilder,
	ThumbnailBuilder,
	SectionBuilder,
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	Client,
	TextChannel,
	Role,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from "discord.js";

import { AUTHORIZED_ROLES, LSPD_LOGO_URL } from "../constants";

const CPZ_CHANNELS: Record<string, string> = {
	CPZ1: "1485091412763607051",
	CPZ2: "1485091432040628354",
	CPZ3: "1485091451049218168",
	CPZ4: "1485091476114378795",
	CPZ5: "1485091490781859951",
	CPZ6: "1485091515826049145",
	CPZ7: "1485091531533582346",
	CPZ8: "1485091556896542870",
	CPZ9: "1485091571887112373",
	CPZ10: "1485091587905163294",
	CPZ11: "1485091602337628252",
	CPZ12: "1485091621707186306",
	CPZ13: "1485091652703096842",
	CPZ14: "1485091681140478003",
};

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
	.setName("cpzreport")
	.setDescription("Submits a CPZ (Cell) report")
	.addStringOption((option) =>
		option
			.setName("cpz")
			.setDescription("Select the CPZ cell")
			.setRequired(true)
			.addChoices(
				{ name: "CPZ 1", value: "CPZ1" },
				{ name: "CPZ 2", value: "CPZ2" },
				{ name: "CPZ 3", value: "CPZ3" },
				{ name: "CPZ 4", value: "CPZ4" },
				{ name: "CPZ 5", value: "CPZ5" },
				{ name: "CPZ 6", value: "CPZ6" },
				{ name: "CPZ 7", value: "CPZ7" },
				{ name: "CPZ 8", value: "CPZ8" },
				{ name: "CPZ 9", value: "CPZ9" },
				{ name: "CPZ 10", value: "CPZ10" },
				{ name: "CPZ 11", value: "CPZ11" },
				{ name: "CPZ 12", value: "CPZ12" },
				{ name: "CPZ 13", value: "CPZ13" },
				{ name: "CPZ 14", value: "CPZ14" },
			),
	)
	.addStringOption((option) =>
		option.setName("name").setDescription("Prisoner's name").setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("dob")
			.setDescription("Date of Birth (e.g. 01/01/1990)")
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("incident_id")
			.setDescription("Incident ID number")
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("reason")
			.setDescription("Reason for imprisonment")
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
				"❌ You do not have permission to use this command. You must be a police officer!",
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const cpzKey = interaction.options.getString("cpz", true);
	const targetChannelId = CPZ_CHANNELS[cpzKey];
	const name = interaction.options.getString("name", true);
	const dob = interaction.options.getString("dob", true);
	const incidentId = interaction.options.getString("incident_id", true);
	const reason = interaction.options.getString("reason", true);

	const embedContent = `# 🔒 LSPD CPZ REPORT: ${cpzKey}

### 👤 OSOBNÍ ÚDAJE DRŽENÉ OSOBY
- **Celé Jméno:** \`${name}\`
- **Datum Narození:** \`${dob}\`
- **Číslo Incidentu v MDT:** \`#${incidentId}\`

### 📑 INFORMACE O ZADRŽENÍ
- **Místo Výkonu:** Vespucci Police Department
- **Číslo CPZ:** \`${cpzKey}\`
- **Důvod Zadržení v CPZ:** \`${reason}\`

---
**ARRESTING OFFICER:** <@${interaction.user.id}>
**ČAS ZÁPISU:** <t:${Math.floor(Date.now() / 1000)}:F>`;

	const textComponent = new TextDisplayBuilder().setContent(embedContent);

	const thumbnailComponent = new ThumbnailBuilder({
		media: {
			url: LSPD_LOGO_URL,
		},
	});

	const sectionComponent = new SectionBuilder()
		.addTextDisplayComponents(textComponent)
		.setThumbnailAccessory(thumbnailComponent);

	const resolvedButton = new ButtonBuilder()
		.setCustomId("cpz_resolve")
		.setLabel("✅ Resolved")
		.setStyle(ButtonStyle.Success);

	const actionRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
		resolvedButton,
	);

	try {
		const channel = (await client.channels.fetch(
			targetChannelId,
		)) as TextChannel;
		if (channel) {
			await channel.send({
				flags: MessageFlags.IsComponentsV2,
				components: [sectionComponent, actionRow1],
			});
		}

		await interaction.editReply({
			content: `✅ CPZ Report for **${name}** has been successfully submitted to **${cpzKey}**.`,
		});
	} catch (error) {
		console.error("Error sending CPZ report:", error);
		await interaction.editReply({
			content: "❌ Error while sending CPZ report.",
		});
	}
};

export const options: CommandOptions = {
	devOnly: false,
	deleted: false,
};
