import type { CommandMetadata } from 'commandkit';
import {
  MessageFlags, SlashCommandBuilder, type AutocompleteInteraction,
  type ChatInputCommandInteraction, type Client,
} from 'discord.js';
import { LSPD_GUILD_ID } from '../../../config/constants';
import {
  cancelOwnPredvolani, cleanLspdNickname, czechDate,
  getOwnActivePredvolani, listOwnActivePredvolani,
} from '../../../services/predvolaniDb';
import { cancelRemindersForPredvolani } from '../../../services/predvolaniReminderStore';

export const command = new SlashCommandBuilder()
  .setName('zrusitpredvolani')
  .setDescription('Cancel own summons')
  .addStringOption((option) => option
    .setName('predvolani')
    .setDescription('Choose a user that you want to de-summon')
    .setRequired(true)
    .setAutocomplete(true))
  .toJSON();

async function choices(interaction: AutocompleteInteraction): Promise<void> {
  try {
    const entries = await listOwnActivePredvolani(interaction.user.id);
    const guild = interaction.client.guilds.cache.get(LSPD_GUILD_ID);
    const cachedNames = new Map<string, string>();
    for (const entry of entries) {
      const member = guild?.members.cache.get(entry.discord_id);
      cachedNames.set(entry.discord_id, cleanLspdNickname(
        member?.nickname ?? member?.displayName ?? entry.guild_nickname,
      ));
    }

    const query = interaction.options.getFocused().trim().toLocaleLowerCase('cs-CZ');
    const matches = entries.filter((entry) => {
      const label = `${cachedNames.get(entry.discord_id)} - ${entry.event_time.slice(0, 5)}`;
      return !query || label.toLocaleLowerCase('cs-CZ').includes(query) ||
        czechDate(entry.event_date).includes(query);
    }).slice(0, 25);

    if (guild && matches.length > 0) {
      await Promise.race([
        Promise.allSettled([...new Set(matches.map((m) => m.discord_id))]
          .slice(0, 12).map(async (id) => {
            const member = await guild.members.fetch(id);
            cachedNames.set(id, cleanLspdNickname(member.nickname ?? member.displayName));
          })),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
    }

    const seen = new Map<string, number>();
    for (const entry of matches) {
      const key = `${cachedNames.get(entry.discord_id)} - ${entry.event_time.slice(0, 5)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    await interaction.respond(matches.map((entry) => {
      const label = `${cachedNames.get(entry.discord_id)} - ${entry.event_time.slice(0, 5)}`;
      return {
        name: (seen.get(label) ?? 0) > 1
          ? `${label} (${czechDate(entry.event_date)})`.slice(0, 100)
          : label.slice(0, 100),
        value: String(entry.id),
      };
    }));
  } catch (error) {
    console.error('[zrusitpredvolani] autocomplete failed:', error);
    if (!interaction.responded) await interaction.respond([]).catch(() => undefined);
  }
}

export const autocomplete = async ({ interaction }: { interaction: AutocompleteInteraction }) => {
  await choices(interaction);
};

export const chatInput = async ({ interaction, client }: {
  interaction: ChatInputCommandInteraction;
  client: Client;
}): Promise<void> => {
  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ Tento příkaz lze použít pouze na Discord serveru.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const raw = interaction.options.getString('predvolani', true);
  const id = Number(raw);
  if (!/^\d{1,15}$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) {
    await interaction.editReply({ content: '❌ Vyberte předvolání z nabídky.' });
    return;
  }

  try {
    const entry = await getOwnActivePredvolani(id, interaction.user.id);
    if (!entry) {
      await interaction.editReply({
        content: '❌ Předvolání již není aktivní nebo jste ho nevytvořili vy.',
      });
      return;
    }

    const cancelled = await cancelOwnPredvolani(id, interaction.user.id);
    if (!cancelled) {
      await interaction.editReply({ content: '❌ Předvolání již bylo zrušeno nebo není vaše.' });
      return;
    }

    try {
      cancelRemindersForPredvolani(id);
    } catch (error) {
      console.error(`[zrusitpredvolani] Unable to remove reminder for ${id}:`, error);
    }

    const guild = client.guilds.cache.get(LSPD_GUILD_ID);
    const member = await guild?.members.fetch(entry.discord_id).catch(() => null);
    const name = cleanLspdNickname(member?.nickname ?? member?.displayName ?? entry.guild_nickname);
    let sent = false;
    try {
      const user = await client.users.fetch(entry.discord_id);
      await user.send({ content:
        `# ❌ Zrušení předvolání\n\nDobrý den, <@${entry.discord_id}>,\n\n` +
        `Vaše předvolání na **${czechDate(entry.event_date)} v ${entry.event_time.slice(0, 5)}** ` +
        `bylo zrušeno. Na původní termín se již nemusíte dostavit.\n\n` +
        `👮 **Los Santos Police Department**`,
      });
      sent = true;
    } catch (error) {
      console.warn(`[zrusitpredvolani] DM failed for ${entry.discord_id}:`, error);
    }

    await interaction.editReply({
      content: `✅ Předvolání **${name} - ${entry.event_time.slice(0, 5)}** bylo zrušeno. ` +
        (sent ? 'Hráči bylo odesláno oznámení do DM.' : '⚠️ Hráči se nepodařilo doručit DM.'),
    });
  } catch (error) {
    console.error('[zrusitpredvolani] cancellation failed:', error);
    await interaction.editReply({
      content: '❌ Zrušení se nezdařilo. Zkontrolujte připojení k databázi.',
    });
  }
};

export const metadata: CommandMetadata = {};
