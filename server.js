import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 
  Client, 
  GatewayIntentBits, 
  ChannelType, 
  EmbedBuilder, 
  ActivityType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  StreamType, 
  getVoiceConnection, 
  NoSubscriberBehavior, 
  entersState, 
  VoiceConnectionStatus
} from '@discordjs/voice';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID || '1515187485531967629';
const CLIENT_ID = process.env.CLIENT_ID || '1531112285219586088';
const KTOS_PANEL_SECRET = process.env.KTOS_PANEL_SECRET || '';
const TEMP_AUDIO_PATH = path.join(__dirname, 'temp_audio.mp3');

const KILLJOY_YELLOW = 0xffed00;
const XODO_ROLE_NAME = 'ðŸ§¸XodÃ³ do Coca';
const AGENTS_CHANNEL_NAME = 'agentes';
const VALORANT_AGENTS = [
  'Jett', 'Reyna', 'Raze', 'Phoenix', 'Yoru', 'Neon', 'Iso',
  'Sova', 'Breach', 'Skye', 'KAY/O', 'Fade', 'Gekko', 'Tejo',
  'Brimstone', 'Viper', 'Omen', 'Astra', 'Harbor', 'Clove',
  'Killjoy', 'Cypher', 'Sage', 'Chamber', 'Deadlock', 'Vyse'
];

const AGENT_IMAGES = {
  Astra: 'https://media.valorant-api.com/agents/41fb69c1-4189-7b37-f117-bcaf1e96f1bf/fullportrait.png',
  Breach: 'https://media.valorant-api.com/agents/5f8d3a7f-467b-97f3-062c-13acf203c006/fullportrait.png',
  Brimstone: 'https://media.valorant-api.com/agents/9f0d8ba9-4140-b941-57d3-a7ad57c6b417/fullportrait.png',
  Chamber: 'https://media.valorant-api.com/agents/22697a3d-45bf-8dd7-4fec-84a9e28c69d7/fullportrait.png',
  Clove: 'https://media.valorant-api.com/agents/1dbf2edd-4729-0984-3115-daa5eed44993/fullportrait.png',
  Cypher: 'https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada7e3823b/fullportrait.png',
  Deadlock: 'https://media.valorant-api.com/agents/cc8b64c8-4b25-4ff9-6e7f-37b4da43d235/fullportrait.png',
  Fade: 'https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/fullportrait.png',
  Gekko: 'https://media.valorant-api.com/agents/e370fa57-4757-3604-3648-499e1f642d3f/fullportrait.png',
  Harbor: 'https://media.valorant-api.com/agents/95b78ed7-4637-86d9-7e41-71ba8c293152/fullportrait.png',
  Iso: 'https://media.valorant-api.com/agents/0e38b510-41a8-5780-5e8f-568b2a4f2d6c/fullportrait.png',
  Jett: 'https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/fullportrait.png',
  'KAY/O': 'https://media.valorant-api.com/agents/601dbbe7-43ce-be57-2a40-4abd24953621/fullportrait.png',
  Killjoy: 'https://media.valorant-api.com/agents/1e58de9c-4950-5125-93e9-a0aee9f98746/fullportrait.png',
  Neon: 'https://media.valorant-api.com/agents/bb2a4828-46eb-8cd1-e765-15848195d751/fullportrait.png',
  Omen: 'https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/fullportrait.png',
  Phoenix: 'https://media.valorant-api.com/agents/eb93336a-449b-9c1b-0a54-a891f7921d69/fullportrait.png',
  Raze: 'https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5aa313dba261/fullportrait.png',
  Reyna: 'https://media.valorant-api.com/agents/a3bfb853-43b2-7238-a4f1-ad90e9e46bcc/fullportrait.png',
  Sage: 'https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/fullportrait.png',
  Skye: 'https://media.valorant-api.com/agents/6f2a04ca-43e0-be17-7f36-b3908627744d/fullportrait.png',
  Sova: 'https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/fullportrait.png',
  Tejo: 'https://media.valorant-api.com/agents/b444168c-4e35-8076-db47-ef9bf368f384/fullportrait.png',
  Viper: 'https://media.valorant-api.com/agents/707eab51-4836-f488-046a-cda6bf494859/fullportrait.png',
  Vyse: 'https://media.valorant-api.com/agents/efba5359-4016-a1e5-7626-b1ae76895940/fullportrait.png',
  Yoru: 'https://media.valorant-api.com/agents/7f94d92c-4234-0a36-9646-3a87eb8b5c89/fullportrait.png'
};

const DATA_DIR = path.join(__dirname, 'data');
const AGENT_POOLS_FILE = path.join(DATA_DIR, 'agent-pools.json');
const PANEL_STATE_FILE = path.join(DATA_DIR, 'panel-state.json');
const agentPools = loadAgentPools();

function loadAgentPools() {
  try {
    if (!fs.existsSync(AGENT_POOLS_FILE)) return {};
    return JSON.parse(fs.readFileSync(AGENT_POOLS_FILE, 'utf8'));
  } catch (err) {
    console.error('[Killjoy] NÃ£o consegui ler agent-pools.json:', err.message);
    return {};
  }
}

function saveAgentPools() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(AGENT_POOLS_FILE, JSON.stringify(agentPools, null, 2), 'utf8');
}

function loadPanelState() {
  try {
    if (!fs.existsSync(PANEL_STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(PANEL_STATE_FILE, 'utf8'));
  } catch (err) {
    console.error('[Killjoy] NÃ£o consegui ler panel-state.json:', err.message);
    return {};
  }
}

function savePanelState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PANEL_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function getUserAgents(userId) {
  const selected = Array.isArray(agentPools[userId]) ? agentPools[userId] : [];
  return selected.filter(agent => VALORANT_AGENTS.includes(agent));
}

function randomAgent(pool = VALORANT_AGENTS) {
  const safePool = pool.length ? pool : VALORANT_AGENTS;
  return safePool[Math.floor(Math.random() * safePool.length)];
}

function buildAgentSelectRows(userId) {
  const selected = new Set(getUserAgents(userId));
  const chunks = [];
  for (let i = 0; i < VALORANT_AGENTS.length; i += 25) chunks.push(VALORANT_AGENTS.slice(i, i + 25));
  return chunks.map((chunk, index) => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('agent_select_' + index)
      .setPlaceholder(index === 0 ? 'Escolha seus agentes â€” parte 1' : 'Escolha seus agentes â€” parte 2')
      .setMinValues(0)
      .setMaxValues(chunk.length)
      .addOptions(chunk.map(agent => ({ label: agent, value: agent, default: selected.has(agent) })))
  ));
}

function buildFixedAgentPanelRows() {
  const chunks = [];
  for (let i = 0; i < VALORANT_AGENTS.length; i += 25) chunks.push(VALORANT_AGENTS.slice(i, i + 25));
  return chunks.map((chunk, index) => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('agent_panel_select_' + index)
      .setPlaceholder(index === 0 ? 'Escolha seus agentes â€” parte 1' : 'Escolha seus agentes â€” parte 2')
      .setMinValues(0)
      .setMaxValues(chunk.length)
      .addOptions(chunk.map(agent => ({ label: agent, value: agent })))
  ));
}

function buildFixedAgentPanelControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('agent_panel_roll').setLabel('Sortear').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('agent_panel_show').setLabel('Meu cadastro').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('agent_panel_clear').setLabel('Limpar minha lista').setStyle(ButtonStyle.Danger)
  );
}

function buildAgentControlRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('agent_roll_saved').setLabel('Sortear meus agentes').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('agent_show_saved').setLabel('Ver cadastro').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('agent_clear_saved').setLabel('Limpar lista').setStyle(ButtonStyle.Danger)
  );
}

function buildAgentSetupEmbed(user) {
  const selected = getUserAgents(user.id);
  return new EmbedBuilder()
    .setColor(KILLJOY_YELLOW)
    .setTitle('KILLJOY // ESCOLHA DE AGENTES')
    .setDescription([
      user + ', selecione os agentes que vocÃª tem/quer jogar nos menus abaixo.',
      '',
      selected.length ? '**Salvos agora:** ' + selected.join(', ') : '**Salvos agora:** nenhum agente cadastrado ainda.',
      '',
      'Depois Ã© sÃ³ usar **Sortear meus agentes**. Eu salvo isso no arquivo local do bot.'
    ].join('\n'))
    .setFooter({ text: 'Cadastro por pessoa â€” Patifes edition' })
    .setTimestamp();
}

function buildAgentRouletteEmbed(user, picked, pool) {
  return new EmbedBuilder()
    .setColor(KILLJOY_YELLOW)
    .setTitle('🎯 AGENTE SORTEADO // ' + picked.toUpperCase())
    .setDescription([
      'A roleta da Killjoy girou para ' + user + '.',
      '',
      '## ' + picked,
      'Vai com fé. Se der errado, foi estatística experimental.',
      '',
      '_Essa mensagem some em 2 minutos._'
    ].join('\n'))
    .setImage(AGENT_IMAGES[picked] || null)
    .setFooter({ text: 'Sorteado entre ' + pool.length + ' agente(s) cadastrados' })
    .setTimestamp();
}

function buildRouletteLoadingEmbed(user, pool, step, totalSteps) {
  const filled = '▰'.repeat(step);
  const empty = '▱'.repeat(totalSteps - step);
  const preview = [...pool]
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
    .map(agent => `**${agent}**`)
    .join(' → ');

  return new EmbedBuilder()
    .setColor(KILLJOY_YELLOW)
    .setTitle('🎰 KILLJOY // CARREGANDO ROLETA')
    .setDescription([
      `Calibrando agentes para ${user}...`,
      '',
      `\`[${filled}${empty}]\` ${Math.round((step / totalSteps) * 100)}%`,
      '',
      `**Passando por:** ${preview}`
    ].join('\n'));
}

async function runAgentRoulette(interaction, pool) {
  const picked = randomAgent(pool);
  const totalSteps = 4;

  await interaction.reply({ embeds: [buildRouletteLoadingEmbed(interaction.user, pool, 1, totalSteps)] });

  for (let step = 2; step <= totalSteps; step++) {
    await new Promise(resolve => setTimeout(resolve, 300));
    await interaction.editReply({ embeds: [buildRouletteLoadingEmbed(interaction.user, pool, step, totalSteps)] });
  }

  await new Promise(resolve => setTimeout(resolve, 250));
  await interaction.editReply({ embeds: [buildAgentRouletteEmbed(interaction.user, picked, pool)] });
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, 2 * 60 * 1000);
}

function buildAgentsListEmbed(user) {
  const selected = getUserAgents(user.id);
  return new EmbedBuilder()
    .setColor(KILLJOY_YELLOW)
    .setTitle('Agentes cadastrados de ' + (user.globalName || user.username))
    .setDescription(selected.length ? selected.join(', ') : 'Nenhum agente cadastrado ainda. Use /sortear-agente para abrir a escolha.')
    .setFooter({ text: selected.length + '/' + VALORANT_AGENTS.length + ' agentes selecionados' })
    .setTimestamp();
}


async function ensureXodoRole(guild) {
  let role = guild.roles.cache.find(existing => existing.name === XODO_ROLE_NAME);
  if (!role) {
    role = await guild.roles.create({
      name: XODO_ROLE_NAME,
      color: KILLJOY_YELLOW,
      reason: 'Cargo especial criado pela Killjoy para os escolhidos do Coca'
    });
  }
  return role;
}

function buildAgentsPanelEmbed() {
  return new EmbedBuilder()
    .setColor(KILLJOY_YELLOW)
    .setTitle('KILLJOY // SELETOR DE AGENTES')
    .setDescription([
      'Escolha seus agentes nos menus abaixo e depois clique em **Sortear**.',
      '',
      'A seleÃ§Ã£o Ã© individual: cada pessoa mexe na prÃ³pria lista usando este mesmo painel.',
      '',
      '**BotÃµes**',
      'Sortear — sorteia entre seus agentes salvos',
      'Meu cadastro — mostra sua lista atual',
      'Limpar minha lista — apaga seu cadastro de agentes'
    ].join('\n'))
    .setFooter({ text: 'Painel fixo dos Patifes â€” mantido automaticamente pela Killjoy' })
    .setTimestamp();
}

async function ensureAgentsChannel(guild, shouldPostPanel = true) {
  let channel = guild.channels.cache.find(existing =>
    existing.type === ChannelType.GuildText &&
    existing.name === AGENTS_CHANNEL_NAME
  );

  const brokenChannels = guild.channels.cache.filter(existing =>
    existing.type === ChannelType.GuildText &&
    ['ðŸŽ¯ãƒ»agentes', '🎯・agentes'].includes(existing.name)
  );

  if (!channel) {
    channel = await guild.channels.create({
      name: AGENTS_CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: 'Roleta de agentes da Killjoy para os Patifes.'
    });
  }

  for (const [, brokenChannel] of brokenChannels) {
    if (brokenChannel.id !== channel.id) {
      brokenChannel.setName('agentes-arquivo').catch(() => {});
    }
  }

  if (shouldPostPanel) {
    const state = loadPanelState();
    let panelMessage = null;

    if (state.agentsPanelMessageId && state.agentsPanelChannelId === channel.id) {
      panelMessage = await channel.messages.fetch(state.agentsPanelMessageId).catch(() => null);
    }

    const payload = { embeds: [buildAgentsPanelEmbed()], components: [...buildFixedAgentPanelRows(), buildFixedAgentPanelControls()] };

    if (panelMessage) {
      await panelMessage.edit(payload);
    } else {
      panelMessage = await channel.send(payload);
      savePanelState({
        ...state,
        agentsPanelChannelId: channel.id,
        agentsPanelMessageId: panelMessage.id
      });
    }
  }

  return channel;
}

const killjoyLines = [
  'calibrando os Patifes ðŸ› ï¸',
  'protegendo o servidor ðŸ’›',
  'vigiando o lobby da ranked ðŸŽ¯',
  'organizando o caos com carinho âš¡'
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

let botReady = false;
let defconLevel = 0;
let currentVoiceChannelId = null;
let currentVoiceChannelName = null;
const playerProfiles = new Map();

const audioPlayer = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Pause
  }
});

let activeConnection = null;
let currentFfmpegProc = null;

audioPlayer.on(AudioPlayerStatus.Playing, () => {
  console.log('[Killjoy Voice Engine] Tocando Ã¡udio ao vivo na call!');
});

audioPlayer.on(AudioPlayerStatus.Idle, () => {
  console.log('[Killjoy Voice Engine] ReproduÃ§Ã£o finalizada / Parada.');
  if (currentFfmpegProc) {
    try { currentFfmpegProc.kill('SIGKILL'); } catch (e) {}
    currentFfmpegProc = null;
  }
});

audioPlayer.on('error', error => {
  console.error('[Killjoy Voice Engine] Erro no player:', error.message);
});

// Registrar Slash Command /sortear-agente no Discord
async function registerSlashCommands() {
  try {
    const commands = [
      new SlashCommandBuilder()
        .setName('sortear-agente')
        .setDescription('Abre a roleta de agentes de VALORANT.')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Confere se a Killjoy estÃ¡ online.')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('killjoy')
        .setDescription('Mostra o painel rÃ¡pido da Killjoy dos Patifes.')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('ajuda')
        .setDescription('Mostra os comandos principais da Killjoy.')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Mostra seu perfil de jogador nos Patifes.')
        .addUserOption(option =>
          option.setName('membro')
            .setDescription('Membro que vocÃª quer ver.')
            .setRequired(false))
        .toJSON(),
      new SlashCommandBuilder()
        .setName('registro')
        .setDescription('Registra seu perfil bÃ¡sico nos Patifes.')
        .addStringOption(option =>
          option.setName('jogo')
            .setDescription('Seu jogo principal.')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('rank')
            .setDescription('Seu rank/elo atual.')
            .setRequired(false))
        .toJSON(),
      new SlashCommandBuilder()
        .setName('lobby')
        .setDescription('Abre uma chamada rÃ¡pida para montar lobby.')
        .addStringOption(option =>
          option.setName('jogo')
            .setDescription('Jogo do lobby.')
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName('vagas')
            .setDescription('Quantidade de vagas.')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false))
        .toJSON(),
      new SlashCommandBuilder()
        .setName('ranked')
        .setDescription('Chama os Patifes para uma ranked.')
        .addStringOption(option =>
          option.setName('jogo')
            .setDescription('Jogo da ranked.')
            .setRequired(false))
        .toJSON(),
      new SlashCommandBuilder()
        .setName('agentes')
        .setDescription('Mostra a lista de agentes disponÃ­veis no sorteio.')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('dica')
        .setDescription('Recebe uma dica rÃ¡pida da Killjoy.')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('xodo')
        .setDescription('DÃ¡ o cargo especial XodÃ³ do Coca para alguÃ©m.')
        .addUserOption(option =>
          option.setName('membro')
            .setDescription('Pessoa escolhida pelo Coca.')
            .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON(),
      new SlashCommandBuilder()
        .setName('setup-agentes')
        .setDescription('Recria o canal/painel da roleta de agentes.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .toJSON()
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('[Killjoy] Comandos do servidor Patifes registrados com sucesso.');
  } catch (err) {
    console.error('[Killjoy] Erro ao registrar comandos:', err.message);
  }
}

client.on('ready', async () => {
  botReady = true;
  console.log(`[Killjoy] Online como ${client.user.tag}`);
  try {
    await registerSlashCommands();
    const guild = await client.guilds.fetch(GUILD_ID);
    await ensureAgentsChannel(guild, true);
    rotatePresence();
    setInterval(rotatePresence, 10 * 60 * 1000);
  } catch (e) {
    console.error('[Killjoy] Erro ao inicializar:', e);
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('agent_panel_select_')) {
    const selected = new Set(getUserAgents(interaction.user.id));
    const index = Number(interaction.customId.replace('agent_panel_select_', ''));
    const chunk = VALORANT_AGENTS.slice(index * 25, index * 25 + 25);

    for (const agent of chunk) selected.delete(agent);
    for (const agent of interaction.values) selected.add(agent);

    agentPools[interaction.user.id] = [...selected].filter(agent => VALORANT_AGENTS.includes(agent));
    saveAgentPools();

    await interaction.reply({
      content: `Salvei sua lista com **${agentPools[interaction.user.id].length}** agente(s). Agora pode clicar em **Sortear**.`,
      ephemeral: true
    });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'agent_panel_roll') {
    const pool = getUserAgents(interaction.user.id);
    if (!pool.length) {
      await interaction.reply({ content: 'VocÃª ainda nÃ£o escolheu agentes no painel. Marca alguns nos menus primeiro.', ephemeral: true });
      return;
    }
    await runAgentRoulette(interaction, pool);
    return;
  }

  if (interaction.isButton() && interaction.customId === 'agent_panel_show') {
    await interaction.reply({ embeds: [buildAgentsListEmbed(interaction.user)], ephemeral: true });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'agent_panel_clear') {
    delete agentPools[interaction.user.id];
    saveAgentPools();
    await interaction.reply({ content: 'Sua lista de agentes foi limpa.', ephemeral: true });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('agent_select_')) {
    const selected = new Set(getUserAgents(interaction.user.id));
    const index = Number(interaction.customId.replace('agent_select_', ''));
    const chunk = VALORANT_AGENTS.slice(index * 25, index * 25 + 25);

    for (const agent of chunk) selected.delete(agent);
    for (const agent of interaction.values) selected.add(agent);

    agentPools[interaction.user.id] = [...selected].filter(agent => VALORANT_AGENTS.includes(agent));
    saveAgentPools();

    await interaction.update({
      embeds: [buildAgentSetupEmbed(interaction.user)],
      components: [...buildAgentSelectRows(interaction.user.id), buildAgentControlRow()]
    });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'agent_roll_saved') {
    const pool = getUserAgents(interaction.user.id);
    if (!pool.length) {
      await interaction.reply({ content: 'Escolhe pelo menos um agente antes de girar a roleta.', ephemeral: true });
      return;
    }
    await runAgentRoulette(interaction, pool);
    return;
  }

  if (interaction.isButton() && interaction.customId === 'agent_show_saved') {
    await interaction.reply({ embeds: [buildAgentsListEmbed(interaction.user)], ephemeral: true });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'agent_clear_saved') {
    delete agentPools[interaction.user.id];
    saveAgentPools();
    await interaction.update({
      embeds: [buildAgentSetupEmbed(interaction.user)],
      components: [...buildAgentSelectRows(interaction.user.id), buildAgentControlRow()]
    });
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    const latency = Math.max(0, Date.now() - interaction.createdTimestamp);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle('ðŸŸ¢ Killjoy online')
          .setDescription(`Tudo certo por aqui.\nLatÃªncia: **${latency}ms**`)
          .setFooter({ text: 'Relax, eu jÃ¡ cuidei de tudo.' })
          .setTimestamp()
      ],
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === 'killjoy') {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle('KILLJOY // CENTRAL DOS PATIFES')
          .setDescription([
            'Eu cuido do laboratÃ³rio enquanto vocÃªs inventam moda.',
            '',
            '**Comandos Ãºteis**',
            '`/sortear-agente` â€” escolhe um agente de VALORANT',
            '`/ping` â€” confere se estou acordada',
            '',
            'Sem drama. SÃ³ tecnologia aprovada e caos supervisionado. âš¡'
          ].join('\n'))
          .setFooter({ text: 'Killjoy dos Patifes ðŸ’›' })
          .setTimestamp()
      ],
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === 'ajuda') {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle('KILLJOY // COMANDOS')
          .setDescription([
            '`/killjoy` â€” painel rÃ¡pido da bot',
            '`/ping` â€” teste de vida',
            '`/registro` â€” salva seu jogo/rank bÃ¡sico',
            '`/perfil` â€” mostra um perfil',
            '`/lobby` â€” chama gente pra jogar',
            '`/ranked` â€” chamada rÃ¡pida pra ranked',
            '`/sortear-agente` â€” sorteia agente de VALORANT',
            '`/agentes` â€” lista agentes do sorteio',
            '`/dica` â€” dica rÃ¡pida da Killjoy',
            '',
            'Clipes continuam removidos, como vocÃª pediu.'
          ].join('\n'))
          .setFooter({ text: 'Patifes sob controle. Quase sempre.' })
          .setTimestamp()
      ],
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === 'registro') {
    const game = interaction.options.getString('jogo') || 'nÃ£o informado';
    const rank = interaction.options.getString('rank') || 'nÃ£o informado';
    playerProfiles.set(interaction.user.id, {
      game,
      rank,
      updatedAt: new Date()
    });
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle('âœ… Registro atualizado')
          .setDescription(`Perfil calibrado para ${interaction.user}.\n\n**Jogo:** ${game}\n**Rank:** ${rank}`)
          .setFooter({ text: 'Dados temporÃ¡rios atÃ© a prÃ³xima reinicializaÃ§Ã£o.' })
          .setTimestamp()
      ],
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === 'perfil') {
    const target = interaction.options.getUser('membro') || interaction.user;
    const profile = playerProfiles.get(target.id);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle(`ðŸ‘¤ Perfil de ${target.globalName || target.username}`)
          .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 128 }))
          .setDescription(profile
            ? `**Jogo:** ${profile.game}\n**Rank:** ${profile.rank}\n**Atualizado:** <t:${Math.floor(profile.updatedAt.getTime() / 1000)}:R>`
            : 'Ainda nÃ£o encontrei cadastro para esse membro.\nUse `/registro` para calibrar o perfil.')
          .setFooter({ text: 'Killjoy // Patifes' })
          .setTimestamp()
      ]
    });
    return;
  }

  if (interaction.commandName === 'lobby') {
    const game = interaction.options.getString('jogo') || 'VALORANT';
    const slots = interaction.options.getInteger('vagas') || 5;
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle('ðŸŽ® Lobby aberto')
          .setDescription(`${interaction.user} estÃ¡ montando lobby de **${game}**.\n\n**Vagas:** ${slots}\nReage aÃ­ ou chama no chat antes que a fila vire bagunÃ§a.`)
          .setFooter({ text: 'OrganizaÃ§Ã£o por Killjoy, execuÃ§Ã£o pelos Patifes.' })
          .setTimestamp()
      ]
    });
    return;
  }

  if (interaction.commandName === 'ranked') {
    const game = interaction.options.getString('jogo') || 'VALORANT';
    await interaction.reply({
      content: '@here',
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle('ðŸ† Ranked detectada')
          .setDescription(`${interaction.user} estÃ¡ chamando para ranked de **${game}**.\n\nApareÃ§am com mira, paciÃªncia e responsabilidade emocional mÃ­nima.`)
          .setTimestamp()
      ]
    });
    return;
  }

  if (interaction.commandName === 'agentes') {
    await interaction.reply({
      embeds: [buildAgentsListEmbed(interaction.user)],
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === 'dica') {
    const tips = [
      'NÃ£o dÃ¡ peek seco em tudo. Ã€s vezes sobreviver tambÃ©m Ã© highlight.',
      'Se o time estÃ¡ quieto, fala o bÃ¡sico: onde viu, quanto tirou, se recuou.',
      'Compra junto. Morrer rico no eco dos outros Ã© crime de laboratÃ³rio.',
      'Depois do plant, joga pelo tempo. A spike Ã© sua melhor duelista.',
      'Se perdeu duas rounds fazendo igual, parabÃ©ns: vocÃª descobriu uma variÃ¡vel ruim.'
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle('ðŸ’¡ Dica da Killjoy')
          .setDescription(tip)
          .setTimestamp()
      ]
    });
    return;
  }

  if (interaction.commandName === 'xodo') {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Esse comando sÃ³ funciona dentro do servidor.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: 'SÃ³ quem pode gerenciar cargos consegue escolher os XodÃ³s do Coca.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('membro', true);
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUser.id);
    const role = await ensureXodoRole(guild);

    await member.roles.add(role, `Escolhido como ${XODO_ROLE_NAME} por ${interaction.user.tag}`);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle('ðŸ§¸ XodÃ³ do Coca escolhido')
          .setDescription(`${member} agora carrega o cargo **${XODO_ROLE_NAME}**.\n\nCuidado: fofura com certificado oficial dos Patifes.`)
          .setTimestamp()
      ]
    });
    return;
  }

  if (interaction.commandName === 'setup-agentes') {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Esse comando sÃ³ funciona dentro do servidor.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: 'SÃ³ quem pode gerenciar canais consegue recriar o painel de agentes.', ephemeral: true });
      return;
    }

    const channel = await ensureAgentsChannel(interaction.guild, true);
    await interaction.reply({
      content: `Canal de agentes pronto: ${channel}`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === 'sortear-agente') {
    await interaction.reply({
      embeds: [buildAgentSetupEmbed(interaction.user)],
      components: [...buildAgentSelectRows(interaction.user.id), buildAgentControlRow()],
      ephemeral: true
    });
    return;
  }
});

function rotatePresence() {
  if (!client.user) return;
  const text = killjoyLines[Math.floor(Math.random() * killjoyLines.length)];
  client.user.setPresence({
    status: 'online',
    activities: [{ name: text, type: ActivityType.Playing }]
  });
}

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.member.id === client.user.id) {
    currentVoiceChannelId = newState.channelId;
    currentVoiceChannelName = newState.channel ? newState.channel.name : null;
  }
});

if (TOKEN) {
  client.login(TOKEN).catch(err => {
    console.error('[Killjoy] Erro ao conectar no Discord:', err.message);
  });
} else {
  console.error('[Killjoy] DISCORD_TOKEN nÃ£o foi definido. Configure essa variÃ¡vel no Render.');
}

async function ensureVoiceConnection(guild, channelId) {
  if (!activeConnection || currentVoiceChannelId !== channelId || activeConnection.state.status === VoiceConnectionStatus.Destroyed) {
    activeConnection = joinVoiceChannel({
      channelId: channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false
    });

    try {
      await entersState(activeConnection, VoiceConnectionStatus.Ready, 10_000);
      console.log(`[Killjoy Voice Engine] ConexÃ£o pronta na call "${channelId}"!`);
    } catch (err) {
      console.error('[Killjoy Voice Engine] Timeout ao conectar na call:', err);
    }

    activeConnection.subscribe(audioPlayer);
    currentVoiceChannelId = channelId;
  }
  return activeConnection;
}

function stopAudioExecution() {
  try {
    audioPlayer.stop(true);
    if (currentFfmpegProc) {
      try { currentFfmpegProc.kill('SIGKILL'); } catch (e) {}
      currentFfmpegProc = null;
    }
  } catch (e) {}
}

function playAudioInVoice(audioPathOrUrl, volume = 0.8) {
  stopAudioExecution();

  console.log(`[Killjoy Voice Engine] Transmitindo MP3 via FFmpeg: ${audioPathOrUrl}`);

  const ffmpegArgs = audioPathOrUrl.startsWith('http')
    ? ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-i', audioPathOrUrl, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1']
    : ['-i', audioPathOrUrl, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'];

  const ffmpegProc = spawn(ffmpegPath, ffmpegArgs, { stdio: ['ignore', 'pipe', 'ignore'] });
  currentFfmpegProc = ffmpegProc;

  const resource = createAudioResource(ffmpegProc.stdout, {
    inputType: StreamType.Raw,
    inlineVolume: true
  });

  if (resource.volume) {
    resource.volume.setVolume(parseFloat(volume));
  }

  audioPlayer.play(resource);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  return res.end(JSON.stringify(payload));
}

function isKtosRequestAllowed(req) {
  if (!KTOS_PANEL_SECRET) return true;
  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
  const providedSecret = req.headers['x-ktos-secret'] || requestUrl.searchParams.get('token');
  return providedSecret === KTOS_PANEL_SECRET;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, {
      ok: true,
      botReady,
      bot: client.user?.tag || null,
      service: 'killjoy-bot'
    });
  }

  if (req.url.startsWith('/api/') && !isKtosRequestAllowed(req)) {
    return sendJson(res, 401, { success: false, error: 'KTOS_PANEL_SECRET invÃ¡lido.' });
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const htmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(htmlPath)) {
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(htmlContent);
    }
  }

  if (req.method === 'GET' && req.url === '/api/data') {
    if (!botReady) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Bot ainda estÃ¡ conectando ao Discord...' }));
    }

    try {
      const guild = await client.guilds.fetch(GUILD_ID);

      const textChannels = guild.channels.cache.filter(c => c.isTextBased()).map(c => ({ id: c.id, name: c.name }));
      const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased()).map(c => ({ id: c.id, name: c.name, userLimit: c.userLimit }));
      
      const voiceMembers = guild.members.cache.filter(m => m.voice.channelId).map(m => ({
        id: m.id,
        name: m.nickname || m.user.globalName || m.user.username,
        avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 }),
        channelId: m.voice.channelId,
        channelName: m.voice.channel?.name
      }));

      const roles = guild.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.hexColor })).filter(r => r.name !== '@everyone');

      const allMembers = guild.members.cache.map(m => ({
        id: m.id,
        name: m.nickname || m.user.globalName || m.user.username,
        tag: m.user.tag,
        avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 }),
        roles: m.roles.cache.map(r => r.name).filter(r => r !== '@everyone')
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        botTag: client.user.tag,
        defconLevel,
        totalMembers: guild.memberCount,
        totalRoles: guild.roles.cache.size,
        currentVoiceChannelId,
        currentVoiceChannelName,
        roles,
        textChannels,
        voiceChannels,
        voiceMembers,
        allMembers
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let data = {};
      try {
        data = JSON.parse(body || '{}');
      } catch (err) {
        return sendJson(res, 400, { success: false, error: 'JSON invÃ¡lido enviado ao KTOS.' });
      }

      if (req.url === '/api/upload-and-play') {
        try {
          const { channelId, base64Data, volume } = data;
          const guild = await client.guilds.fetch(GUILD_ID);
          const targetChannelId = channelId || currentVoiceChannelId;

          if (!targetChannelId) throw new Error('Selecione uma call de voz primeiro!');
          if (!base64Data) throw new Error('Nenhum arquivo de Ã¡udio recebido!');

          const buffer = Buffer.from(base64Data.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
          fs.writeFileSync(TEMP_AUDIO_PATH, buffer);

          await ensureVoiceConnection(guild, targetChannelId);
          playAudioInVoice(TEMP_AUDIO_PATH, volume || 0.8);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/join-voice') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const channel = await guild.channels.fetch(data.channelId);

          await ensureVoiceConnection(guild, channel.id);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, channelName: channel.name }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/leave-voice') {
        try {
          stopAudioExecution();
          const connection = getVoiceConnection(GUILD_ID);
          if (connection) {
            connection.destroy();
          }
          currentVoiceChannelId = null;
          currentVoiceChannelName = null;
          activeConnection = null;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/play-audio-stream') {
        try {
          const { channelId, audioUrl, volume } = data;
          const guild = await client.guilds.fetch(GUILD_ID);
          const targetChannelId = channelId || currentVoiceChannelId;

          if (!targetChannelId) throw new Error('Selecione uma call de voz primeiro!');
          if (!audioUrl) throw new Error('Cole a URL de um arquivo MP3!');

          await ensureVoiceConnection(guild, targetChannelId);
          playAudioInVoice(audioUrl, volume || 0.8);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/stop-audio') {
        try {
          stopAudioExecution();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/move') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(data.memberId);
          const channel = await guild.channels.fetch(data.channelId);
          await member.voice.setChannel(channel, 'Movido via Killjoy Control Center');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/tempchannel-control') {
        try {
          const channel = await client.channels.fetch(data.channelId);
          if (data.action === 'rename' && data.name) {
            await channel.setName(data.name);
          } else if (data.action === 'limit') {
            await channel.setUserLimit(parseInt(data.limit || 0));
          } else if (data.action === 'lock') {
            await channel.permissionOverwrites.edit(GUILD_ID, { Connect: false });
          } else if (data.action === 'unlock') {
            await channel.permissionOverwrites.edit(GUILD_ID, { Connect: true });
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/member-action') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(data.memberId);
          if (data.action === 'nickname' && data.value) {
            await member.setNickname(data.value);
          } else if (data.action === 'warn') {
            const textChannels = guild.channels.cache.filter(c => c.isTextBased());
            const general = textChannels.find(c => c.name.includes('geral') || c.name.includes('avisos')) || textChannels.first();
            await general.send(`âš ï¸ **AVISO DA KILLJOY:** ${member}, mantenha o respeito no laboratÃ³rio! Motivo: ${data.value || 'Comportamento inadequado'}`);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/pull-all') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const targetChannel = await guild.channels.fetch(data.targetChannelId);
          const voiceMembers = guild.members.cache.filter(m => m.voice.channelId && m.voice.channelId !== data.targetChannelId);
          
          let movedCount = 0;
          for (const [, member] of voiceMembers) {
            await member.voice.setChannel(targetChannel, 'Puxados por Killjoy Control Center');
            movedCount++;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, movedCount }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/purge') {
        try {
          const channel = await client.channels.fetch(data.channelId);
          const count = Math.min(parseInt(data.amount || 10), 100);
          const deleted = await channel.bulkDelete(count, true);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, deletedCount: deleted.size }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/defcon-level') {
        defconLevel = parseInt(data.level || 0);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, defconLevel }));
      }

      if (req.url === '/api/announce') {
        try {
          const channel = await client.channels.fetch(data.channelId);
          const embed = new EmbedBuilder()
            .setColor(data.color ? parseInt(data.color.replace('#',''), 16) : 0xffed00)
            .setTitle(data.title)
            .setDescription(data.message)
            .setFooter({ text: 'Killjoy Control â€” LaboratÃ³rio dos Patifes ðŸ› ï¸' })
            .setTimestamp();

          if (data.imageUrl && data.imageUrl.startsWith('http')) {
            embed.setImage(data.imageUrl);
          }

          await channel.send({
            content: data.mentionEveryone ? '@everyone' : null,
            embeds: [embed]
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/mute-member') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(data.memberId);
          const duration = (data.durationMinutes || 5) * 60 * 1000;
          await member.timeout(duration, 'Mutado via Killjoy Control Center');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/update-presence') {
        try {
          const { text, type, status } = data;
          const actType = type === 'Watching' ? ActivityType.Watching : type === 'Listening' ? ActivityType.Listening : type === 'Streaming' ? ActivityType.Streaming : ActivityType.Playing;
          client.user.setPresence({
            status: status || 'online',
            activities: [{ name: text || 'Os Patifes ðŸ› ï¸', type: actType }]
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/create-channel') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const type = data.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
          await guild.channels.create({
            name: data.name,
            type
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('NÃ£o encontrado');
});

server.listen(PORT, () => {
  console.log(`[Killjoy Control Center Master] Painel rodando em http://localhost:${PORT}`);
});

