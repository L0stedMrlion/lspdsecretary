import type {
  CommandData,
  SlashCommandProps,
  CommandOptions,
} from 'commandkit';
import {
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';

export const data: CommandData = {
  name: 'ping',
  description: 'Shows detailed bot latency and status information',
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

function latencyBar(ms: number): string {
  if (ms < 125) return '🟢 Excellent';
  if (ms < 150) return '🟡 Good';
  if (ms < 600) return '🟠 Moderate';
  return '🔴 Poor';
}

export async function run({ interaction, client }: SlashCommandProps) {
  const sentAt = Date.now();

  await interaction.deferReply();

  const discordApiLatency = Date.now() - sentAt;
  const wsLatency = client.ws.ping;
  const uptime = formatUptime(client.uptime ?? 0);

  const headerText = new TextDisplayBuilder().setContent(
    '# 🏓 Pong!\nHere is a detailed overview of the bot latency and current status.',
  );

  const separator = new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);

  const latencyText = new TextDisplayBuilder().setContent(
    '### 📡 Latency\n' +
      `> **Discord WS:** \`${wsLatency}ms\` — ${latencyBar(wsLatency)}\n` +
      `> **Discord API:** \`${discordApiLatency}ms\` — ${latencyBar(discordApiLatency)}`,
  );

  const separator2 = new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);

  const statusText = new TextDisplayBuilder().setContent(
    '### ⚙️ Bot Status\n' + `> **Uptime:** \`${uptime}\``,
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(headerText)
    .addSeparatorComponents(separator)
    .addTextDisplayComponents(latencyText)
    .addSeparatorComponents(separator2)
    .addTextDisplayComponents(statusText);

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  });
}

export const options: CommandOptions = {
  devOnly: false,
  userPermissions: [],
  botPermissions: [],
  deleted: false,
};
