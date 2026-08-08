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
const XODO_ROLE_NAME = '🧸Xodó do Coca';
const AGENTS_CHANNEL_NAME = '🎯・agentes';
const VALORANT_AGENTS = [
  'Jett', 'Reyna', 'Raze', 'Phoenix', 'Yoru', 'Neon', 'Iso',
  'Sova', 'Breach', 'Skye', 'KAY/O', 'Fade', 'Gekko', 'Tejo',
  'Brimstone', 'Viper', 'Omen', 'Astra', 'Harbor', 'Clove',
  'Killjoy', 'Cypher', 'Sage', 'Chamber', 'Deadlock', 'Vyse'
];

const AGENT_IMAGES = {
  Astra: 'https://media.valorant-api.com/agents/41fb69c1-4189-7b37-f117-bcaf1e96f1bf/displayicon.png',
  Breach: 'https://media.valorant-api.com/agents/5f8d3a7f-467b-97f3-062c-13acf203c006/displayicon.png',
  Brimstone: 'https://media.valorant-api.com/agents/9f0d8ba9-4140-b941-57d3-a7ad57c6b417/displayicon.png',
  Chamber: 'https://media.valorant-api.com/agents/22697a3d-45bf-8dd7-4fec-84a9e28c69d7/displayicon.png',
  Clove: 'https://media.valorant-api.com/agents/1dbf2edd-4729-0984-3115-daa5eed44993/displayicon.png',
  Cypher: 'https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada7e3823b/displayicon.png',
  Deadlock: 'https://media.valorant-api.com/agents/cc8b64c8-4b25-4ff9-6e7f-37b4da43d235/displayicon.png',
  Fade: 'https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/displayicon.png',
  Gekko: 'https://media.valorant-api.com/agents/e370fa57-4757-3604-3648-499e1f642d3f/displayicon.png',
  Harbor: 'https://media.valorant-api.com/agents/95b78ed7-4637-86d9-7e41-71ba8c293152/displayicon.png',
  Iso: 'https://media.valorant-api.com/agents/0e38b510-41a8-5780-5e8f-568b2a4f2d6c/displayicon.png',
  Jett: 'https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png',
  'KAY/O': 'https://media.valorant-api.com/agents/601dbbe7-43ce-be57-2a40-4abd24953621/displayicon.png',
  Killjoy: 'https://media.valorant-api.com/agents/1e58de9c-4950-5125-93e9-a0aee9f98746/displayicon.png',
  Neon: 'https://media.valorant-api.com/agents/bb2a4828-46eb-8cd1-e765-15848195d751/displayicon.png',
  Omen: 'https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/displayicon.png',
  Phoenix: 'https://media.valorant-api.com/agents/eb93336a-449b-9c1b-0a54-a891f7921d69/displayicon.png',
  Raze: 'https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5aa313dba261/displayicon.png',
  Reyna: 'https://media.valorant-api.com/agents/a3bfb853-43b2-7238-a4f1-ad90e9e46bcc/displayicon.png',
  Sage: 'https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/displayicon.png',
  Skye: 'https://media.valorant-api.com/agents/6f2a04ca-43e0-be17-7f36-b3908627744d/displayicon.png',
  Sova: 'https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png',
  Tejo: 'https://media.valorant-api.com/agents/b444168c-4e35-8076-db47-ef9bf368f384/displayicon.png',
  Viper: 'https://media.valorant-api.com/agents/707eab51-4836-f488-046a-cda6bf494859/displayicon.png',
  Vyse: 'https://media.valorant-api.com/agents/efba5359-4016-a1e5-7626-b1ae76895940/displayicon.png',
  Yoru: 'https://media.valorant-api.com/agents/7f94d92c-4234-0a36-9646-3a87eb8b5c89/displayicon.png'
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
    console.error('[Killjoy] Não consegui ler agent-pools.json:', err.message);
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
    console.error('[Killjoy] Não consegui ler panel-state.json:', err.message);
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
      .setPlaceholder(index === 0 ? 'Escolha seus agentes — parte 1' : 'Escolha seus agentes — parte 2')
      .setMinValues(0)
      .setMaxValues(chunk.length)
      .addOptions(chunk.map(agent => ({ label: agent, value: agent, default: selected.has(agent) })))
  ));
}

function buildAgentControlRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('agent_roll_saved').setLabel('Sortear meus agentes').setStyle(ButtonStyle.Primary).setEmoji('🎰'),
    new ButtonBuilder().setCustomId('agent_show_saved').setLabel('Ver cadastro').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
    new ButtonBuilder().setCustomId('agent_clear_saved').setLabel('Limpar lista').setStyle(ButtonStyle.Danger).setEmoji('🧹')
  );
}

function buildAgentSetupEmbed(user) {
  const selected = getUserAgents(user.id);
  return new EmbedBuilder()
    .setColor(KILLJOY_YELLOW)
    .setTitle('🎯 KILLJOY // ESCOLHA DE AGENTES')
    .setDescription([
      user + ', selecione os agentes que você tem/quer jogar nos menus abaixo.',
      '',
      selected.length ? '**Salvos agora:** ' + selected.join(', ') : '**Salvos agora:** nenhum agente cadastrado ainda.',
      '',
      'Depois é só usar **Sortear meus agentes**. Eu salvo isso no arquivo local do bot.'
    ].join('\n'))
    .setFooter({ text: 'Cadastro por pessoa — Patifes edition' })
    .setTimestamp();
}

function buildAgentRouletteEmbed(user, picked, pool) {
  const spin = [...pool].filter(agent => agent !== picked).sort(() => Math.random() - 0.5).slice(0, 4);
  const animation = [...spin, picked].map((agent, index) => (index + 1) + '. ' + agent).join(' → ');
  return new EmbedBuilder()
    .setColor(KILLJOY_YELLOW)
    .setTitle('🎰 ROLETA DE AGENTE // RESULTADO')
    .setDescription([
      'A roleta da Killjoy girou para ' + user + '.',
      '',
      '**Animação:** ' + animation,
      '',
      '## ' + picked,
      'Vai com fé. Se der errado, foi estatística experimental.'
    ].join('\n'))
    .setThumbnail(AGENT_IMAGES[picked] || null)
    .setFooter({ text: 'Sorteado entre ' + pool.length + ' agente(s) cadastrados' })
    .setTimestamp();
}

function buildAgentsListEmbed(user) {
  const selected = getUserAgents(user.id);
  return new EmbedBuilder()
    .setColor(KILLJOY_YELLOW)
    .setTitle('📋 Agentes cadastrados de ' + (user.globalName || user.username))
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
    .setTitle('🎯 KILLJOY // CENTRAL DE AGENTES')
    .setDescription([
      'Escolha seus agentes, salve sua lista e deixe a Killjoy sortear só entre eles.',
      '',
      '**Como funciona**',
      '1. Use /sortear-agente para abrir sua seleção privada.',
      '2. Marque os agentes que você tem ou quer jogar.',
      '3. Clique em Sortear meus agentes.',
      '',
      '**Extras**',
      '/agentes mostra sua lista salva.',
      '/setup-agentes só recria este painel se alguém apagar tudo.'
    ].join('\n'))
    .setFooter({ text: 'Painel fixo dos Patifes — mantido automaticamente pela Killjoy' })
    .setTimestamp();
}

async function ensureAgentsChannel(guild, shouldPostPanel = true) {
  let channel = guild.channels.cache.find(existing =>
    existing.type === ChannelType.GuildText &&
    ['agentes', AGENTS_CHANNEL_NAME].includes(existing.name)
  );

  if (!channel) {
    channel = await guild.channels.create({
      name: AGENTS_CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: 'Roleta de agentes da Killjoy para os Patifes.'
    });
  }

  if (shouldPostPanel) {
    const state = loadPanelState();
    let panelMessage = null;

    if (state.agentsPanelMessageId && state.agentsPanelChannelId === channel.id) {
      panelMessage = await channel.messages.fetch(state.agentsPanelMessageId).catch(() => null);
    }

    const payload = { embeds: [buildAgentsPanelEmbed()], components: [] };

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
  'calibrando os Patifes 🛠️',
  'protegendo o servidor 💛',
  'vigiando o lobby da ranked 🎯',
  'organizando o caos com carinho ⚡'
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
  console.log('[Killjoy Voice Engine] Tocando áudio ao vivo na call!');
});

audioPlayer.on(AudioPlayerStatus.Idle, () => {
  console.log('[Killjoy Voice Engine] Reprodução finalizada / Parada.');
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
        .setDescription('Confere se a Killjoy está online.')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('killjoy')
        .setDescription('Mostra o painel rápido da Killjoy dos Patifes.')
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
            .setDescription('Membro que você quer ver.')
            .setRequired(false))
        .toJSON(),
      new SlashCommandBuilder()
        .setName('registro')
        .setDescription('Registra seu perfil básico nos Patifes.')
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
        .setDescription('Abre uma chamada rápida para montar lobby.')
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
        .setDescription('Mostra a lista de agentes disponíveis no sorteio.')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('dica')
        .setDescription('Recebe uma dica rápida da Killjoy.')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('xodo')
        .setDescription('Dá o cargo especial Xodó do Coca para alguém.')
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
    const picked = randomAgent(pool);
    await interaction.reply({ embeds: [buildAgentRouletteEmbed(interaction.user, picked, pool)] });
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
          .setTitle('🟢 Killjoy online')
          .setDescription(`Tudo certo por aqui.\nLatência: **${latency}ms**`)
          .setFooter({ text: 'Relax, eu já cuidei de tudo.' })
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
            'Eu cuido do laboratório enquanto vocês inventam moda.',
            '',
            '**Comandos úteis**',
            '`/sortear-agente` — escolhe um agente de VALORANT',
            '`/ping` — confere se estou acordada',
            '',
            'Sem drama. Só tecnologia aprovada e caos supervisionado. ⚡'
          ].join('\n'))
          .setFooter({ text: 'Killjoy dos Patifes 💛' })
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
            '`/killjoy` — painel rápido da bot',
            '`/ping` — teste de vida',
            '`/registro` — salva seu jogo/rank básico',
            '`/perfil` — mostra um perfil',
            '`/lobby` — chama gente pra jogar',
            '`/ranked` — chamada rápida pra ranked',
            '`/sortear-agente` — sorteia agente de VALORANT',
            '`/agentes` — lista agentes do sorteio',
            '`/dica` — dica rápida da Killjoy',
            '',
            'Clipes continuam removidos, como você pediu.'
          ].join('\n'))
          .setFooter({ text: 'Patifes sob controle. Quase sempre.' })
          .setTimestamp()
      ],
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === 'registro') {
    const game = interaction.options.getString('jogo') || 'não informado';
    const rank = interaction.options.getString('rank') || 'não informado';
    playerProfiles.set(interaction.user.id, {
      game,
      rank,
      updatedAt: new Date()
    });
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle('✅ Registro atualizado')
          .setDescription(`Perfil calibrado para ${interaction.user}.\n\n**Jogo:** ${game}\n**Rank:** ${rank}`)
          .setFooter({ text: 'Dados temporários até a próxima reinicialização.' })
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
          .setTitle(`👤 Perfil de ${target.globalName || target.username}`)
          .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 128 }))
          .setDescription(profile
            ? `**Jogo:** ${profile.game}\n**Rank:** ${profile.rank}\n**Atualizado:** <t:${Math.floor(profile.updatedAt.getTime() / 1000)}:R>`
            : 'Ainda não encontrei cadastro para esse membro.\nUse `/registro` para calibrar o perfil.')
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
          .setTitle('🎮 Lobby aberto')
          .setDescription(`${interaction.user} está montando lobby de **${game}**.\n\n**Vagas:** ${slots}\nReage aí ou chama no chat antes que a fila vire bagunça.`)
          .setFooter({ text: 'Organização por Killjoy, execução pelos Patifes.' })
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
          .setTitle('🏆 Ranked detectada')
          .setDescription(`${interaction.user} está chamando para ranked de **${game}**.\n\nApareçam com mira, paciência e responsabilidade emocional mínima.`)
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
      'Não dá peek seco em tudo. Às vezes sobreviver também é highlight.',
      'Se o time está quieto, fala o básico: onde viu, quanto tirou, se recuou.',
      'Compra junto. Morrer rico no eco dos outros é crime de laboratório.',
      'Depois do plant, joga pelo tempo. A spike é sua melhor duelista.',
      'Se perdeu duas rounds fazendo igual, parabéns: você descobriu uma variável ruim.'
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle('💡 Dica da Killjoy')
          .setDescription(tip)
          .setTimestamp()
      ]
    });
    return;
  }

  if (interaction.commandName === 'xodo') {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Esse comando só funciona dentro do servidor.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: 'Só quem pode gerenciar cargos consegue escolher os Xodós do Coca.', ephemeral: true });
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
          .setTitle('🧸 Xodó do Coca escolhido')
          .setDescription(`${member} agora carrega o cargo **${XODO_ROLE_NAME}**.\n\nCuidado: fofura com certificado oficial dos Patifes.`)
          .setTimestamp()
      ]
    });
    return;
  }

  if (interaction.commandName === 'setup-agentes') {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Esse comando só funciona dentro do servidor.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: 'Só quem pode gerenciar canais consegue recriar o painel de agentes.', ephemeral: true });
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
  console.error('[Killjoy] DISCORD_TOKEN não foi definido. Configure essa variável no Render.');
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
      console.log(`[Killjoy Voice Engine] Conexão pronta na call "${channelId}"!`);
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
    return sendJson(res, 401, { success: false, error: 'KTOS_PANEL_SECRET inválido.' });
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
      return res.end(JSON.stringify({ error: 'Bot ainda está conectando ao Discord...' }));
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
        return sendJson(res, 400, { success: false, error: 'JSON inválido enviado ao KTOS.' });
      }

      if (req.url === '/api/upload-and-play') {
        try {
          const { channelId, base64Data, volume } = data;
          const guild = await client.guilds.fetch(GUILD_ID);
          const targetChannelId = channelId || currentVoiceChannelId;

          if (!targetChannelId) throw new Error('Selecione uma call de voz primeiro!');
          if (!base64Data) throw new Error('Nenhum arquivo de áudio recebido!');

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
            await general.send(`⚠️ **AVISO DA KILLJOY:** ${member}, mantenha o respeito no laboratório! Motivo: ${data.value || 'Comportamento inadequado'}`);
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
            .setFooter({ text: 'Killjoy Control — Laboratório dos Patifes 🛠️' })
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
            activities: [{ name: text || 'Os Patifes 🛠️', type: actType }]
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
  res.end('Não encontrado');
});

server.listen(PORT, () => {
  console.log(`[Killjoy Control Center Master] Painel rodando em http://localhost:${PORT}`);
});
