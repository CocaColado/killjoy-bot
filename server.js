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
const TEMP_AUDIO_PATH = path.join(__dirname, 'temp_audio.mp3');

const KILLJOY_YELLOW = 0xffed00;
const VALORANT_AGENTS = [
  'Jett', 'Reyna', 'Raze', 'Phoenix', 'Yoru', 'Neon', 'Iso',
  'Sova', 'Breach', 'Skye', 'KAY/O', 'Fade', 'Gekko', 'Tejo',
  'Brimstone', 'Viper', 'Omen', 'Astra', 'Harbor', 'Clove',
  'Killjoy', 'Cypher', 'Sage', 'Chamber', 'Deadlock', 'Vyse'
];

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
        .setDescription('Sortee um agente do Valorant aleatório para a sua partida!')
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
        .toJSON()
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('[Killjoy] Comandos registrados: /sortear-agente, /ping e /killjoy');
  } catch (err) {
    console.error('[Killjoy] Erro ao registrar comandos:', err.message);
  }
}

client.on('ready', async () => {
  botReady = true;
  console.log(`[Killjoy] Online como ${client.user.tag}`);
  try {
    await registerSlashCommands();
    rotatePresence();
    setInterval(rotatePresence, 10 * 60 * 1000);
  } catch (e) {
    console.error('[Killjoy] Erro ao inicializar:', e);
  }
});

client.on('interactionCreate', async interaction => {
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
      embeds: [
        new EmbedBuilder()
          .setColor(KILLJOY_YELLOW)
          .setTitle('🎯 Agentes no sorteio')
          .setDescription(VALORANT_AGENTS.join(', '))
          .setFooter({ text: 'Use /sortear-agente para deixar o destino decidir.' })
      ],
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

  if (interaction.commandName === 'sortear-agente') {
    const picked = VALORANT_AGENTS[Math.floor(Math.random() * VALORANT_AGENTS.length)];
    const embed = new EmbedBuilder()
      .setColor(KILLJOY_YELLOW)
      .setTitle('🎯 AGENTE SORTEADO // VALORANT')
      .setDescription(`A Killjoy selecionou o agente **${picked}** para ${interaction.user}! 🛠️⚡`)
      .setFooter({ text: 'Laboratório da Killjoy — Os Patifes 💛' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
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
      const data = JSON.parse(body || '{}');

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
