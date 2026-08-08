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
import { handleRegistrationInteraction, profileEmbed, registrationPanel } from './src/registration.js';
import { readJson, writeJsonAtomic } from './src/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID || '1515187485531967629';
const CLIENT_ID = process.env.CLIENT_ID || '1531112285219586088';
const TEMP_AUDIO_PATH = path.join(__dirname, 'temp_audio.mp3');
const KTOS_PASSWORD = process.env.KTOS_PASSWORD || 'patifes123';

const KILLJOY_YELLOW = 0xffed00;
const VALORANT_AGENTS = [
  'Astra', 'Breach', 'Brimstone', 'Chamber', 'Clove', 'Cypher', 'Deadlock',
  'Fade', 'Gekko', 'Harbor', 'Iso', 'Jett', 'KAY/O', 'Killjoy', 'Neon',
  'Omen', 'Phoenix', 'Raze', 'Reyna', 'Sage', 'Skye', 'Sova', 'Tejo',
  'Viper', 'Vyse', 'Yoru'
];
const AGENT_EMOJIS = {
  Astra: '🌌', Breach: '🦾', Brimstone: '🛰️', Chamber: '🎩', Clove: '🦋',
  Cypher: '👁️', Deadlock: '🕸️', Fade: '🌑', Gekko: '🦎', Harbor: '🌊',
  Iso: '🎯', Jett: '🌪️', 'KAY/O': '🤖', Killjoy: '🛠️', Neon: '⚡',
  Omen: '👻', Phoenix: '🔥', Raze: '💣', Reyna: '👑', Sage: '💎',
  Skye: '🦅', Sova: '🏹', Tejo: '🚀', Viper: '☣️', Vyse: '🌹', Yoru: '🌀'
};
const AGENT_GROUPS = [VALORANT_AGENTS.slice(0, 14), VALORANT_AGENTS.slice(14)];
let agentVisualsCache = null;

const killjoyLines = [
  'calibrando os Patifes 🛠️',
  'protegendo o servidor 💛',
  'vigiando o lobby da ranked 🎯',
  'organizando o caos com carinho ⚡'
];
const CHANNEL_NAMES = {
  registro: '🧪・registro',
  agentes: '🎯・agentes',
  suporte: '🎫・suporte'
};

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

const audioPlayer = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Pause
  }
});

let activeConnection = null;
let currentFfmpegProc = null;
let currentAudioResource = null;
let currentVolume = 0.8;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  return res.end(JSON.stringify(payload));
}

function isAuthorized(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return token === KTOS_PASSWORD;
}

function maintenance(res, feature) {
  return sendJson(res, 501, {
    success: false,
    error: `${feature} ainda está em manutenção. Vou religar essa parte com calma, sem quebrar a Killjoy.`
  });
}

audioPlayer.on(AudioPlayerStatus.Playing, () => {
  console.log('[Killjoy Voice Engine] Tocando áudio ao vivo na call!');
});

audioPlayer.on(AudioPlayerStatus.Idle, () => {
  console.log('[Killjoy Voice Engine] Reprodução finalizada / Parada.');
  if (currentFfmpegProc) {
    try { currentFfmpegProc.kill('SIGKILL'); } catch (e) {}
    currentFfmpegProc = null;
  }
  currentAudioResource = null;
});

audioPlayer.on('error', error => {
  console.error('[Killjoy Voice Engine] Erro no player:', error.message);
});

async function registerSlashCommands() {
  try {
    const commands = [
      new SlashCommandBuilder()
        .setName('sortear-agente')
        .setDescription('Sorteia entre os agentes cadastrados da pessoa.')
        .addUserOption(option =>
          option.setName('membro')
            .setDescription('Pessoa do sorteio; vazio usa você.')
            .setRequired(false))
        .toJSON(),
      new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Confere se a Killjoy está online.')
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
        .setDescription('Abre o registro completo da Killjoy.')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('suporte')
        .setDescription('Abre o painel de suporte/ticket da Killjoy.')
        .toJSON(),
      new SlashCommandBuilder()
        .setName('agentes')
        .setDescription('Configura seus agentes disponíveis.')
        .addSubcommand(subcommand =>
          subcommand.setName('adicionar')
            .setDescription('Adiciona um agente ao seu cadastro.')
            .addStringOption(option =>
              option.setName('agente')
                .setDescription('Nome do agente.')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(subcommand =>
          subcommand.setName('remover')
            .setDescription('Remove um agente do seu cadastro.')
            .addStringOption(option =>
              option.setName('agente')
                .setDescription('Nome do agente.')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(subcommand =>
          subcommand.setName('lista')
            .setDescription('Mostra seus agentes cadastrados.'))
        .addSubcommand(subcommand =>
          subcommand.setName('todos')
            .setDescription('Marca que você tem todos os agentes.'))
        .addSubcommand(subcommand =>
          subcommand.setName('resetar')
            .setDescription('Apaga seu cadastro de agentes.'))
        .toJSON(),
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('[Killjoy] Comandos públicos registrados no Patifes: /registro, /perfil, /agentes, /sortear-agente, /suporte e /ping');
  } catch (err) {
    console.error('[Killjoy] Erro ao registrar comandos:', err.message);
  }
}

async function readAgentProfiles() {
  return readJson('data/agent-profiles.json', {});
}

async function writeAgentProfiles(profiles) {
  await writeJsonAtomic('data/agent-profiles.json', profiles);
}

async function getAgentVisual(agentName) {
  try {
    if (!agentVisualsCache) {
      const response = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=pt-BR');
      if (!response.ok) throw new Error('Não consegui carregar a API do VALORANT.');
      agentVisualsCache = (await response.json()).data;
    }
    return agentVisualsCache.find(agent =>
      agent.displayName.toLocaleLowerCase('pt-BR') === agentName.toLocaleLowerCase('pt-BR')
    ) || null;
  } catch (err) {
    console.warn('[Killjoy] Visual do agente indisponível:', err.message);
    return null;
  }
}

function supportPanel() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(KILLJOY_YELLOW)
        .setTitle('🎫 SUPORTE // KILLJOY')
        .setDescription('Precisa de ajuda, denúncia, parceria ou resolver alguma coisa com a equipe? Abra um ticket e explique com calma.')
        .addFields(
          { name: '🧾 Como funciona', value: 'A Killjoy cria um canal privado para você e a equipe.' },
          { name: '📸 Dica', value: 'Se tiver print, link ou contexto, manda tudo no ticket.' }
        )
        .setFooter({ text: 'Killjoy dos Patifes • suporte sem bagunça 💛' })
        .setTimestamp()
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('support:open')
          .setLabel('Abrir ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      )
    ]
  };
}

function agentsPanel() {
  const selects = AGENT_GROUPS.map((agents, index) => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`agents:select:${index}`)
      .setPlaceholder(index === 0 ? 'Escolha seus agentes — parte 1' : 'Escolha seus agentes — parte 2')
      .setMinValues(1)
      .setMaxValues(agents.length)
      .addOptions(agents.map(agent => ({
        label: agent,
        value: agent,
        emoji: AGENT_EMOJIS[agent] || '🎯'
      })))
  ));

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('agents:all').setLabel('Tenho todos').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('agents:list').setLabel('Meu cadastro').setEmoji('📋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('agents:reset').setLabel('Limpar minha lista').setEmoji('🧹').setStyle(ButtonStyle.Danger)
  );

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(KILLJOY_YELLOW)
        .setTitle('🎯 ROLETA DE AGENTES // KILLJOY')
        .setDescription([
          'Escolha nos menus abaixo os agentes que você tem. A Killjoy salva sua lista e usa isso quando você mandar `/sortear-agente`.',
          '',
          '**Como usa**',
          '1. Selecione seus agentes nos menus.',
          '2. Use **Meu cadastro** se quiser conferir.',
          '3. Quando for jogar, mande `/sortear-agente`.',
          '',
          'O painel não sorteia. Ele só guarda seu arsenal.'
        ].join('\n'))
        .setFooter({ text: 'Cadastro salvo por pessoa • roleta limpa 💛' })
        .setTimestamp()
    ],
    components: [...selects, controls]
  };
}

async function ensureTextChannel(guild, name, topic) {
  await guild.channels.fetch();
  const cleanName = name.normalize('NFKD').replace(/[^\w-]/g, '').toLowerCase();
  let channel = guild.channels.cache.find(item =>
    item.type === ChannelType.GuildText &&
    (item.name === name || item.name.toLowerCase().includes(cleanName.replace('-', '')))
  );

  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      topic
    });
  } else if (topic && channel.topic !== topic) {
    await channel.setTopic(topic).catch(() => null);
  }

  return channel;
}

async function upsertBotPanel(channel, marker, payload) {
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const existing = messages?.find(message =>
    message.author.id === client.user.id &&
    message.embeds[0]?.footer?.text?.includes(marker)
  );

  const markedPayload = {
    ...payload,
    embeds: (payload.embeds || []).map(embed => {
      const data = embed.toJSON();
      return EmbedBuilder.from(data).setFooter({
        text: `${data.footer?.text || 'Killjoy dos Patifes'} • ${marker}`
      });
    })
  };

  if (existing) await existing.edit(markedPayload);
  else await channel.send(markedPayload);
}

async function setupCoreDiscordChannels() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const registro = await ensureTextChannel(guild, CHANNEL_NAMES.registro, 'Registro dos Patifes pela Killjoy.');
    const agentes = await ensureTextChannel(guild, CHANNEL_NAMES.agentes, 'Cadastro e roleta de agentes da Killjoy.');
    const suporte = await ensureTextChannel(guild, CHANNEL_NAMES.suporte, 'Suporte e tickets da Killjoy.');

    await upsertBotPanel(registro, 'painel:registro', registrationPanel());
    await upsertBotPanel(agentes, 'painel:agentes', agentsPanel());
    await upsertBotPanel(suporte, 'painel:suporte', supportPanel());

    console.log('[Killjoy] Canais principais conferidos: registro, agentes e suporte.');
  } catch (err) {
    console.warn('[Killjoy] Não consegui preparar os canais principais:', err.message);
  }
}

async function handleSupportButton(interaction) {
  if (!interaction.customId.startsWith('support:') && !interaction.customId.startsWith('ticket:')) return false;

  if (interaction.customId === 'support:open' || interaction.customId === 'ticket:open') {
    const existing = interaction.guild.channels.cache.find(channel => channel.topic === `ticket:${interaction.user.id}`);
    if (existing) {
      await interaction.reply({ content: `Você já tem um ticket aberto: ${existing}`, ephemeral: true });
      return true;
    }

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
    await channel.send({
      content: `🎫 ${interaction.user}, explica aqui o que aconteceu. A equipe responde por este canal.`,
      components: [controls],
      allowedMentions: { users: [interaction.user.id] }
    });
    await interaction.reply({ content: `Ticket criado: ${channel}`, ephemeral: true });
    return true;
  }

  const ownerId = interaction.channel.topic?.startsWith('ticket:') ? interaction.channel.topic.split(':')[1] : null;
  const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

  if (interaction.customId === 'ticket:close') {
    if (!ownerId) {
      await interaction.reply({ content: 'Este canal não parece ser um ticket da Killjoy.', ephemeral: true });
      return true;
    }
    if (interaction.user.id !== ownerId && !isStaff) {
      await interaction.reply({ content: 'Só quem abriu o ticket ou a equipe pode fechar.', ephemeral: true });
      return true;
    }
    await interaction.channel.permissionOverwrites.edit(ownerId, { SendMessages: false });
    const controls = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:reopen').setLabel('Reabrir').setEmoji('🔓').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:delete').setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );
    await interaction.update({ content: `🔒 Ticket fechado por ${interaction.user}.`, components: [controls] });
    return true;
  }

  if (interaction.customId === 'ticket:reopen') {
    if (!isStaff) {
      await interaction.reply({ content: 'Só a equipe pode reabrir tickets.', ephemeral: true });
      return true;
    }
    if (ownerId) await interaction.channel.permissionOverwrites.edit(ownerId, { SendMessages: true });
    const controls = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:delete').setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );
    await interaction.update({ content: `🔓 Ticket reaberto por ${interaction.user}.`, components: [controls] });
    return true;
  }

  if (interaction.customId === 'ticket:delete') {
    if (!isStaff) {
      await interaction.reply({ content: 'Só a equipe pode excluir tickets.', ephemeral: true });
      return true;
    }
    await interaction.reply('🗑️ Ticket será excluído em 5 segundos.');
    setTimeout(() => interaction.channel.delete(`Ticket excluído por ${interaction.user.tag}`).catch(() => {}), 5000);
    return true;
  }

  return false;
}

async function handleAgentPanelInteraction(interaction) {
  const isAgentSelect = interaction.isStringSelectMenu() && interaction.customId.startsWith('agents:select:');
  const isAgentButton = interaction.isButton() && interaction.customId.startsWith('agents:');
  if (!isAgentSelect && !isAgentButton) return false;

  const profiles = await readAgentProfiles();
  const profile = profiles[interaction.user.id] ?? { all: false, agents: [] };

  if (isAgentSelect) {
    profile.all = false;
    profile.agents = [...new Set([...(profile.agents ?? []), ...interaction.values])]
      .filter(agent => VALORANT_AGENTS.includes(agent))
      .sort((a, b) => VALORANT_AGENTS.indexOf(a) - VALORANT_AGENTS.indexOf(b));
    profiles[interaction.user.id] = profile;
    await writeAgentProfiles(profiles);
    await interaction.reply({
      content: `✅ Salvei **${interaction.values.join(', ')}** no seu arsenal. Total agora: **${profile.agents.length}** agente(s).\nUse \`/sortear-agente\` quando quiser girar a roleta.`,
      ephemeral: true
    });
    return true;
  }

  const action = interaction.customId.split(':')[1];

  if (action === 'all') {
    profiles[interaction.user.id] = { all: true, agents: [] };
    await writeAgentProfiles(profiles);
    await interaction.reply({
      content: '✅ Fechado: seu cadastro está como **todos os agentes**. Use `/sortear-agente` pra sortear.',
      ephemeral: true
    });
    return true;
  }

  if (action === 'reset') {
    delete profiles[interaction.user.id];
    await writeAgentProfiles(profiles);
    await interaction.reply({
      content: '🧹 Limpei sua lista de agentes. Escolha de novo nos menus quando quiser.',
      ephemeral: true
    });
    return true;
  }

  if (action === 'list') {
    const content = profile.all
      ? '📋 Seu cadastro: **todos os agentes**.'
      : profile.agents?.length
        ? `📋 Seus agentes (${profile.agents.length}): **${profile.agents.join(', ')}**`
        : '📋 Você ainda não salvou agentes. Escolha nos menus acima.';
    await interaction.reply({ content, ephemeral: true });
    return true;
  }

  return false;
}

async function cleanupOldAgentSelectorPanels() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    const channels = guild.channels.cache.filter(item =>
      item.type === ChannelType.GuildText &&
      item.name.toLowerCase().includes('agentes')
    );

    let deletedPanels = 0;

    for (const channel of channels.values()) {
      if (!channel?.messages) continue;

      const messages = await channel.messages.fetch({ limit: 100 });
      const oldPanels = messages.filter(message => {
        if (message.author.id !== client.user.id) return false;
        const title = message.embeds[0]?.title ?? '';
        const text = [
          title,
          message.embeds[0]?.description ?? '',
          ...((message.embeds[0]?.fields ?? []).flatMap(field => [field.name, field.value]))
        ].join(' ');
        return (
          message.components.length > 0 ||
          text.includes('SELETOR DE AGENTES') ||
          text.includes('CENTRAL DE AGENTES') ||
          text.includes('Arsenal de Agentes') ||
          text.includes('Agentes no sorteio')
        );
      });

      for (const message of oldPanels.values()) {
        await message.delete().then(() => { deletedPanels += 1; }).catch(() => null);
      }
    }

    console.log(`[Killjoy] Limpeza de agentes: ${channels.size} canal(is), ${deletedPanels} painel(is) removido(s).`);
  } catch (err) {
    console.warn('[Killjoy] Não consegui limpar painéis antigos de agentes:', err.message);
  }
}

client.on('ready', async () => {
  botReady = true;
  console.log(`[Killjoy] Online como ${client.user.tag}`);
  try {
    await registerSlashCommands();
    await cleanupOldAgentSelectorPanels();
    await setupCoreDiscordChannels();
    rotatePresence();
    setInterval(rotatePresence, 10 * 60 * 1000);
  } catch (e) {
    console.error('[Killjoy] Erro ao inicializar:', e);
  }
});

client.on('interactionCreate', async interaction => {
  try {
  if (await handleRegistrationInteraction(interaction)) return;

  if (interaction.isAutocomplete()) {
    const query = interaction.options.getFocused().toLocaleLowerCase('pt-BR');
    const matches = VALORANT_AGENTS
      .filter(agent => agent.toLocaleLowerCase('pt-BR').includes(query))
      .slice(0, 25);
    await interaction.respond(matches.map(agent => ({ name: agent, value: agent })));
    return;
  }

  if (interaction.isButton()) {
    if (await handleAgentPanelInteraction(interaction)) return;
    if (await handleSupportButton(interaction)) return;
  }

  if (interaction.isStringSelectMenu()) {
    if (await handleAgentPanelInteraction(interaction)) return;
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

  if (interaction.commandName === 'registro') {
    await interaction.reply({ ...registrationPanel(), ephemeral: true });
    return;
  }

  if (interaction.commandName === 'perfil') {
    const target = interaction.options.getUser('membro') || interaction.user;
    const profiles = await readJson('data/registration-profiles.json', {});
    const profile = profiles[target.id];
    await interaction.reply({
      embeds: profile
        ? [await profileEmbed(target, profile)]
        : [new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle(`👤 Perfil de ${target.globalName || target.username}`)
          .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 128 }))
          .setDescription('Ainda não encontrei cadastro para esse membro.\nUse `/registro` para calibrar o perfil.')
          .setFooter({ text: 'Killjoy // Patifes' })
          .setTimestamp()]
    });
    return;
  }

  if (interaction.commandName === 'suporte') {
    await interaction.reply(supportPanel());
    return;
  }

  if (interaction.commandName === 'agentes') {
    const profiles = await readAgentProfiles();
    const subcommand = interaction.options.getSubcommand();
    const profile = profiles[interaction.user.id] ?? { all: false, agents: [] };

    if (subcommand === 'todos') {
      profiles[interaction.user.id] = { all: true, agents: [] };
      await writeAgentProfiles(profiles);
      await interaction.reply({ content: '✅ Anotado: você possui todos os agentes. A roleta está liberada!', ephemeral: true });
      return;
    }

    if (subcommand === 'resetar') {
      delete profiles[interaction.user.id];
      await writeAgentProfiles(profiles);
      await interaction.reply({ content: '🧹 Seu cadastro de agentes foi apagado.', ephemeral: true });
      return;
    }

    if (subcommand === 'lista') {
      if (profile.all) {
        await interaction.reply({ content: '📋 Seu cadastro está como **todos os agentes**.', ephemeral: true });
        return;
      }
      if (!profile.agents?.length) {
        await interaction.reply({ content: '📋 Você ainda não cadastrou agentes. Use `/agentes adicionar` ou `/agentes todos`.', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `📋 Seus agentes (${profile.agents.length}): **${profile.agents.sort().join(', ')}**`, ephemeral: true });
      return;
    }

    const agent = interaction.options.getString('agente');
    if (!VALORANT_AGENTS.includes(agent)) {
      await interaction.reply({ content: 'Esse agente não está na lista atual da Killjoy.', ephemeral: true });
      return;
    }
    if (profile.all) {
      await interaction.reply({ content: 'Seu perfil está marcado como **todos os agentes**. Use `/agentes resetar` se quiser montar uma lista específica.', ephemeral: true });
      return;
    }

    profile.agents ??= [];
    if (subcommand === 'adicionar') {
      if (!profile.agents.includes(agent)) profile.agents.push(agent);
      profiles[interaction.user.id] = profile;
      await writeAgentProfiles(profiles);
      await interaction.reply({ content: `✅ **${agent}** adicionado. Total no cadastro: **${profile.agents.length}**.`, ephemeral: true });
      return;
    }

    profile.agents = profile.agents.filter(item => item !== agent);
    profiles[interaction.user.id] = profile;
    await writeAgentProfiles(profiles);
    await interaction.reply({ content: `➖ **${agent}** removido. Total no cadastro: **${profile.agents.length}**.`, ephemeral: true });
    return;
  }

  if (interaction.commandName === 'sortear-agente') {
    const user = interaction.options.getUser('membro') || interaction.user;
    const profiles = await readAgentProfiles();
    const profile = profiles[user.id];

    if (user.bot) {
      await interaction.reply({ content: 'Robô não precisa de agente, precisa é de tomada 😅', ephemeral: true });
      return;
    }

    if (!profile || (!profile.all && !profile.agents?.length)) {
      await interaction.reply({
        content: `${user} ainda não cadastrou agentes. Use \`/agentes adicionar\` ou \`/agentes todos\` primeiro.`,
        allowedMentions: { users: [user.id] }
      });
      return;
    }

    const pool = profile.all ? VALORANT_AGENTS : profile.agents.filter(agent => VALORANT_AGENTS.includes(agent));
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const visual = await getAgentVisual(picked);
    const color = visual?.backgroundGradientColors?.[0]
      ? Number.parseInt(visual.backgroundGradientColors[0].slice(0, 6), 16)
      : KILLJOY_YELLOW;
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${AGENT_EMOJIS[picked] || '🎯'} ${picked.toLocaleUpperCase('pt-BR')} FOI SORTEADO`)
      .setDescription(`## ${user}\nA Killjoy girou a roleta e escolheu **${picked}** para esta partida.`)
      .addFields(
        { name: '🎲 Arsenal usado', value: `${pool.length} agente(s) cadastrados`, inline: true },
        { name: '🛠️ Diagnóstico', value: 'Aprovado. Agora vai lá e faz o caos organizado.', inline: true }
      )
      .setFooter({ text: 'A mensagem some em 2 minutos • Killjoy dos Patifes 💛' })
      .setTimestamp();

    if (visual?.displayIcon) embed.setThumbnail(visual.displayIcon);
    if (visual?.fullPortraitV2 || visual?.fullPortrait) embed.setImage(visual.fullPortraitV2 || visual.fullPortrait);

    const response = await interaction.reply({ embeds: [embed], fetchReply: true });
    setTimeout(() => response.delete().catch(() => {}), 2 * 60 * 1000);
    return;
  }
  } catch (error) {
    if (error?.code === 10062 || error?.code === 40060) {
      console.warn('[Killjoy] Interação expirada/duplicada ignorada:', error.message);
      return;
    }
    console.error('[Killjoy] Erro em interação:', error);
    const response = { content: '⚠️ Algo travou no laboratório. Tenta de novo em alguns segundos.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
    else await interaction.reply(response).catch(() => {});
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
    currentAudioResource = null;
  } catch (e) {}
}

function playAudioInVoice(audioPathOrUrl, volume = 0.8) {
  stopAudioExecution();
  currentVolume = parseFloat(volume) || 0.8;

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
    resource.volume.setVolume(currentVolume);
  }

  currentAudioResource = resource;
  audioPlayer.play(resource);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const htmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(htmlPath)) {
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(htmlContent);
    }
  }

  if (req.method === 'GET' && req.url === '/api/data') {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { error: 'Senha do KTOS inválida.' });
    }

    if (!botReady) {
      return sendJson(res, 200, { error: 'Bot ainda está conectando ao Discord...' });
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

      return sendJson(res, 200, {
        botTag: client.user.tag,
        defconLevel,
        currentVolume,
        totalMembers: guild.memberCount,
        totalRoles: guild.roles.cache.size,
        currentVoiceChannelId,
        currentVoiceChannelName,
        roles,
        textChannels,
        voiceChannels,
        voiceMembers,
        allMembers
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const data = JSON.parse(body || '{}');

      if (!isAuthorized(req)) {
        return sendJson(res, 401, { success: false, error: 'Senha do KTOS inválida.' });
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

      if (req.url === '/api/set-volume') {
        currentVolume = Math.max(0, Math.min(2, parseFloat(data.volume ?? currentVolume) || currentVolume));
        if (currentAudioResource?.volume) {
          currentAudioResource.volume.setVolume(currentVolume);
        }
        return sendJson(res, 200, { success: true, currentVolume });
      }

      if (req.url === '/api/pause-audio') {
        audioPlayer.pause(true);
        return sendJson(res, 200, { success: true });
      }

      if (req.url === '/api/resume-audio') {
        audioPlayer.unpause();
        return sendJson(res, 200, { success: true });
      }

      if (req.url === '/api/set-pitch') return maintenance(res, 'Pitch de áudio');
      if (req.url === '/api/search-music') return maintenance(res, 'Busca de música');
      if (req.url === '/api/queue-audio') return maintenance(res, 'Fila de áudio');
      if (req.url === '/api/skip-audio') return maintenance(res, 'Pular música');
      if (req.url === '/api/save-voice-clip') return maintenance(res, 'Clipe de voz');
      if (req.url === '/api/generate-squads') return maintenance(res, 'Sorteio de squads');
      if (req.url === '/api/clutch-mute') return maintenance(res, 'Modo clutch');
      if (req.url === '/api/toggle-mic') return maintenance(res, 'Controle de microfone da Killjoy');
      if (req.url === '/api/random-move') return maintenance(res, 'Roleta de call');
      if (req.url === '/api/voice-mute-member') return maintenance(res, 'Mute de voz');
      if (req.url === '/api/voice-deaf-member') return maintenance(res, 'Ensurdecer membro');
      if (req.url === '/api/unmute-member') return maintenance(res, 'Desmutar membro');
      if (req.url === '/api/kick-member') return maintenance(res, 'Expulsar membro');
      if (req.url === '/api/ban-member') return maintenance(res, 'Banir membro');
      if (req.url === '/api/send-dm') return maintenance(res, 'Enviar DM');
      if (req.url === '/api/get-dm-history') return maintenance(res, 'Histórico de DM');
      if (req.url === '/api/add-role-all') return maintenance(res, 'Atribuir cargo em massa');
      if (req.url === '/api/delete-channel') return maintenance(res, 'Excluir canal');

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
