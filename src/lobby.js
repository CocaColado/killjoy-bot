import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const queuePath = 'data/lobby-queue.json';
const profilesPath = 'data/registration-profiles.json';
const queueDuration = 4 * 60 * 60 * 1000;
const rankWeight = { sem_elo: 0, ferro: 1, bronze: 2, prata: 3, ouro: 4, platina: 5, diamante: 6, ascendente: 7, imortal: 8, radiante: 9 };
const gameNames = { valorant: '🔺 Valorant', marvel: '🦸 Marvel Rivals', roblox: '🧱 Roblox', minecraft: '⛏️ Minecraft', outros: '🎲 Outros' };

async function readJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return {}; } }
async function writeQueue(data) { await mkdir('data', { recursive: true }); await writeFile(queuePath, JSON.stringify(data, null, 2), 'utf8'); }
function activeEntries(data, guildId) { const now = Date.now(); data[guildId] ??= {}; for (const [id, entry] of Object.entries(data[guildId])) if (entry.expiresAt <= now) delete data[guildId][id]; return data[guildId]; }
function overlap(first = [], second = []) { return first.filter(value => second.includes(value)); }

export function lobbyPanel(count = 0) {
  return { embeds: [new EmbedBuilder().setColor(0x00e0c6).setTitle('🎮 Central de Lobby da Killjoy')
    .setDescription(`## Encontre sua tropa sem flood\nEntre na fila e eu uso sua ficha para procurar pessoas com jogos, horários e objetivos compatíveis. A disponibilidade expira após **4 horas**.\n\n### 🟢 ${count} jogador${count === 1 ? '' : 'es'} disponível${count === 1 ? '' : 'is'} agora`)
    .addFields({ name: '🧬 Compatibilidade', value: 'Jogo • horário • objetivo • elo • função • comunicação' }, { name: '🔒 Sem marcações aleatórias', value: 'Você só é mencionado quando alguém escolhe montar um squad.' })
    .setFooter({ text: 'Killjoy Control // partida localizada 💛' })], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lobby:join').setLabel('Estou disponível').setEmoji('🟢').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('lobby:match').setLabel('Encontrar duo').setEmoji('🎯').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('lobby:list').setLabel('Ver fila').setEmoji('👥').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('lobby:squad').setLabel('Montar squad').setEmoji('🏆').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('lobby:leave').setLabel('Sair').setEmoji('🔴').setStyle(ButtonStyle.Danger))] };
}

function compatibility(profile, other) {
  let score = 0; const reasons = [];
  const games = overlap(profile.games, other.games); if (games.length) { score += 35; reasons.push(gameNames[games[0]] ?? games[0]); }
  const schedules = overlap(profile.schedule, other.schedule); if (schedules.length) { score += Math.min(25, schedules.length * 10); reasons.push(`${schedules.length} horário(s) em comum`); }
  const goals = overlap(profile.looking, other.looking); if (goals.length) { score += 15; reasons.push('mesmo objetivo'); }
  if (profile.mic === other.mic || profile.mic === 'depende' || other.mic === 'depende') score += 5;
  if (profile.rank && other.rank) { const distance = Math.abs((rankWeight[profile.rank] ?? 0) - (rankWeight[other.rank] ?? 0)); score += Math.max(0, 15 - distance * 4); if (distance <= 1) reasons.push('elo próximo'); }
  if ((profile.roles ?? []).some(role => !(other.roles ?? []).includes(role))) score += 5;
  return { score: Math.min(100, score), reasons };
}

async function refreshPanel(interaction, count) { if (interaction.message?.author.id === interaction.client.user.id && interaction.message.embeds[0]?.title?.includes('Central de Lobby')) await interaction.message.edit(lobbyPanel(count)).catch(() => {}); }

export async function handleLobbyInteraction(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('lobby:')) return false;
  const action = interaction.customId.split(':')[1]; const queues = await readJson(queuePath); const entries = activeEntries(queues, interaction.guild.id); const profiles = await readJson(profilesPath); const profile = profiles[interaction.user.id];
  if (action === 'join') {
    if (!profile?.completedAt) { await interaction.reply({ content: '🧪 Complete sua ficha em **#registro** antes de entrar na fila.', ephemeral: true }); return true; }
    entries[interaction.user.id] = { joinedAt: Date.now(), expiresAt: Date.now() + queueDuration }; await writeQueue(queues); await refreshPanel(interaction, Object.keys(entries).length);
    await interaction.reply({ content: `🟢 Disponível por **4 horas**. Jogos: ${profile.games.map(game => gameNames[game] ?? game).join(' • ')}.`, ephemeral: true }); return true;
  }
  if (action === 'leave') { delete entries[interaction.user.id]; await writeQueue(queues); await refreshPanel(interaction, Object.keys(entries).length); await interaction.reply({ content: '🔴 Você saiu da fila.', ephemeral: true }); return true; }
  const available = Object.keys(entries).filter(id => id !== interaction.user.id && profiles[id]?.completedAt);
  if (action === 'list') {
    const lines = await Promise.all(Object.keys(entries).slice(0, 20).map(async id => { const member = await interaction.guild.members.fetch(id).catch(() => null); const p = profiles[id]; return member && p ? `${member} — ${p.games.map(game => gameNames[game] ?? game).join(', ')}` : null; }));
    await writeQueue(queues); await refreshPanel(interaction, Object.keys(entries).length); await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00e0c6).setTitle(`👥 Disponíveis — ${Object.keys(entries).length}`).setDescription(lines.filter(Boolean).join('\n') || 'Ninguém disponível agora.').setFooter({ text: 'A fila expira automaticamente após 4 horas.' })], ephemeral: true }); return true;
  }
  if (!profile?.completedAt) { await interaction.reply({ content: 'Complete sua ficha em **#registro** primeiro.', ephemeral: true }); return true; }
  const matches = available.map(id => ({ id, ...compatibility(profile, profiles[id]) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  if (action === 'match') {
    const lines = matches.slice(0, 5).map((item, index) => `**${index + 1}.** <@${item.id}> — **${item.score}%**\n-# ${item.reasons.join(' • ') || 'compatibilidade básica'}`);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xffd84d).setTitle('🎯 Compatibilidade').setDescription(lines.join('\n\n') || 'Ainda não encontrei outra pessoa compatível.').setFooter({ text: 'Baseado nas fichas do registro.' })], ephemeral: true, allowedMentions: { parse: [] } }); return true;
  }
  if (action === 'squad') {
    if (!entries[interaction.user.id]) { await interaction.reply({ content: 'Entre na fila antes de montar um squad.', ephemeral: true }); return true; }
    const squad = [interaction.user.id, ...matches.slice(0, 4).map(item => item.id)];
    if (squad.length < 2) { await interaction.reply({ content: 'Ainda não há gente suficiente na fila.', ephemeral: true }); return true; }
    await interaction.reply({ content: `🏆 **SQUAD LOCALIZADO POR ${interaction.user}**\n${squad.map((id, index) => `${index + 1}. <@${id}>`).join('\n')}\n\nEntrem na call e escolham os agentes. 💛`, allowedMentions: { users: squad } }); return true;
  }
  return false;
}
