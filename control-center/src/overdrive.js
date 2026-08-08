import path from 'node:path';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  PermissionFlagsBits, SlashCommandBuilder
} from '../../node_modules/discord.js/src/index.js';
import { DATA, audit, readJson, writeJson } from './store.js';

const clipsFile = path.join(DATA, 'clips.json');
const automationsFile = path.join(DATA, 'automations.json');
const eventsFile = path.join(DATA, 'events.json');
const CLIP_CATEGORIES = ['Clutch', 'Jogada', 'Comédia', 'Pino', 'Bug'];
const CATEGORY_EMOJI = { Clutch: '🔥', Jogada: '⚡', 'Comédia': '😂', Pino: '🎯', Bug: '🧪' };

function defaultClips() {
  const now = Date.now();
  return { season: 1, startsAt: new Date(now).toISOString(), endsAt: new Date(now + 7 * 864e5).toISOString(), channelId: '', winnerRoleId: '', entries: [], history: [] };
}
function defaultAutomations() {
  return { welcome: { enabled: false, channelId: '', message: '💛 {member} foi aprovado(a) pela Killjoy. Pode entrar!', autoRoleId: '' }, scheduled: [], gameMode: true };
}
const clipCommands = [
  new SlashCommandBuilder().setName('clipe').setDescription('Arena de Clipes do OVERDRIVE')
    .addSubcommand(s => s.setName('enviar').setDescription('Inscreve um clipe na temporada atual')
      .addAttachmentOption(o => o.setName('arquivo').setDescription('Vídeo do clipe').setRequired(true))
      .addStringOption(o => o.setName('titulo').setDescription('Título chamativo').setRequired(true).setMaxLength(80))
      .addStringOption(o => o.setName('categoria').setDescription('Categoria da jogada').setRequired(true)
        .addChoices(...CLIP_CATEGORIES.map(name => ({ name: `${CATEGORY_EMOJI[name]} ${name}`, value: name }))))
      .addStringOption(o => o.setName('jogo').setDescription('Jogo do clipe').setRequired(false).setMaxLength(40)))
    .addSubcommand(s => s.setName('ranking').setDescription('Mostra a classificação da temporada')),
  new SlashCommandBuilder().setName('overdrive').setDescription('Estado do laboratório Killjoy')
].map(c => c.toJSON());

function voteRow(entry) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`kjclip:vote:${entry.id}:fire`).setEmoji('🔥').setLabel(String(Object.values(entry.votes || {}).filter(v => v === 'fire').length)).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`kjclip:vote:${entry.id}:tech`).setEmoji('⚡').setLabel(String(Object.values(entry.votes || {}).filter(v => v === 'tech').length)).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`kjclip:delete:${entry.id}`).setEmoji('🗑️').setLabel('Retirar meu clipe').setStyle(ButtonStyle.Secondary)
  );
}
function clipEmbed(entry, season) {
  const total = Object.keys(entry.votes || {}).length;
  return new EmbedBuilder().setColor(0xffd836)
    .setAuthor({ name: `ARENA DE CLIPES // TEMPORADA ${season}` })
    .setTitle(`${CATEGORY_EMOJI[entry.category]} ${entry.title}`)
    .setDescription(`**Autor:** <@${entry.authorId}>\n**Jogo:** ${entry.game}\n**Categoria:** ${entry.category}\n\n🏆 **${total} voto${total === 1 ? '' : 's'} válido${total === 1 ? '' : 's'}**`)
    .setFooter({ text: 'Vote uma vez • você pode trocar seu voto • votos próprios não contam' })
    .setTimestamp(new Date(entry.createdAt));
}
async function loadClips() { return readJson(clipsFile, defaultClips()); }
async function saveClips(data) { await writeJson(clipsFile, data); }

async function ensureWinnerRole(guild, data) {
  let role = data.winnerRoleId ? guild.roles.cache.get(data.winnerRoleId) : null;
  if (!role) {
    role = guild.roles.cache.find(r => r.name === '🎬・Clipe da Semana') || await guild.roles.create({ name: '🎬・Clipe da Semana', color: 0xffd836, hoist: true, reason: 'Arena de Clipes Killjoy' });
    data.winnerRoleId = role.id;
  }
  return role;
}
async function finalizeSeason(client, forced = false) {
  const data = await loadClips();
  if (!forced && Date.now() < new Date(data.endsAt).getTime()) return null;
  const ranked = data.entries.filter(e => !e.deleted).sort((a, b) => Object.keys(b.votes || {}).length - Object.keys(a.votes || {}).length);
  const winner = ranked[0] || null;
  const guild = client.guilds.cache.first();
  if (winner && guild) {
    const role = await ensureWinnerRole(guild, data);
    for (const member of role.members.values()) await member.roles.remove(role, 'Nova temporada da Arena');
    const member = await guild.members.fetch(winner.authorId).catch(() => null);
    if (member) await member.roles.add(role, 'Vencedor da Arena de Clipes');
    const channel = guild.channels.cache.get(data.channelId);
    if (channel?.isTextBased()) await channel.send({ embeds: [new EmbedBuilder().setColor(0xffd836).setTitle('🏆 CLIPE DA SEMANA').setDescription(`<@${winner.authorId}> venceu a temporada **${data.season}** com **${winner.title}** e ${Object.keys(winner.votes || {}).length} votos!`).setFooter({ text: 'Killjoy // Arena encerrada, diagnóstico aprovado 💛' })] });
  }
  data.history.unshift({ season: data.season, endedAt: new Date().toISOString(), winner, entries: data.entries });
  data.history = data.history.slice(0, 24); data.season += 1; data.startsAt = new Date().toISOString(); data.endsAt = new Date(Date.now() + 7 * 864e5).toISOString(); data.entries = [];
  await saveClips(data); await audit('clips.season.finalized', `Temporada ${data.season - 1} encerrada`); return winner;
}

async function handleClipCommand(interaction) {
  const data = await loadClips();
  if (interaction.options.getSubcommand() === 'ranking') {
    const ranked = data.entries.filter(e => !e.deleted).sort((a,b)=>Object.keys(b.votes||{}).length-Object.keys(a.votes||{}).length).slice(0,10);
    return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0x24e6d2).setTitle(`🏆 Ranking • Temporada ${data.season}`).setDescription(ranked.length ? ranked.map((e,i)=>`**${i+1}.** ${CATEGORY_EMOJI[e.category]} **${e.title}** — <@${e.authorId}> • ${Object.keys(e.votes||{}).length} votos`).join('\n') : 'Ainda não existem clipes nesta temporada.').setFooter({ text: `Termina em ${new Date(data.endsAt).toLocaleString('pt-BR')}` })] });
  }
  const attachment = interaction.options.getAttachment('arquivo');
  if (!attachment.contentType?.startsWith('video/') && !/\.(mp4|mov|webm|mkv)$/i.test(attachment.name)) return interaction.reply({ ephemeral: true, content: '🧪 Esse arquivo não parece ser um vídeo válido.' });
  if (attachment.size > 25 * 1024 * 1024) return interaction.reply({ ephemeral: true, content: '📦 O clipe ultrapassa 25 MB. Comprima o vídeo antes de enviar.' });
  const recent = data.entries.find(e => e.authorId === interaction.user.id && Date.now() - new Date(e.createdAt).getTime() < 5 * 60e3 && !e.deleted);
  if (recent) return interaction.reply({ ephemeral: true, content: '⏳ Aguarde 5 minutos antes de inscrever outro clipe.' });
  const entry = { id: crypto.randomUUID().slice(0,8), authorId: interaction.user.id, title: interaction.options.getString('titulo'), category: interaction.options.getString('categoria'), game: interaction.options.getString('jogo') || 'VALORANT', url: attachment.url, filename: attachment.name, createdAt: new Date().toISOString(), votes: {}, deleted: false };
  data.channelId = interaction.channelId; data.entries.push(entry); await saveClips(data);
  await interaction.reply({ embeds: [clipEmbed(entry, data.season)], components: [voteRow(entry)], files: [{ attachment: attachment.url, name: attachment.name }] });
  const msg = await interaction.fetchReply(); entry.messageId = msg.id; await saveClips(data); await audit('clips.entry.created', `${interaction.user.tag} inscreveu ${entry.title}`);
}
async function handleClipButton(interaction) {
  const [, action, id, choice] = interaction.customId.split(':'); const data = await loadClips(); const entry = data.entries.find(e => e.id === id && !e.deleted);
  if (!entry) return interaction.reply({ ephemeral: true, content: 'Este clipe já saiu da arena.' });
  if (action === 'delete') {
    if (interaction.user.id !== entry.authorId && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ ephemeral: true, content: 'Somente o autor ou a moderação pode retirar este clipe.' });
    entry.deleted = true; await saveClips(data); await interaction.update({ embeds:[new EmbedBuilder().setColor(0x4d5963).setTitle('🗑️ Clipe retirado da Arena').setDescription('A inscrição foi removida pelo autor ou pela moderação.')], components:[], attachments:[] }); return;
  }
  if (interaction.user.id === entry.authorId) return interaction.reply({ ephemeral:true, content:'😂 Boa tentativa, mas a Killjoy bloqueou o voto no próprio clipe.' });
  entry.votes[interaction.user.id] = choice; await saveClips(data); await interaction.update({ embeds:[clipEmbed(entry,data.season)], components:[voteRow(entry)] });
}

export async function setupOverdrive(client) {
  const guild = client.guilds.cache.first();
  if (guild) await guild.commands.set(clipCommands);
  client.on('interactionCreate', async interaction => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === 'clipe') return await handleClipCommand(interaction);
      if (interaction.isChatInputCommand() && interaction.commandName === 'overdrive') return await interaction.reply({ ephemeral:true, embeds:[new EmbedBuilder().setColor(0xa8ff3e).setTitle('⚡ OVERDRIVE ONLINE').setDescription('Laboratório local conectado. Arena, automações e central de controle disponíveis.')] });
      if (interaction.isButton() && interaction.customId.startsWith('kjclip:')) return await handleClipButton(interaction);
    } catch (error) { console.error('Falha no módulo OVERDRIVE:', error); if (interaction.isRepliable() && !interaction.replied) await interaction.reply({ ephemeral:true, content:`⚠️ ${error.message}` }).catch(()=>{}); }
  });
  client.on('guildMemberAdd', async member => {
    const automations = await readJson(automationsFile, defaultAutomations()); const w = automations.welcome;
    if (!w.enabled) return;
    if (w.autoRoleId) await member.roles.add(w.autoRoleId, 'Automação de boas-vindas').catch(()=>{});
    const channel = member.guild.channels.cache.get(w.channelId);
    if (channel?.isTextBased()) await channel.send({ embeds:[new EmbedBuilder().setColor(0xffd836).setTitle('🟡 NOVO AGENTE DETECTADO').setThumbnail(member.displayAvatarURL()).setDescription(w.message.replaceAll('{member}', `<@${member.id}>`).replaceAll('{server}', member.guild.name).replaceAll('{count}', String(member.guild.memberCount))).setFooter({text:'Killjoy // identificação concluída 💛'})] });
  });
  setInterval(() => finalizeSeason(client).catch(console.error), 60 * 60e3).unref();
  await finalizeSeason(client).catch(console.error);
}

export async function getClipState() { return loadClips(); }
export async function updateClipState(patch) { const data = await loadClips(); Object.assign(data, patch); await saveClips(data); return data; }
export async function forceFinalizeClips(client) { return finalizeSeason(client, true); }
export async function getAutomations() { return readJson(automationsFile, defaultAutomations()); }
export async function updateAutomations(patch) { const data = await getAutomations(); const next = { ...data, ...patch, welcome: { ...data.welcome, ...(patch.welcome || {}) } }; await writeJson(automationsFile, next); await audit('automations.updated', 'Protocolos automáticos atualizados'); return next; }
export async function getEvents() { return readJson(eventsFile, []); }
export async function createEvent(client, payload) {
  const guild = client.guilds.cache.first(); const channel = guild.channels.cache.get(payload.channelId); if (!channel?.isTextBased()) throw new Error('Canal de evento inválido.');
  const starts = new Date(payload.startsAt); if (Number.isNaN(starts.getTime())) throw new Error('Horário inválido.');
  const event = { id:crypto.randomUUID().slice(0,8), ...payload, createdAt:new Date().toISOString(), participants:[] };
  const msg = await channel.send({ embeds:[new EmbedBuilder().setColor(0x24e6d2).setTitle(`🎮 ${payload.title}`).setDescription(`${payload.description || 'Partida organizada pelo laboratório.'}\n\n🕒 <t:${Math.floor(starts.getTime()/1000)}:F>\n👥 **0 confirmados**`).setFooter({text:'Reaja com ✅ para confirmar presença'})] });
  await msg.react('✅'); event.messageId=msg.id; const events=await getEvents(); events.unshift(event); await writeJson(eventsFile,events.slice(0,100)); await audit('event.created',payload.title); return event;
}
