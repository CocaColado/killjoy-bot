import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, StringSelectMenuBuilder } from 'discord.js';
import { readJson, updateJson, writeJsonAtomic } from './storage.js';

const profilesPath = 'data/registration-profiles.json';
const agentProfilesPath = 'data/agent-profiles.json';
const labels = {
  platform: { pc: '🖥️ PC', console: '🎮 Console', mobile: '📱 Mobile' },
  games: { valorant: '🔺 Valorant', marvel: '🦸 Marvel Rivals', roblox: '🧱 Roblox', minecraft: '⛏️ Minecraft', outros: '🎲 Outros' },
  style: { casual: '🌿 Casual', competitivo: '🏆 Competitivo', tryhard: '🔥 Tryhard', resenha: '😂 Só resenha' },
  schedule: { manha: '🌅 Manhã', tarde: '☀️ Tarde', noite: '🌙 Noite', madrugada: '🦉 Madrugada' },
  rank: { sem_elo: '➖ Sem elo', ferro: '⚙️ Ferro', bronze: '🥉 Bronze', prata: '🥈 Prata', ouro: '🥇 Ouro', platina: '💠 Platina', diamante: '💎 Diamante', ascendente: '🟢 Ascendente', imortal: '🔴 Imortal', radiante: '🌟 Radiante' },
  roles: { duelista: '⚔️ Duelista', iniciador: '🎯 Iniciador', controlador: '🌫️ Controlador', sentinela: '🛡️ Sentinela', flex: '🔄 Flex' },
  mic: { sim: '🎙️ Com microfone', nao: '🔇 Sem microfone', depende: '🎧 Depende do dia' },
  looking: { duo: '🤝 Duo', trio: '👥 Trio', time: '🏆 Time fechado', amizade: '💛 Amizades', casual: '🎮 Partida casual' }
};

async function readProfiles() { return readJson(profilesPath, {}); }
async function saveProfiles(data) { await writeJsonAtomic(profilesPath, data); }
function option(label, value, emoji) { return { label, value, emoji }; }
function select(id, placeholder, values, max = 1) {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`registration:set:${id}`).setPlaceholder(placeholder).setMinValues(1).setMaxValues(max).addOptions(values));
}
function selected(profile) { return ['platform', 'games', 'style', 'schedule', 'rank', 'roles', 'mic', 'looking'].filter(key => Array.isArray(profile[key]) ? profile[key].length : profile[key]).length; }
function progress(profile) { const done = selected(profile); return `${'█'.repeat(done)}${'░'.repeat(8 - done)} ${Math.round(done / 8 * 100)}%`; }

function stepOne(profile = {}) {
  return {
    content: `## 🧪 Calibração de perfil — etapa 1/2\n${progress(profile)}\n-# Cada escolha é salva imediatamente. Você pode editar quando quiser.`,
    embeds: [],
    components: [
      select('platform', `Plataforma${profile.platform ? ` • ${labels.platform[profile.platform]}` : ''}`, [option('PC', 'pc', '🖥️'), option('Console', 'console', '🎮'), option('Mobile', 'mobile', '📱')]),
      select('games', `Jogos principais${profile.games?.length ? ` • ${profile.games.length} selecionados` : ''}`, [option('Valorant', 'valorant', '🔺'), option('Marvel Rivals', 'marvel', '🦸'), option('Roblox', 'roblox', '🧱'), option('Minecraft', 'minecraft', '⛏️'), option('Outros', 'outros', '🎲')], 5),
      select('style', `Estilo${profile.style ? ` • ${labels.style[profile.style]}` : ''}`, [option('Casual', 'casual', '🌿'), option('Competitivo', 'competitivo', '🏆'), option('Tryhard', 'tryhard', '🔥'), option('Só resenha', 'resenha', '😂')]),
      select('schedule', `Horários${profile.schedule?.length ? ` • ${profile.schedule.length} selecionados` : ''}`, [option('Manhã', 'manha', '🌅'), option('Tarde', 'tarde', '☀️'), option('Noite', 'noite', '🌙'), option('Madrugada', 'madrugada', '🦉')], 4),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('registration:step:2').setLabel('Próxima etapa').setEmoji('➡️').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('registration:cancel').setLabel('Fechar').setStyle(ButtonStyle.Secondary))
    ]
  };
}

function stepTwo(profile = {}) {
  return {
    content: `## 🛠️ Calibração de perfil — etapa 2/2\n${progress(profile)}\n-# Escolha o que combina com você. Funções e objetivos permitem várias opções.`, embeds: [],
    components: [
      select('rank', `Elo no Valorant${profile.rank ? ` • ${labels.rank[profile.rank]}` : ''}`, Object.entries(labels.rank).map(([value, text]) => option(text.replace(/^\S+\s/, ''), value, text.split(' ')[0]))),
      select('roles', `Funções${profile.roles?.length ? ` • ${profile.roles.length} selecionadas` : ''}`, Object.entries(labels.roles).map(([value, text]) => option(text.replace(/^\S+\s/, ''), value, text.split(' ')[0])), 5),
      select('mic', `Microfone${profile.mic ? ` • ${labels.mic[profile.mic]}` : ''}`, [option('Com microfone', 'sim', '🎙️'), option('Sem microfone', 'nao', '🔇'), option('Depende do dia', 'depende', '🎧')]),
      select('looking', `Procurando${profile.looking?.length ? ` • ${profile.looking.length} selecionados` : ''}`, Object.entries(labels.looking).map(([value, text]) => option(text.replace(/^\S+\s/, ''), value, text.split(' ')[0])), 5),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('registration:step:1').setLabel('Voltar').setEmoji('⬅️').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('registration:finish').setLabel('Concluir registro').setEmoji('✅').setStyle(ButtonStyle.Success))
    ]
  };
}

function listValues(group, values) { const items = Array.isArray(values) ? values : values ? [values] : []; return items.map(value => labels[group]?.[value] ?? value).join(' • ') || 'Não informado'; }
export async function profileEmbed(user, profile) {
  const agents = await readJson(agentProfilesPath); const agentProfile = agents[user.id];
  const agentText = agentProfile?.all ? 'Todos os agentes' : agentProfile?.agents?.length ? agentProfile.agents.slice(0, 12).join(', ') + (agentProfile.agents.length > 12 ? ` +${agentProfile.agents.length - 12}` : '') : 'Ainda não cadastrados';
  return new EmbedBuilder().setColor(0xffd84d).setAuthor({ name: `Ficha de ${user.displayName ?? user.username}`, iconURL: user.displayAvatarURL() }).setTitle('🧪 AGENTE CALIBRADO')
    .setThumbnail(user.displayAvatarURL({ size: 256 })).setDescription(`## ${user}\n${progress(profile)} • Perfil verificado pela Killjoy`)
    .addFields(
      { name: '🖥️ Plataforma', value: listValues('platform', profile.platform), inline: true }, { name: '🎮 Jogos', value: listValues('games', profile.games), inline: true },
      { name: '🔥 Estilo', value: listValues('style', profile.style), inline: true }, { name: '🌙 Horários', value: listValues('schedule', profile.schedule), inline: true },
      { name: '🏅 Elo', value: listValues('rank', profile.rank), inline: true }, { name: '🎯 Funções', value: listValues('roles', profile.roles), inline: true },
      { name: '🎙️ Comunicação', value: listValues('mic', profile.mic), inline: true }, { name: '🤝 Procurando', value: listValues('looking', profile.looking), inline: true },
      { name: '🧬 Arsenal de agentes', value: agentText, inline: false })
    .setFooter({ text: 'Killjoy Control // perfil editável a qualquer momento 💛' }).setTimestamp(profile.updatedAt ? new Date(profile.updatedAt) : new Date());
}

export function registrationPanel() {
  return { embeds: [new EmbedBuilder().setColor(0xffd84d).setTitle('🧪 Central de Registro da Killjoy')
    .setDescription('## Monte sua ficha de jogador\nLeva menos de um minuto. Suas escolhas ficam salvas e ajudam a encontrar gente com o mesmo estilo, horário e objetivos.')
    .addFields({ name: '🎮 Perfil completo', value: 'Plataforma, jogos, estilo, horários, elo, funções, microfone e o que você procura.' }, { name: '🔄 Sem arrependimento', value: 'Você pode editar tudo depois. O cadastro de agentes entra automaticamente na ficha.' })
    .setFooter({ text: 'Killjoy Control // identificação de agentes 💛' })], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('registration:start').setLabel('Começar registro').setEmoji('🧪').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('registration:edit').setLabel('Editar ficha').setEmoji('📝').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('registration:view').setLabel('Ver meu perfil').setEmoji('👤').setStyle(ButtonStyle.Secondary))] };
}

export async function applyCompatibleRoles(member, profile) {
  const specs = {
    platform: { values: [profile.platform], entries: { pc: ['🖥', 'ᴘᴄ', 0x5865f2], console: ['🎮', 'ᴄᴏɴsᴏʟᴇ', 0x9b59ff], mobile: ['📱', 'ᴍᴏʙɪʟᴇ', 0x00a2ff] } },
    style: { values: [profile.style], entries: { casual: ['🌿', 'ᴄᴀsᴜᴀʟ', 0x2ecc71], competitivo: ['🏆', 'ᴄᴏᴍᴘᴇᴛɪᴛɪᴠᴏ', 0xffd84d], tryhard: ['🔥', 'ᴛʀʏʜᴀʀᴅ', 0xff4655], resenha: ['😂', 'sᴏ́ ʀᴇsᴇɴʜᴀ', 0xf1c40f] } },
    functions: { values: profile.roles ?? [], entries: { duelista: ['⚔', 'ᴅᴜᴇʟɪsᴛᴀ', 0xff4655], iniciador: ['🎯', 'ɪɴɪᴄɪᴀᴅᴏʀ', 0x00d8ff], controlador: ['🌫', 'ᴄᴏɴᴛʀᴏʟᴀᴅᴏʀ', 0x9b59ff], sentinela: ['🛡', 'sᴇɴᴛɪɴᴇʟᴀ', 0x2ecc71], flex: ['🔄', 'ғʟᴇx', 0x00e0c6] } },
    games: { values: profile.games ?? [], entries: { valorant: ['🔺', 'ᴠᴀʟᴏʀᴀɴᴛ', 0xff4655], marvel: ['🦸', 'ᴍᴀʀᴠᴇʟ ʀɪᴠᴀʟs', 0xf39c12], roblox: ['🧱', 'ʀᴏʙʟᴏx', 0x00a2ff], minecraft: ['⛏', 'ᴍɪɴᴇᴄʀᴀғᴛ', 0x65b741], outros: ['🎲', 'ᴏᴜᴛʀᴏs ᴊᴏɢᴏs', 0x9b59ff] } },
    rank: { values: profile.games?.includes('valorant') && profile.rank ? [profile.rank] : [], entries: { sem_elo: ['➖', 'sᴇᴍ ᴇʟᴏ', 0x95a5a6], ferro: ['⚙', 'ғᴇʀʀᴏ', 0x6b7280], bronze: ['🥉', 'ʙʀᴏɴᴢᴇ', 0xcd7f32], prata: ['🥈', 'ᴘʀᴀᴛᴀ', 0xbfc9d4], ouro: ['🥇', 'ᴏᴜʀᴏ', 0xffc400], platina: ['💠', 'ᴘʟᴀᴛɪɴᴀ', 0x45c9c1], diamante: ['💎', 'ᴅɪᴀᴍᴀɴᴛᴇ', 0x9b8cff], ascendente: ['🟢', 'ᴀsᴄᴇɴᴅᴇɴᴛᴇ', 0x20c997], imortal: ['🔴', 'ɪᴍᴏʀᴛᴀʟ', 0xe74c5b], radiante: ['🌟', 'ʀᴀᴅɪᴀɴᴛᴇ', 0xffd700] } }
  };
  for (const group of Object.values(specs)) {
    const markers = Object.values(group.entries).map(([emoji]) => emoji);
    const oldRoles = member.roles.cache.filter(role => !role.managed && role.editable && markers.some(marker => role.name.startsWith(marker)));
    if (oldRoles.size) await member.roles.remove(oldRoles, 'Sincronização do registro da Killjoy').catch(() => {});
    for (const value of group.values.filter(Boolean)) {
      const [emoji, name, color] = group.entries[value] ?? [];
      if (!emoji) continue;
      let role = member.guild.roles.cache.find(item => !item.managed && item.name.startsWith(emoji));
      if (!role && member.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) role = await member.guild.roles.create({ name: `${emoji}・${name}`, color, reason: 'Cargo criado pelo registro da Killjoy' }).catch(() => null);
      if (role?.editable) await member.roles.add(role, 'Escolha feita no registro da Killjoy').catch(() => {});
    }
  }
}

async function publishProfile(interaction, profile, embed) {
  let message = null;
  if (profile.publicMessageId) message = await interaction.channel.messages.fetch(profile.publicMessageId).catch(() => null);
  const payload = { content: `🧪 ${interaction.user} concluiu a calibração de agente.`, embeds: [embed], allowedMentions: { users: [interaction.user.id] } };
  if (message) await message.edit(payload);
  else { message = await interaction.channel.send(payload); profile.publicMessageId = message.id; }
  return message;
}

export async function handleRegistrationInteraction(interaction) {
  const relevant = (interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith('registration:');
  if (!relevant) return false;
  let profiles = await readProfiles(); let profile = profiles[interaction.user.id] ?? {};
  if (interaction.isStringSelectMenu()) {
    const field = interaction.customId.split(':')[2]; const multi = ['games', 'schedule', 'roles', 'looking'].includes(field);
    profiles = await updateJson(profilesPath, {}, data => {
      profile = data[interaction.user.id] ?? {};
      profile[field] = multi ? interaction.values : interaction.values[0];
      profile.updatedAt = new Date().toISOString();
      data[interaction.user.id] = profile;
      return data;
    });
    const currentStep = ['rank', 'roles', 'mic', 'looking'].includes(field) ? 2 : 1;
    await interaction.update(currentStep === 1 ? stepOne(profile) : stepTwo(profile)); return true;
  }
  const action = interaction.customId.split(':')[1];
  if (action === 'start' || action === 'edit') { await interaction.reply({ ...stepOne(profile), ephemeral: true }); return true; }
  if (action === 'view') { if (!Object.keys(profile).length) await interaction.reply({ content: 'Você ainda não começou o registro. Clique em **Começar registro**.', ephemeral: true }); else await interaction.reply({ embeds: [await profileEmbed(interaction.user, profile)], ephemeral: true }); return true; }
  if (action === 'cancel') { await interaction.update({ content: '💾 Progresso salvo. Você pode continuar quando quiser.', embeds: [], components: [] }); return true; }
  if (action === 'step') { await interaction.update(interaction.customId.endsWith(':2') ? stepTwo(profile) : stepOne(profile)); return true; }
  if (action === 'finish') {
    const missing = ['platform', 'games', 'style', 'schedule'].filter(field => !profile[field]?.length);
    if (missing.length) { await interaction.reply({ content: '⚠️ Volte à primeira etapa e complete plataforma, jogos, estilo e horários.', ephemeral: true }); return true; }
    await interaction.update({ content: '```ansi\n\u001b[1;33m[▰▰▱▱] FINALIZANDO REGISTRO...\u001b[0m\n```\n🛠️ Sincronizando cargos e publicando sua ficha.', embeds: [], components: [] });
    profile.completedAt ??= new Date().toISOString(); profile.updatedAt = new Date().toISOString(); profiles[interaction.user.id] = profile; await saveProfiles(profiles);
    const member = await interaction.guild.members.fetch(interaction.user.id); await applyCompatibleRoles(member, profile);
    const embed = await profileEmbed(interaction.user, profile);
    await publishProfile(interaction, profile, embed); profiles[interaction.user.id] = profile; await saveProfiles(profiles);
    await interaction.editReply({ content: '✅ Registro concluído! Sua ficha foi publicada no canal.', embeds: [], components: [] }).catch(() => {});
    setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
    return true;
  }
  return false;
}
