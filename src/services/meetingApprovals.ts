import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle,
  type Client, type Interaction, type ButtonInteraction, type ModalSubmitInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { LSPD_GUILD_ID } from '../config/constants';

const PRIMARY = process.env.MEETING_PRIMARY_ID || '710549603216261141';
const BACKUP = process.env.MEETING_BACKUP_ID || '769892516152999957';
const DIRECTORY = resolve(process.env.MEETING_DATA_DIR || 'data');
const FILE = resolve(DIRECTORY, 'meeting-approvals.json');
const LOGO = '<:lspdlogo:1393131616494293104>';
const TYPES = ['supervisor', 'assembly'] as const;
type Kind = typeof TYPES[number];
type Status = 'pending' | 'approved' | 'cancelled';
type Delivery = 'sending' | 'sent' | 'uncertain';
type Meeting = { status: Status; time: string; place: string; extra: string; by?: string; at?: string; delivery?: Delivery; messageId?: string };
type Panel = { channelId: string; messageId: string; kinds: Kind[] };
type Cycle = { date: string; meetings: Record<Kind, Meeting>; primary?: Panel; backup?: Panel; escalation?: Kind[]; closed?: boolean; notified?: boolean };
type Store = Record<string, Cycle>;
const CONFIG = {
  supervisor: { label: '👮 Supervisor porada', channel: '1355872036974497975', time: '18:15', place: 'Meetingovce v 5. patře hned vedle Chief Office' },
  assembly: { label: LOGO + ' Sborová porada', channel: '1350429892482830346', time: '19:00', place: 'Meeting Room ve 2. patře stanice VSPD' },
};
const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function meetingClock(now = new Date()) {
  const parts = formatter.formatToParts(now);
  const get = (key: string) => parts.find(p => p.type === key)!.value;
  const day = get('year') + '-' + get('month') + '-' + get('day');
  const date = new Date(day + 'T00:00:00Z');
  const weekday = date.getUTCDay();
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - (weekday || 7));
  const week = Math.ceil(((thursday.getTime() - Date.UTC(thursday.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  const friday = new Date(date);
  friday.setUTCDate(date.getUTCDate() + (5 - weekday + 7) % 7);
  return { day, weekday, week, friday: friday.toISOString().slice(0, 10), minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

function load(): Store {
  if (!existsSync(FILE)) return {};
  return JSON.parse(readFileSync(FILE, 'utf8')) as Store;
}
function save(store: Store) {
  mkdirSync(DIRECTORY, { recursive: true });
  const temp = FILE + '.tmp';
  writeFileSync(temp, JSON.stringify(store, null, 2), { mode: 0o600 });
  renameSync(temp, FILE);
}
function getCycle(store: Store, date: string): Cycle {
  if (!store[date]) {
    const make = (kind: Kind): Meeting => ({ status: 'pending', time: CONFIG[kind].time, place: CONFIG[kind].place, extra: '' });
    store[date] = { date, meetings: { supervisor: make('supervisor'), assembly: make('assembly') } };
    save(store);
  }
  return store[date];
}
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}
function dateLabel(date: string) {
  const [y, m, d] = date.split('-');
  return d + '. ' + m + '. ' + y;
}
function open(cycle: Cycle, now = new Date()) {
  const clock = meetingClock(now);
  return !cycle.closed && clock.friday === cycle.date && clock.week % 2 === 0 &&
    ((clock.weekday === 4 && clock.minute >= 1080) || (clock.weekday === 5 && clock.minute < 360));
}
function allowed(cycle: Cycle, actor: string, kind: Kind) {
  if (!open(cycle)) return false;
  return actor === PRIMARY || (actor === BACKUP && !!cycle.escalation?.includes(kind));
}
function announcement(cycle: Cycle, kind: Kind) {
  const m = cycle.meetings[kind];
  const header = '# ' + CONFIG[kind].label + ': ' + dateLabel(cycle.date);
  const ending = kind === 'assembly' ? 'S pozdravem a přáním hezkého pátku,\nReynolds ' : 'Hezký pátek,\nReynolds ';
  if (m.status === 'cancelled') return header + '\n\n' + (kind === 'assembly' ? 'Dobré páteční ráno kolegové,\n\nrádi bychom vás informovali, že dnešní pravidelná sborová porada je **zrušena**.' : 'Dobré ráno,\n\ndnešní pravidelná supervisor porada je **zrušena**.') + '\n\nDěkujeme za pochopení.\n\n' + ending + LOGO + '\n\n@everyone';
  const extra = m.extra ? '\n- ' + m.extra : '';
  if (kind === 'supervisor') return header + '\n\nDobré ráno,\n\ndnes proběhne další supervisor porada, bude probíhat od **' + m.time + '**.\n\nSraz je standardně v **' + m.place + '**.' + (m.extra ? '\n\n**Mimořádný bod:** ' + m.extra : '') + '\n\n' + ending + LOGO + '\n\n@everyone';
  return header + '\n\nDobré páteční ráno kolegové,\n\nrádi bychom vás informovali, že **dnes od ' + m.time + '** proběhne __pravidelná sborová porada__. Setkání se uskuteční v **' + m.place + '**.\n\nProsíme všechny přítomné, aby dorazili ve **služebním formálním oděvu**.\n\n## 📜 Program porady\n\n- Rekapitulace událostí a činnosti sboru za uplynulý týden\n- Novinky ohledně divizí, statusy náborů\n- Předání povýšení, pochval a dalších ocenění\n- Informace o aktuálních změnách a plánovaných věcech\n- Diskuze nad problémy a situacemi, které se během týdne objevily' + extra + '\n\nV případě, že se porady **nemůžete zúčastnit**, omluvte se prosím předem v kanálu <#1350545128732758068>\n\n' + ending + LOGO + '\n\n@everyone';
}
function panel(cycle: Cycle, kinds: Kind[], actor: string) {
  const box = new ContainerBuilder().setAccentColor(0x224477);
  box.addTextDisplayComponents(new TextDisplayBuilder().setContent('# 📅 Pravidelné porady LSPD\n**' + dateLabel(cycle.date) + '**\nOznámení budou odeslána v 07:30. Schvalování končí v 06:00.'));
  const button = (kind: Kind | 'both', action: string, label: string, style: ButtonStyle, disabled = false) => new ButtonBuilder().setCustomId(['meeting', cycle.date, kind, action].join(':')).setLabel(label).setStyle(style).setDisabled(disabled);
  for (const kind of kinds) {
    const m = cycle.meetings[kind];
    const state = m.status === 'approved' ? '🟢 Schváleno' : m.status === 'cancelled' ? '🔴 Zrušeno' : cycle.closed ? '⚪ Bez rozhodnutí' : '🟡 Čeká na schválení';
    const disabled = !allowed(cycle, actor, kind);
    box.addSeparatorComponents(new SeparatorBuilder());
    box.addTextDisplayComponents(new TextDisplayBuilder().setContent('## ' + CONFIG[kind].label + '\n**Čas:** ' + m.time + '\n**Místo:** ' + m.place + '\n**Stav:** ' + state + (m.extra ? '\n**Mimořádný bod:** ' + m.extra : '') + (m.by ? '\n**Rozhodl:** <@' + m.by + '>' : '')));
    box.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      button(kind, 'approve', 'Potvrdit', ButtonStyle.Success, disabled || m.status === 'approved'),
      button(kind, 'cancel', 'Zrušit', ButtonStyle.Danger, disabled || m.status === 'cancelled'),
      button(kind, 'edit', 'Upravit', ButtonStyle.Secondary, disabled),
      button(kind, 'preview', 'Náhled', ButtonStyle.Secondary),
    ));
  }
  if (kinds.length === 2) {
    const disabled = !kinds.every(k => allowed(cycle, actor, k));
    box.addSeparatorComponents(new SeparatorBuilder());
    box.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      button('both', 'approve', 'Potvrdit obě', ButtonStyle.Success, disabled),
      button('both', 'cancel', 'Zrušit obě', ButtonStyle.Danger, disabled),
    ));
  }
  box.addTextDisplayComponents(new TextDisplayBuilder().setContent(cycle.closed ? 'Schvalování bylo ukončeno.' : actor === PRIMARY ? 'Pokud nerozhodnete do 20:00, nerozhodnuté porady převezme náhradník.' : 'Rozhodněte do 06:00. Bez rozhodnutí se oznámení neodešle.'));
  return { flags: MessageFlags.IsComponentsV2 as const, components: [box], allowedMentions: { parse: [] as never[] } };
}
async function dmPanel(client: Client, cycle: Cycle, kinds: Kind[], actor: string): Promise<Panel> {
  const user = await client.users.fetch(actor);
  const msg = await user.send(panel(cycle, kinds, actor));
  return { channelId: msg.channelId, messageId: msg.id, kinds };
}
async function refresh(client: Client, cycle: Cycle) {
  for (const [actor, ref] of [[PRIMARY, cycle.primary], [BACKUP, cycle.backup]] as const) {
    if (!ref) continue;
    try {
      const user = await client.users.fetch(actor);
      const dm = await user.createDM();
      const msg = await dm.messages.fetch(ref.messageId);
      await msg.edit(panel(cycle, ref.kinds, actor));
    } catch (error) { console.error('[Meetings] Panel refresh failed:', error); }
  }
}
async function deliver(client: Client, store: Store, cycle: Cycle, kind: Kind) {
  const m = cycle.meetings[kind];
  if (m.status === 'pending' || m.delivery) return;
  const guild = await client.guilds.fetch(LSPD_GUILD_ID);
  const channel = await guild.channels.fetch(CONFIG[kind].channel);
  if (!channel || !channel.isTextBased() || !channel.isSendable()) throw new Error('Meeting channel is not sendable: ' + CONFIG[kind].channel);
  m.delivery = 'sending';
  save(store);
  try {
    const message = await channel.send({ content: announcement(cycle, kind), allowedMentions: { parse: ['everyone'] }, nonce: cycle.date.replace(/-/g, '') + kind, enforceNonce: true });
    m.delivery = 'sent';
    m.messageId = message.id;
    save(store);
    console.log('[Meetings] Published', cycle.date, kind, m.status, message.id);
  } catch (error) {
    m.delivery = 'uncertain';
    save(store);
    console.error('[Meetings] Delivery uncertain; inspect channel before manual retry:', kind, error);
    try { await (await client.users.fetch(PRIMARY)).send('⚠️ Nepodařilo se ověřit odeslání: ' + CONFIG[kind].label + '. Zkontrolujte kanál ručně.'); } catch {}
  }
}
let running = false;
export async function processMeetings(client: Client) {
  if (running) return;
  running = true;
  try {
    await serialized(async () => {
      const clock = meetingClock();
      if (clock.week % 2 || ![4, 5].includes(clock.weekday)) return;
      if (clock.weekday === 4 && clock.minute < 1080) return;
      const store = load();
      const cycle = getCycle(store, clock.friday);
      const beforeClose = open(cycle);
      if (beforeClose && !cycle.primary && clock.weekday === 4 && clock.minute < 1200) {
        try { cycle.primary = await dmPanel(client, cycle, [...TYPES], PRIMARY); save(store); }
        catch (error) { console.error('[Meetings] Primary DM failed:', error); }
      }
      if (beforeClose && (clock.weekday === 5 || clock.minute >= 1200)) {
        if (!cycle.escalation) {
          cycle.escalation = TYPES.filter(k => cycle.meetings[k].status === 'pending');
          save(store);
        }
        const pending = cycle.escalation.filter(k => cycle.meetings[k].status === 'pending');
        if (pending.length && !cycle.backup) {
          try { cycle.backup = await dmPanel(client, cycle, pending, BACKUP); save(store); }
          catch (error) { console.error('[Meetings] Backup DM failed:', error); }
        }
      }
      if (clock.weekday !== 5 || clock.minute < 360) return;
      if (!cycle.closed) { cycle.closed = true; save(store); await refresh(client, cycle); }
      const pending = TYPES.filter(k => cycle.meetings[k].status === 'pending');
      if (pending.length && !cycle.notified && clock.minute < 1080) {
        try {
          await (await client.users.fetch(PRIMARY)).send('⚠️ Schvalování porad ' + dateLabel(cycle.date) + ' skončilo. Bez rozhodnutí, oznámení se neodešle: ' + pending.map(k => CONFIG[k].label).join(', '));
          cycle.notified = true; save(store);
        } catch (error) { console.error('[Meetings] Deadline DM failed:', error); }
      }
      if (clock.minute < 450) return;
      for (const kind of TYPES) {
        const m = cycle.meetings[kind];
        const [h, min] = m.time.split(':').map(Number);
        if (clock.minute >= h * 60 + min) continue;
        if (m.delivery === 'sending') {
          m.delivery = 'uncertain'; save(store);
          console.error('[Meetings] Interrupted delivery, inspect channel:', cycle.date, kind);
        }
        try { await deliver(client, store, cycle, kind); }
        catch (error) { console.error('[Meetings] Publish failed before send:', error); }
      }
    });
  } catch (error) { console.error('[Meetings] Scheduler failed:', error); }
  finally { running = false; }
}

function input(id: string, label: string, value: string, max: number, required = true) {
  const field = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setMaxLength(max).setRequired(required);
  if (value) field.setValue(value);
  return new ActionRowBuilder<TextInputBuilder>().addComponents(field);
}
function editModal(cycle: Cycle, kind: Kind) {
  const m = cycle.meetings[kind];
  return new ModalBuilder().setCustomId(['meeting', cycle.date, kind, 'save'].join(':')).setTitle('Upravit poradu').addComponents(
    input('time', 'Čas (HH:MM)', m.time, 5),
    input('place', 'Místo konání', m.place, 120),
    input('extra', 'Mimořádný bod programu', m.extra, 250, false),
  );
}
function isKind(value: string): value is Kind { return TYPES.includes(value as Kind); }
async function respond(interaction: ButtonInteraction | ModalSubmitInteraction, content: string) {
  const options = { content, allowedMentions: { parse: [] as never[] }, ...(interaction.inGuild() ? { flags: MessageFlags.Ephemeral as const } : {}) };
  if (interaction.deferred || interaction.replied) await interaction.followUp(options);
  else await interaction.reply(options);
}
export async function handleMeetingInteraction(interaction: Interaction) {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith('meeting:')) return;
  const [, date, target, action] = interaction.customId.split(':');
  const actor = interaction.user.id;
  try {
    if (actor !== PRIMARY && actor !== BACKUP) { await respond(interaction, 'Nemáte oprávnění.'); return; }
    if (!isKind(target) && target !== 'both') { await respond(interaction, 'Neplatná porada.'); return; }
    const cycle = load()[date];
    if (!cycle) { await respond(interaction, 'Tato porada již není dostupná.'); return; }
    const kinds = target === 'both' ? [...TYPES] : [target];
    if (action === 'preview' && isKind(target) && interaction.isButton()) {
      if (actor === BACKUP && !cycle.escalation?.includes(target)) { await respond(interaction, 'Nemáte oprávnění.'); return; }
      await respond(interaction, announcement(cycle, target)); return;
    }
    if (!kinds.every(k => allowed(cycle, actor, k))) { await respond(interaction, 'Schvalování je uzavřeno nebo nemáte oprávnění.'); return; }
    if (action === 'edit' && isKind(target) && interaction.isButton()) { await interaction.showModal(editModal(cycle, target)); return; }
    if (!['approve', 'cancel', 'save'].includes(action)) return;
    let changes: Pick<Meeting, 'time' | 'place' | 'extra'> | undefined;
    if (action === 'save' && isKind(target) && interaction.isModalSubmit()) {
      const time = interaction.fields.getTextInputValue('time').trim();
      const place = interaction.fields.getTextInputValue('place').trim();
      const extra = interaction.fields.getTextInputValue('extra').trim();
      if (!/^(?:0[89]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(time) || !place || place.length > 120 || extra.length > 250 || /[@\r\n]/.test(place + extra)) {
        await respond(interaction, 'Zadejte čas 08:00–23:59 a platné místo/program bez zmínek.'); return;
      }
      changes = { time, place, extra };
    } else if (action === 'save' || !interaction.isButton()) return;
    if (interaction.isButton()) await interaction.deferUpdate();
    else await interaction.deferReply(interaction.inGuild() ? { flags: MessageFlags.Ephemeral } : {});
    await serialized(async () => {
      const store = load();
      const current = store[date];
      if (!current || !kinds.every(k => allowed(current, actor, k))) {
        await respond(interaction, 'Schvalování je již uzavřeno.'); return;
      }
      for (const kind of kinds) {
        const m = current.meetings[kind];
        if (changes) Object.assign(m, changes);
        else m.status = action === 'approve' ? 'approved' : 'cancelled';
        m.by = actor;
        m.at = new Date().toISOString();
        console.log('[Meetings] Decision', date, kind, action, actor);
      }
      save(store);
      if (interaction.isButton()) await interaction.editReply(panel(current, actor === PRIMARY ? [...TYPES] : current.backup?.kinds || current.escalation || [], actor));
      else await interaction.editReply('Úpravy uloženy. Pro odeslání je nutné poradu schválit.');
      await refresh(interaction.client, current);
    });
  } catch (error) {
    console.error('[Meetings] Interaction failed:', error);
    try { await respond(interaction, 'Nepodařilo se provést akci.'); } catch {}
  }
}
export async function showMeetingCommand(interaction: ChatInputCommandInteraction) {
  const actor = interaction.user.id;
  if ((actor !== PRIMARY && actor !== BACKUP) || (interaction.guildId && interaction.guildId !== LSPD_GUILD_ID)) {
    await interaction.reply({ content: 'Nemáte oprávnění.', ...(interaction.inGuild() ? { flags: MessageFlags.Ephemeral as const } : {}) }); return;
  }
  await interaction.deferReply(interaction.inGuild() ? { flags: MessageFlags.Ephemeral } : {});
  await serialized(async () => {
    const clock = meetingClock();
    let date = new Date(clock.friday + 'T00:00:00Z');
    if (clock.weekday === 6) date.setUTCDate(date.getUTCDate() + 7);
    while (meetingClock(new Date(date.getTime() + 12 * 3600000)).week % 2) date.setUTCDate(date.getUTCDate() + 7);
    const store = load();
    const cycle = getCycle(store, date.toISOString().slice(0, 10));
    const kinds = actor === PRIMARY ? [...TYPES] : cycle.escalation || [];
    if (!kinds.length) { await interaction.editReply('Aktuálně nemáte žádné porady ke schválení.'); return; }
    await interaction.editReply(panel(cycle, kinds, actor));
  });
}
