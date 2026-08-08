import 'dotenv/config';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import sharp from 'sharp';
import { AudioPlayerStatus, NoSubscriberBehavior, StreamType, VoiceConnectionStatus, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel } from '@discordjs/voice';
import { handleRegistrationInteraction } from './registration.js';
import { handleLobbyInteraction } from './lobby.js';

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
if (!token || !guildId) throw new Error('Configure DISCORD_TOKEN e GUILD_ID no .env.');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.on('error', error => console.error('Erro do cliente Discord:', error));
process.on('unhandledRejection', error => console.error('Promessa rejeitada sem tratamento:', error));

const colors = { blue: 0x0077ff, yellow: 0xffd84d, green: 0x2ecc71 };
const footer = { text: 'Killjoy Control — relaxa, eu cuido disso 💛' };
const valorantAgents = ['Astra', 'Breach', 'Brimstone', 'Chamber', 'Clove', 'Cypher', 'Deadlock', 'Fade', 'Gekko', 'Harbor', 'Iso', 'Jett', 'KAY/O', 'Killjoy', 'Miks', 'Neon', 'Omen', 'Phoenix', 'Raze', 'Reyna', 'Sage', 'Skye', 'Sova', 'Tejo', 'Veto', 'Viper', 'Vyse', 'Waylay', 'Yoru'];
const agentEmojis = { Astra: '🌌', Breach: '🦾', Brimstone: '🛰️', Chamber: '🎩', Clove: '🦋', Cypher: '👁️', Deadlock: '🕸️', Fade: '🌑', Gekko: '🦎', Harbor: '🌊', Iso: '🎯', Jett: '🌪️', 'KAY/O': '🤖', Killjoy: '🛠️', Miks: '🎵', Neon: '⚡', Omen: '👻', Phoenix: '🔥', Raze: '💣', Reyna: '👑', Sage: '💎', Skye: '🦅', Sova: '🏹', Tejo: '🚀', Veto: '⛓️', Viper: '☣️', Vyse: '🌹', Waylay: '✨', Yoru: '🌀' };
const agentGroups = [valorantAgents.slice(0, 15), valorantAgents.slice(15)];
let agentVisualsCache = null;
const roleMap = {
  casual: '🌿・ᴄᴀsᴜᴀʟ', tryhard: '🔥・ᴛʀʏʜᴀʀᴅ', competitivo: '🏆・ᴄᴏᴍᴘᴇᴛɪᴛɪᴠᴏ',
  mobile: '📱・ᴍᴏʙɪʟᴇ', pc: '🖥️・ᴘᴄ', duelista: '⚔️・ᴅᴜᴇʟɪsᴛᴀ', sentinela: '🛡️・sᴇɴᴛɪɴᴇʟᴀ',
  controlador: '🌫️・ᴄᴏɴᴛʀᴏʟᴀᴅᴏʀ', iniciador: '🎯・ɪɴɪᴄɪᴀᴅᴏʀ', sem_mira: '🙈・sᴇᴍ ᴍɪʀᴀ'
};
const commands = [
  new SlashCommandBuilder().setName('painel').setDescription('Publica um painel da Killjoy')
    .addStringOption(o => o.setName('tipo').setDescription('Painel desejado').setRequired(true)
      .addChoices(
        { name: 'Cargos', value: 'cargos' }, { name: 'Ticket', value: 'ticket' },
        { name: 'Regras', value: 'regras' }, { name: 'Informações', value: 'info' }
      )).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('aviso').setDescription('Registra um aviso de moderação')
    .addUserOption(o => o.setName('membro').setDescription('Quem receberá o aviso').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo do aviso').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('zoeira').setDescription('Convida alguém para uma zoeira nas calls')
    .addUserOption(o => o.setName('membro').setDescription('Alvo da zoeira').setRequired(true)),
  new SlashCommandBuilder().setName('ping').setDescription('Verifica se a Killjoy está funcionando')
  ,new SlashCommandBuilder().setName('ajuda').setDescription('Mostra os recursos disponíveis da Killjoy')
  ,new SlashCommandBuilder().setName('testar-boas-vindas').setDescription('Mostra uma prévia do cartão de boas-vindas')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  ,new SlashCommandBuilder().setName('agentes').setDescription('Configura os agentes que você possui')
    .addSubcommand(s => s.setName('adicionar').setDescription('Adiciona um agente à sua coleção')
      .addStringOption(o => o.setName('agente').setDescription('Digite para pesquisar').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('remover').setDescription('Remove um agente da sua coleção')
      .addStringOption(o => o.setName('agente').setDescription('Digite para pesquisar').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('lista').setDescription('Mostra sua coleção cadastrada'))
    .addSubcommand(s => s.setName('todos').setDescription('Informa que você possui todos os agentes'))
    .addSubcommand(s => s.setName('resetar').setDescription('Apaga seu cadastro de agentes'))
  ,new SlashCommandBuilder().setName('sortear-agente').setDescription('Sorteia somente entre os agentes disponíveis da pessoa')
    .addUserOption(o => o.setName('membro').setDescription('Pessoa do sorteio; vazio usa você'))
  ,new SlashCommandBuilder().setName('som-killjoy').setDescription('Chama a Killjoy para tocar um efeito tecnológico baixinho na sua call')
].map(command => command.toJSON());

function roleButton(key, label, emoji) {
  return new ButtonBuilder().setCustomId(`role:${key}`).setLabel(label)
    .setEmoji(emoji).setStyle(ButtonStyle.Secondary);
}

async function sendRolePanels(channel) {
  await channel.send({ embeds: [new EmbedBuilder().setColor(colors.blue).setTitle('🎭 Registro de cargos')
    .setDescription('Clique nos botões para pegar ou remover cargos. Escolha só o que combina com você.').setFooter(footer)] });
  const panels = [
    ['🌿 Gameplay', 'Escolha seu jeito de jogar.', [roleButton('casual', 'Casual', '🌿'), roleButton('tryhard', 'Tryhard', '🔥'), roleButton('competitivo', 'Competitivo', '🏆')]],
    ['💻 Plataforma', 'Mostra onde você costuma jogar.', [roleButton('mobile', 'Mobile', '📱'), roleButton('pc', 'PC', '💻')]],
    ['🎯 Valorant', 'Marque suas funções preferidas.', [roleButton('duelista', 'Duelista', '⚔️'), roleButton('sentinela', 'Sentinela', '🛡️'), roleButton('controlador', 'Controlador', '🌫️'), roleButton('iniciador', 'Iniciador', '💥')]],
    ['😂 Zueira', 'Cargos só pela resenha.', [roleButton('sem_mira', 'Sem Mira', '😂')]]
  ];
  for (const [title, description, buttons] of panels) {
    await channel.send({ embeds: [new EmbedBuilder().setColor(colors.green).setTitle(title).setDescription(description)], components: [new ActionRowBuilder().addComponents(buttons)] });
  }
}

async function sendPanel(interaction, type) {
  if (type === 'cargos') return sendRolePanels(interaction.channel);
  if (type === 'ticket') return interaction.channel.send({
    embeds: [new EmbedBuilder().setColor(colors.yellow).setTitle('🎫 Suporte').setDescription('Abra um ticket para denúncia, problema, parceria ou ajuda direta com a equipe.').setFooter(footer)],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket:open').setLabel('Abrir ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary))]
  });
  if (type === 'regras') return interaction.channel.send({ embeds: [new EmbedBuilder().setColor(colors.blue).setTitle('📜 Regras do Patifes')
    .setDescription('Aqui é pra todo mundo jogar, conversar e zoar de boa. Segue o básico para manter o servidor leve.')
    .addFields(
      { name: '💬 Respeito', value: 'Sem ofensa pesada, preconceito ou provocação para estragar o clima.' },
      { name: '🔊 Calls', value: 'Nada de estourar microfone ou atrapalhar quem está jogando.' },
      { name: '🎮 Gameplay', value: 'Pode zoar, mas sem estragar partidas ou partir para flame pesado.' },
      { name: '🚫 Spam e divulgação', value: 'Sem flood, links suspeitos ou divulgação sem permissão.' },
      { name: '📸 Conteúdo', value: 'Nada de gore, NSFW ou conteúdo que possa dar problema.' },
      { name: '⚠️ Moderação', value: 'Quem passar do limite pode receber mute, kick ou ban.' }
    ).setFooter(footer)] });
  return interaction.channel.send({ embeds: [new EmbedBuilder().setColor(colors.blue).setTitle('📌 Info do servidor')
    .setDescription('Bem-vindo(a) ao **Patifes**! Aqui é para conversar, jogar, entrar em call, mandar clipe e ficar de boa com o pessoal. Use os canais certos e, se precisar de ajuda, abra um ticket.').setFooter(footer)] });
}

async function readWarnings() {
  try { return JSON.parse(await readFile('data/warnings.json', 'utf8')); } catch { return {}; }
}

async function writeWarnings(warnings) {
  await mkdir('data', { recursive: true });
  await writeFile('data/warnings.json', JSON.stringify(warnings, null, 2), 'utf8');
}

async function readAgentProfiles() {
  try { return JSON.parse(await readFile('data/agent-profiles.json', 'utf8')); } catch { return {}; }
}

async function writeAgentProfiles(profiles) {
  await mkdir('data', { recursive: true });
  await writeFile('data/agent-profiles.json', JSON.stringify(profiles, null, 2), 'utf8');
}

async function getAgentVisual(agentName) {
  try {
    if (!agentVisualsCache) {
      const response = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=pt-BR');
      if (!response.ok) throw new Error('Falha ao carregar imagens dos agentes');
      agentVisualsCache = (await response.json()).data;
    }
    return agentVisualsCache.find(agent => agent.displayName.toLocaleLowerCase('pt-BR') === agentName.toLocaleLowerCase('pt-BR')) ?? null;
  } catch (error) {
    console.error('Visual de agente indisponível:', error.message);
    return null;
  }
}

async function playKilljoySound(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) return interaction.reply({ content: 'Entre em uma call primeiro para eu localizar você. 🛠️', ephemeral: true });
  const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
  if (!permissions?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    return interaction.reply({ content: 'Preciso das permissões **Conectar** e **Falar** nessa call.', ephemeral: true });
  }
  await interaction.reply({ content: '🛰️ Sinal localizado. Indo para a call...', ephemeral: true });
  const connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: interaction.guild.id, adapterCreator: interaction.guild.voiceAdapterCreator, selfDeaf: true });
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    const resource = createAudioResource('assets/killjoy-sound-soft.ogg', { inputType: StreamType.OggOpus });
    connection.subscribe(player);
    player.play(resource);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Tempo do áudio excedido')), 10_000);
      player.once(AudioPlayerStatus.Idle, () => { clearTimeout(timeout); resolve(); });
      player.once('error', error => { clearTimeout(timeout); reject(error); });
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    await interaction.editReply('✅ Efeito concluído. Volume calibrado para não estourar o ouvido de ninguém.');
  } finally {
    connection.destroy();
  }
}

function agentPanelComponents() {
  const selects = agentGroups.map((agents, index) => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`agent:add:${index}`).setPlaceholder(index === 0 ? 'Adicionar agentes — A até M' : 'Adicionar agentes — N até Y')
      .setMinValues(1).setMaxValues(agents.length).addOptions(agents.map(agent => ({ label: agent, value: agent, emoji: agentEmojis[agent] })))
  ));
  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('agent:all').setLabel('Tenho todos').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('agent:list').setLabel('Ver meu cadastro').setEmoji('📋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('agent:reset').setLabel('Resetar').setEmoji('🧹').setStyle(ButtonStyle.Secondary)
  );
  return [...selects, controls];
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

async function createWelcomeCard(member) {
  const avatarResponse = await fetch(member.user.displayAvatarURL({ extension: 'png', size: 512 }));
  if (!avatarResponse.ok) throw new Error('Não foi possível carregar o avatar.');
  const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
  const avatar = await sharp(avatarBuffer).resize(230, 230, { fit: 'cover' })
    .composite([{ input: Buffer.from('<svg width="230" height="230"><circle cx="115" cy="115" r="108" fill="white"/></svg>'), blend: 'dest-in' }]).png().toBuffer();
  const username = escapeXml(member.user.displayName || member.user.username);
  const memberCount = member.guild.memberCount;
  const overlay = Buffer.from(`<svg width="1000" height="420" xmlns="http://www.w3.org/2000/svg">
    <style>
      .label { font: 700 22px Arial, sans-serif; fill: #d7ff35; letter-spacing: 4px; }
      .name { font: 900 54px Arial, sans-serif; fill: #ffffff; }
      .body { font: 500 24px Arial, sans-serif; fill: #b8c8d8; }
      .count { font: 800 23px Arial, sans-serif; fill: #071018; }
      .footer { font: 700 18px Arial, sans-serif; fill: #00e0c6; letter-spacing: 2px; }
    </style>
    <circle cx="183" cy="210" r="123" fill="none" stroke="#d7ff35" stroke-width="7"/>
    <circle cx="183" cy="210" r="132" fill="none" stroke="#00e0c6" stroke-width="2" stroke-dasharray="18 12"/>
    <text x="355" y="118" class="label">NOVO AGENTE DETECTADO</text>
    <text x="355" y="190" class="name">${username.slice(0, 22)}</text>
    <text x="355" y="235" class="body">foi aprovado pela Killjoy. Pode entrar!</text>
    <rect x="355" y="270" width="210" height="54" rx="12" fill="#ffd52a"/>
    <text x="380" y="305" class="count">MEMBRO ${memberCount}</text>
    <text x="600" y="305" class="footer">KILLJOY // ONLINE</text>
  </svg>`);
  return sharp('assets/killjoy-welcome-bg.png').resize(1000, 420, { fit: 'cover' })
    .composite([{ input: avatar, left: 68, top: 95 }, { input: overlay, left: 0, top: 0 }]).png().toBuffer();
}

async function sendWelcome(member, channel) {
  let card = null;
  try { card = await createWelcomeCard(member); } catch (error) { console.error('Falha no cartão de boas-vindas:', error); }
  const embed = new EmbedBuilder().setColor(colors.yellow).setTitle('🛠️ Novo agente detectado')
    .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setDescription(`**${member.user.username}** foi aprovado pela Killjoy. Pode entrar!\n\nPegue seus cargos, chame a tropa no lobby e cuidado com a torreta.\n\nAgora somos **${member.guild.memberCount}** membros.`)
    .addFields({ name: 'Membro', value: String(member.guild.memberCount), inline: true }).setFooter(footer).setTimestamp();
  const files = card ? [new AttachmentBuilder(card, { name: 'killjoy-welcome.png' })] : [];
  if (card) embed.setImage('attachment://killjoy-welcome.png');
  return channel.send({ content: `${member}`, embeds: [embed], files, allowedMentions: { users: [member.id] } });
}

client.once('clientReady', async () => {
  const guild = await client.guilds.fetch(guildId);
  await guild.commands.set(commands);
  client.user.setActivity('protegendo o Patifes 🛠️');
  console.log(`Killjoy online em ${guild.name}.`);
});

client.on('guildMemberAdd', async member => {
  const channel = member.guild.channels.cache.find(c => c.name.includes('boas-vindas') && c.isTextBased());
  if (!channel) return;
  await sendWelcome(member, channel).catch(() => {});
});

client.on('interactionCreate', async interaction => {
  try {
    if (await handleRegistrationInteraction(interaction)) return;
    if (await handleLobbyInteraction(interaction)) return;
    if (interaction.isAutocomplete()) {
      const query = interaction.options.getFocused().toLocaleLowerCase('pt-BR');
      const matches = valorantAgents.filter(agent => agent.toLocaleLowerCase('pt-BR').includes(query)).slice(0, 25);
      return interaction.respond(matches.map(agent => ({ name: agent, value: agent })));
    }
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'ping') return interaction.reply({ content: `🛠️ Tudo funcionando! ${client.ws.ping}ms`, ephemeral: true });
      if (interaction.commandName === 'ajuda') return interaction.reply({ embeds: [new EmbedBuilder().setColor(colors.yellow).setTitle('🛠️ Central da Killjoy')
        .setDescription('**/ping** — testa o bot\n**/zoeira** — convite interativo\n**/painel** — publica painéis administrativos\n**/aviso** — registra advertência\n\nOs botões de cargos e tickets funcionam diretamente nos painéis.').setFooter(footer)], ephemeral: true });
      if (interaction.commandName === 'testar-boas-vindas') {
        await interaction.deferReply({ ephemeral: true });
        const member = await interaction.guild.members.fetch(interaction.user.id);
        await sendWelcome(member, interaction.channel);
        return interaction.editReply('Prévia criada no canal. 💛');
      }
      if (interaction.commandName === 'agentes') {
        const profiles = await readAgentProfiles();
        const subcommand = interaction.options.getSubcommand();
        const profile = profiles[interaction.user.id] ?? { all: false, agents: [] };
        if (subcommand === 'todos') {
          profiles[interaction.user.id] = { all: true, agents: [] };
          await writeAgentProfiles(profiles);
          return interaction.reply({ content: '✅ Anotado: você possui todos os agentes. O arsenal está liberado!', ephemeral: true });
        }
        if (subcommand === 'resetar') {
          delete profiles[interaction.user.id];
          await writeAgentProfiles(profiles);
          return interaction.reply({ content: '🧹 Seu cadastro de agentes foi apagado.', ephemeral: true });
        }
        if (subcommand === 'lista') {
          if (profile.all) return interaction.reply({ content: '🧪 Seu cadastro está como **todos os agentes**.', ephemeral: true });
          if (!profile.agents.length) return interaction.reply({ content: 'Você ainda não cadastrou agentes. Use `/agentes adicionar` ou `/agentes todos`.', ephemeral: true });
          return interaction.reply({ content: `🎯 Seus agentes (${profile.agents.length}): **${profile.agents.sort().join(', ')}**`, ephemeral: true });
        }
        const agent = interaction.options.getString('agente');
        if (!valorantAgents.includes(agent)) return interaction.reply({ content: 'Esse agente não está na lista oficial atual.', ephemeral: true });
        if (profile.all) return interaction.reply({ content: 'Seu perfil está marcado como **todos**. Use `/agentes resetar` para montar uma lista específica.', ephemeral: true });
        profile.agents ??= [];
        if (subcommand === 'adicionar') {
          if (!profile.agents.includes(agent)) profile.agents.push(agent);
          profiles[interaction.user.id] = profile;
          await writeAgentProfiles(profiles);
          return interaction.reply({ content: `✅ **${agent}** adicionado. Total disponível: ${profile.agents.length}.`, ephemeral: true });
        }
        profile.agents = profile.agents.filter(item => item !== agent);
        profiles[interaction.user.id] = profile;
        await writeAgentProfiles(profiles);
        return interaction.reply({ content: `➖ **${agent}** removido. Total disponível: ${profile.agents.length}.`, ephemeral: true });
      }
      if (interaction.commandName === 'sortear-agente') {
        const user = interaction.options.getUser('membro') ?? interaction.user;
        if (user.bot) return interaction.reply({ content: 'Robôs não entram na seleção de agentes 😅', ephemeral: true });
        const profiles = await readAgentProfiles();
        const profile = profiles[user.id];
        if (!profile || (!profile.all && !profile.agents?.length)) {
          return interaction.reply({ content: `${user} ainda não cadastrou os agentes. Use **/agentes adicionar** ou **/agentes todos** primeiro.`, allowedMentions: { users: [user.id] } });
        }
        const pool = profile.all ? valorantAgents : profile.agents.filter(agent => valorantAgents.includes(agent));
        await interaction.deferReply();
        const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
        await interaction.editReply('```ansi\n\u001b[1;33m[▰▱▱▱] ACESSANDO ARSENAL...\u001b[0m\n```');
        await wait(650);
        await interaction.editReply('```ansi\n\u001b[1;36m[▰▰▰▱] ANALISANDO COMPATIBILIDADE...\u001b[0m\n```');
        await wait(650);
        const selected = pool[Math.floor(Math.random() * pool.length)];
        await interaction.editReply('```ansi\n\u001b[1;32m[▰▰▰▰] AGENTE CONFIRMADO!\u001b[0m\n```');
        await wait(500);
        const visual = await getAgentVisual(selected);
        const agentColor = visual?.backgroundGradientColors?.[0] ? Number.parseInt(visual.backgroundGradientColors[0].slice(0, 6), 16) : colors.yellow;
        const embed = new EmbedBuilder().setColor(agentColor).setTitle(`${agentEmojis[selected]}  ${selected.toLocaleUpperCase('pt-BR')} FOI ESCOLHID${selected === 'Sage' || selected === 'Jett' || selected === 'Raze' || selected === 'Reyna' || selected === 'Skye' || selected === 'Viper' || selected === 'Vyse' || selected === 'Waylay' || selected === 'Neon' || selected === 'Killjoy' || selected === 'Astra' || selected === 'Clove' || selected === 'Deadlock' || selected === 'Fade' ? 'A' : 'O'}!`)
          .setDescription(`## ${user}\nA seleção tática da Killjoy terminou. Seu agente desta partida é **${selected}**.`)
          .addFields(
            { name: '🎲 Arsenal considerado', value: `**${pool.length} agentes** do seu cadastro`, inline: true },
            { name: '🛠️ Diagnóstico', value: 'Combinação perigosa. Aprovado.', inline: true }
          ).setFooter(footer).setTimestamp();
        if (visual?.displayIcon) embed.setThumbnail(visual.displayIcon);
        if (visual?.fullPortraitV2 ?? visual?.fullPortrait) embed.setImage(visual.fullPortraitV2 ?? visual.fullPortrait);
        const resultMessage = await interaction.editReply({ content: `${agentEmojis[selected]} **RESULTADO DO SORTEIO**\n-# Esta mensagem será apagada automaticamente em 5 minutos.`, embeds: [embed], allowedMentions: { users: [user.id] } });
        setTimeout(() => resultMessage.delete().catch(() => {}), 5 * 60 * 1000);
        return resultMessage;
      }
      if (interaction.commandName === 'som-killjoy') return await playKilljoySound(interaction);
      if (interaction.commandName === 'painel') {
        await interaction.deferReply({ ephemeral: true });
        await sendPanel(interaction, interaction.options.getString('tipo'));
        return interaction.editReply('Painel publicado. Relaxa, eu cuidei disso. 💛');
      }
      if (interaction.commandName === 'aviso') {
        const user = interaction.options.getUser('membro');
        const reason = interaction.options.getString('motivo');
        const warnings = await readWarnings();
        warnings[user.id] ??= [];
        warnings[user.id].push({ reason, moderator: interaction.user.id, at: new Date().toISOString() });
        await writeWarnings(warnings);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(colors.blue).setTitle('Aviso registrado')
          .setDescription(`${user} recebeu aviso. Total: **${warnings[user.id].length}**.\nMotivo: ${reason}`).setFooter(footer).setTimestamp()] });
      }
      if (interaction.commandName === 'zoeira') {
        const target = interaction.options.getUser('membro');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`prank:yes:${interaction.user.id}:${target.id}`).setLabel('Aceito a zoeira').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`prank:no:${interaction.user.id}:${target.id}`).setLabel('Hoje não').setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ content: `${target}, ${interaction.user} quer te jogar pelas calls por alguns segundos. Você aceita?`, components: [row], allowedMentions: { users: [target.id] } });
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('agent:add:')) {
      const profiles = await readAgentProfiles();
      const profile = profiles[interaction.user.id] ?? { all: false, agents: [] };
      profile.all = false;
      profile.agents = [...new Set([...(profile.agents ?? []), ...interaction.values])].filter(agent => valorantAgents.includes(agent));
      profiles[interaction.user.id] = profile;
      await writeAgentProfiles(profiles);
      return interaction.reply({ content: `✅ Adicionei **${interaction.values.join(', ')}**. Você tem **${profile.agents.length}** agentes cadastrados.`, ephemeral: true });
    }
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith('agent:')) {
      const action = interaction.customId.split(':')[1];
      const profiles = await readAgentProfiles();
      const profile = profiles[interaction.user.id] ?? { all: false, agents: [] };
      if (action === 'all') {
        profiles[interaction.user.id] = { all: true, agents: [] };
        await writeAgentProfiles(profiles);
        return interaction.reply({ content: '✅ Perfil configurado com **todos os agentes**.', ephemeral: true });
      }
      if (action === 'reset') {
        delete profiles[interaction.user.id];
        await writeAgentProfiles(profiles);
        return interaction.reply({ content: '🧹 Cadastro apagado. Use os seletores acima para começar novamente.', ephemeral: true });
      }
      const content = profile.all ? '📋 Seu perfil está configurado com **todos os agentes**.' : profile.agents?.length ? `📋 Seus agentes (${profile.agents.length}): **${profile.agents.sort().join(', ')}**` : '📋 Você ainda não cadastrou agentes.';
      return interaction.reply({ content, ephemeral: true });
    }
    if (interaction.customId.startsWith('role:')) {
      const key = interaction.customId.split(':')[1];
      const roleName = roleMap[key];
      const role = interaction.guild.roles.cache.find(r => r.name === roleName);
      if (!role) return interaction.reply({ content: `Não achei o cargo **${roleName}**. Um administrador precisa criá-lo.`, ephemeral: true });
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        return interaction.reply({ content: `Cargo **${role.name}** removido.`, ephemeral: true });
      }
      await member.roles.add(role);
      return interaction.reply({ content: `Cargo **${role.name}** adicionado!`, ephemeral: true });
    }
    if (interaction.customId === 'ticket:open') {
      const existing = interaction.guild.channels.cache.find(c => c.topic === `ticket:${interaction.user.id}`);
      if (existing) return interaction.reply({ content: `Você já tem um ticket: ${existing}`, ephemeral: true });
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90),
        type: ChannelType.GuildText,
        topic: `ticket:${interaction.user.id}`,
        parent: interaction.channel.parentId,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });
      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:close').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket:delete').setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      );
      await channel.send({ content: `🎫 ${interaction.user}, explique o que aconteceu e envie prints se precisar. A equipe responderá por aqui.`, components: [controls] });
      return interaction.reply({ content: `Ticket criado: ${channel}`, ephemeral: true });
    }
    if (interaction.customId === 'ticket:close') {
      const ownerId = interaction.channel.topic?.startsWith('ticket:') ? interaction.channel.topic.split(':')[1] : null;
      if (!ownerId) return interaction.reply({ content: 'Este canal não é um ticket reconhecido.', ephemeral: true });
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
      if (interaction.user.id !== ownerId && !isStaff) return interaction.reply({ content: 'Só o autor ou a equipe pode fechar este ticket.', ephemeral: true });
      await interaction.channel.permissionOverwrites.edit(ownerId, { SendMessages: false });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:reopen').setLabel('Reabrir').setEmoji('🔓').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ticket:delete').setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      );
      return interaction.update({ content: `🔒 Ticket fechado por ${interaction.user}.`, components: [row] });
    }
    if (interaction.customId === 'ticket:reopen') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: 'Só a equipe pode reabrir tickets.', ephemeral: true });
      const ownerId = interaction.channel.topic?.split(':')[1];
      if (ownerId) await interaction.channel.permissionOverwrites.edit(ownerId, { SendMessages: true });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:close').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket:delete').setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      );
      return interaction.update({ content: `🔓 Ticket reaberto por ${interaction.user}.`, components: [row] });
    }
    if (interaction.customId === 'ticket:delete') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: 'Só a equipe pode excluir tickets.', ephemeral: true });
      await interaction.reply('🗑️ Ticket será excluído em 5 segundos.');
      setTimeout(() => interaction.channel.delete(`Ticket excluído por ${interaction.user.tag}`).catch(() => {}), 5000);
      return;
    }
    if (interaction.customId.startsWith('prank:')) {
      const [, answer, authorId, targetId] = interaction.customId.split(':');
      if (interaction.user.id !== targetId) return interaction.reply({ content: 'Só a pessoa convidada pode responder.', ephemeral: true });
      if (answer !== 'yes') return interaction.update({ content: `🛡️ <@${targetId}> recusou. Torreta desativada por hoje.`, components: [], allowedMentions: { users: [authorId, targetId] } });

      const target = await interaction.guild.members.fetch(targetId);
      const originalChannel = target.voice.channel;
      const originalChannelId = originalChannel?.id;
      if (!originalChannel) return interaction.update({ content: `⚠️ <@${targetId}> aceitou, mas não está em nenhuma call. Entre em uma call e tente de novo.`, components: [], allowedMentions: { users: [targetId] } });
      if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.MoveMembers)) {
        return interaction.update({ content: '⚠️ Aceito, mas preciso da permissão **Mover membros** para executar a zoeira.', components: [] });
      }

      const destinations = interaction.guild.channels.cache
        .filter(channel => channel.type === ChannelType.GuildVoice && channel.id !== originalChannelId && channel.joinable && (!channel.userLimit || channel.members.size < channel.userLimit))
        .map(channel => channel)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      if (!destinations.length) return interaction.update({ content: '⚠️ Não encontrei outra call acessível para fazer a zoeira.', components: [] });

      await interaction.update({ content: `😂 <@${targetId}> aceitou a zoeira de <@${authorId}>. Torreta ativada!`, components: [], allowedMentions: { users: [authorId, targetId] } });
      const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
      let movementError = null;
      try {
        for (const destination of destinations) {
          const freshTarget = await interaction.guild.members.fetch(targetId);
          if (!freshTarget.voice.channelId) break;
          await freshTarget.voice.setChannel(destination, `Zoeira consentida por ${target.user.tag}`);
          await wait(700);
        }
      } catch (error) {
        movementError = error;
      } finally {
        const freshTarget = await interaction.guild.members.fetch(targetId).catch(() => null);
        if (freshTarget?.voice.channelId && originalChannelId) {
          await freshTarget.voice.setChannel(originalChannelId, 'Fim da zoeira — retorno garantido à call original').catch(error => { movementError ??= error; });
        }
      }
      return interaction.followUp({ content: movementError ? `⚠️ A brincadeira encontrou um bloqueio, mas tentei devolver <@${targetId}> à call original.` : `🛠️ Experimento concluído. <@${targetId}> voltou para **${originalChannel.name}**.`, allowedMentions: { users: [targetId] } });
    }
  } catch (error) {
    console.error(error);
    const response = { content: '⚠️ Algo travou no laboratório. Confira minhas permissões.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
    else await interaction.reply(response).catch(() => {});
  }
});

const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    service: 'killjoy',
    botReady: client.isReady(),
    tag: client.user?.tag ?? null
  }));
}).listen(port, () => {
  console.log(`[Killjoy] Healthcheck HTTP ativo na porta ${port}`);
});

client.login(token);
