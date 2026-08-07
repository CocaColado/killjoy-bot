import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 
  Client, 
  GatewayIntentBits, 
  Partials,
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
  VoiceConnectionStatus,
  EndBehaviorType
} from '@discordjs/voice';
import ffmpegPath from 'ffmpeg-static';
import prism from 'prism-media';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch (e) {
  console.log('[KTOS Config] Arquivo .env não encontrado ou variáveis já carregadas no ambiente.');
}

const PORT = process.env.PORT || 3000;
const DEFAULT_TOKEN = 'MTUzMTExMjI4NTIxOTU4NjA4OA.GlZ9F0.SyfJvZEfxEc2giw1vNW3GMcmpNIFdFZtiselPc';
const TOKEN = (process.env.TOKEN && process.env.TOKEN.trim().length > 30) ? process.env.TOKEN.trim() : DEFAULT_TOKEN;
const GUILD_ID = process.env.GUILD_ID || '1515187485531967629';
const TEMP_AUDIO_PATH = path.join(__dirname, 'temp_audio.mp3');
const CLIP_OUTPUT_PATH = path.join(__dirname, 'voice_clip_30s.mp3');
const AGENTS_DB_PATH = path.join(__dirname, 'user_agents.json');

// Render 24/7 Keep-Alive Engine (Prevents Render Free Tier Sleep)
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_EXTERNAL_URL) {
  setInterval(async () => {
    try {
      await fetch(`${RENDER_EXTERNAL_URL}/api/data`);
      console.log(`[KTOS Keep-Alive] Ping enviado com sucesso para ${RENDER_EXTERNAL_URL} 🟢`);
    } catch (e) {}
  }, 10 * 60 * 1000); // 10 minutos
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User]
});

let botReady = false;
let defconLevel = 0;
let currentVoiceChannelId = null;
let currentVoiceChannelName = null;

// Audio Queue & State
let audioQueue = [];
let currentlyPlaying = null;
let activeConnection = null;
let currentAudioResource = null;
let currentVolume = 0.8;
let currentPitch = 1.0;
let playbackStartTime = null;
let playbackDuration = 180;
let isPaused = false;

// User Registration Temp State Map (userId -> data)
const registrationState = new Map();

// DM Message Storage Map (userId -> Array of { id, sender, content, timestamp, authorName, authorAvatar })
const dmStore = new Map();

// Persistent JSON Storage Functions for Saved User Agents
function loadAgentsDB() {
  try {
    if (fs.existsSync(AGENTS_DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(AGENTS_DB_PATH, 'utf8'));
      const map = new Map();
      for (const [userId, agents] of Object.entries(data)) {
        map.set(userId, new Set(agents));
      }
      return map;
    }
  } catch (e) {
    console.error('Erro ao carregar user_agents.json:', e.message);
  }
  return new Map();
}

function saveAgentsDB(map) {
  try {
    const obj = {};
    for (const [userId, set] of map.entries()) {
      obj[userId] = Array.from(set);
    }
    fs.writeFileSync(AGENTS_DB_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar user_agents.json:', e.message);
  }
}

// Saved User Agents Map loaded from disk
const userAgentsMap = loadAgentsDB();

// Agent Emojis Dictionary (Square Face Icons)
const AGENT_EMOJIS = {
  'Astra': '🔮', 'Breach': '💥', 'Brimstone': '☄️', 'Chamber': '💼', 'Clove': '🪷',
  'Cypher': '🕵️', 'Deadlock': '🕸️', 'Fade': '👁️', 'Gekko': '🐊', 'Harbor': '🌊',
  'Iso': '🛡️', 'Jett': '💨', 'KAY/O': '🤖', 'Killjoy': '🛠️',
  'Neon': '⚡', 'Omen': '👤', 'Phoenix': '🔥', 'Raze': '💣', 'Reyna': '🩸',
  'Sage': '🧊', 'Skye': '🦅', 'Sova': '🏹', 'Vyse': '🪽', 'Yoru': '🦊'
};

// Official High-Res Full Portrait Artwork Mappings for Every Agent
const AGENT_ARTWORK = {
  'Gekko': 'https://media.valorant-api.com/agents/e370fa57-4757-3604-3648-499e1f642d3f/fullportrait.png',
  'Fade': 'https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/fullportrait.png',
  'Breach': 'https://media.valorant-api.com/agents/5f8d3a7f-467b-97f3-062c-13acf203c006/fullportrait.png',
  'Deadlock': 'https://media.valorant-api.com/agents/cc8b64c8-4b25-4ff9-6e7f-37b4da43d235/fullportrait.png',
  'Raze': 'https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5aa313dba261/fullportrait.png',
  'Chamber': 'https://media.valorant-api.com/agents/22697a3d-45bf-8dd7-4fec-84a9e28c69d7/fullportrait.png',
  'KAY/O': 'https://media.valorant-api.com/agents/601dbbe7-43ce-be57-2a40-4abd24953621/fullportrait.png',
  'Skye': 'https://media.valorant-api.com/agents/6f2a04ca-43e0-be17-7f36-b3908627744d/fullportrait.png',
  'Cypher': 'https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada7e3823b/fullportrait.png',
  'Sova': 'https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/fullportrait.png',
  'Killjoy': 'https://media.valorant-api.com/agents/1e58de9c-4950-5125-93e9-a0aee9f98746/fullportrait.png',
  'Harbor': 'https://media.valorant-api.com/agents/95b78ed7-4637-86d9-7e41-71ba8c293152/fullportrait.png',
  'Vyse': 'https://media.valorant-api.com/agents/efba5359-4016-a1e5-7626-b1ae76895940/fullportrait.png',
  'Viper': 'https://media.valorant-api.com/agents/707eab51-4836-f488-046a-cda6bf494859/fullportrait.png',
  'Phoenix': 'https://media.valorant-api.com/agents/eb93336a-449b-9c1b-0a54-a891f7921d69/fullportrait.png',
  'Astra': 'https://media.valorant-api.com/agents/41fb69c1-4189-7b37-f117-bcaf1e96f1bf/fullportrait.png',
  'Brimstone': 'https://media.valorant-api.com/agents/9f0d8ba9-4140-b941-57d3-a7ad57c6b417/fullportrait.png',
  'Iso': 'https://media.valorant-api.com/agents/0e38b510-41a8-5780-5e8f-568b2a4f2d6c/fullportrait.png',
  'Clove': 'https://media.valorant-api.com/agents/1dbf2edd-4729-0984-3115-daa5eed44993/fullportrait.png',
  'Neon': 'https://media.valorant-api.com/agents/bb2a4828-46eb-8cd1-e765-15848195d751/fullportrait.png',
  'Yoru': 'https://media.valorant-api.com/agents/7f94d92c-4234-0a36-9646-3a87eb8b5c89/fullportrait.png',
  'Sage': 'https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/fullportrait.png',
  'Reyna': 'https://media.valorant-api.com/agents/a3bfb853-43b2-7238-a4f1-ad90e9e46bcc/fullportrait.png',
  'Omen': 'https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/fullportrait.png',
  'Jett': 'https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/fullportrait.png'
};

const AGENTS_AM = ['Astra', 'Breach', 'Brimstone', 'Chamber', 'Clove', 'Cypher', 'Deadlock', 'Fade', 'Gekko', 'Harbor', 'Iso', 'Jett', 'KAY/O', 'Killjoy'];
const AGENTS_NY = ['Neon', 'Omen', 'Phoenix', 'Raze', 'Reyna', 'Sage', 'Skye', 'Sova', 'Vyse', 'Yoru'];
const ALL_VALORANT_AGENTS = Object.keys(AGENT_EMOJIS);

// Live Speaking Radar Map (userId -> timestamp)
const activeSpeakers = new Map();

// Voice Clip Buffer (30 seconds of PCM audio)
const MAX_PCM_CHUNKS = 1500;
let voiceAudioBuffer = [];

const audioPlayer = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Pause
  }
});

audioPlayer.on(AudioPlayerStatus.Playing, () => {
  console.log(`[Killjoy Voice Engine] 🟢 Tocando na call: "${currentlyPlaying?.title || 'Áudio'}" (Vol: ${(currentVolume*100).toFixed(0)}%, Pitch: ${currentPitch}x)`);
});

audioPlayer.on(AudioPlayerStatus.Idle, () => {
  console.log('[Killjoy Voice Engine] ⏹️ Reprodução finalizada.');
  currentAudioResource = null;
  playNextInQueue();
});

audioPlayer.on('error', error => {
  console.error('[Killjoy Voice Engine] ⚠️ Erro no player:', error.message);
  currentAudioResource = null;
  playNextInQueue();
});

client.on('ready', async () => {
  botReady = true;
  console.log(`[Killjoy Control Center 35.0 CLEAN DM & MUSIC ARTWORK] Conectado como ${client.user.tag}`);
  
  // Register Slash Commands on Guild
  try {
    const commands = [
      new SlashCommandBuilder()
        .setName('sortear-agente')
        .setDescription('Sorteia um agente do Valorant com base nos seus agentes cadastrados!')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    console.log('[Killjoy Slash Command] /sortear-agente registrado com sucesso no Discord!');
  } catch (err) {
    console.error('Erro ao registrar slash command:', err.message);
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();
    console.log('[Killjoy Control Center] Membros e avatares cacheados com sucesso!');
  } catch (e) {
    console.error('Erro ao cachear membros:', e);
  }
});

// Auto-Register on Join
client.on('guildMemberAdd', async (member) => {
  try {
    const role = member.guild.roles.cache.find(r => r.name.toLowerCase().includes('patifes'));
    if (role) {
      await member.roles.add(role, 'Auto-Registro de Patifes ao entrar no servidor');
      console.log(`[Killjoy Auto-Register] Cargo "${role.name}" atribuído automaticamente para ${member.user.tag}!`);
    }
  } catch (err) {
    console.error(`[Killjoy Auto-Register] Erro:`, err.message);
  }
});

// Helper function to build beautiful drawn agent embed with BIG HIGH-RES ARTWORK PHOTO
function buildDrawnAgentEmbed(user, drawnAgent, poolSize) {
  const emoji = AGENT_EMOJIS[drawnAgent] || '🎯';
  const fullArtUrl = AGENT_ARTWORK[drawnAgent] || `https://raw.githubusercontent.com/ValorantAPI/valorant-api-assets/master/agents/${drawnAgent.toLowerCase()}/displayicon.png`;
  const iconUrl = `https://raw.githubusercontent.com/ValorantAPI/valorant-api-assets/master/agents/${drawnAgent.toLowerCase()}/displayicon.png`;

  return new EmbedBuilder()
    .setColor(0xffed00)
    .setAuthor({ name: `🎯 SORTEIO DE AGENTE DA KILLJOY` })
    .setTitle(`${emoji} Agente sorteado: ${drawnAgent.toUpperCase()}`)
    .setDescription(`## 🎲 Agente sorteado para ${user}:\n# ${emoji} **${drawnAgent.toUpperCase()}**\n\n*Pool utilizado: ${poolSize > 0 ? `${poolSize} agentes salvos` : 'Todos os 24 agentes (Padrão)'}*\n⏱️ *Esta mensagem se auto-destruirá em 2 minutos para manter o canal limpo.*`)
    .setThumbnail(iconUrl)
    .setImage(fullArtUrl)
    .setFooter({ text: 'Killjoy Control Center — Seleção calculada, diversão garantida 💛' })
    .setTimestamp();
}

// Message Listener for "sortear agente" text command in chat
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase().trim();
  if (content === 'sortear agente' || content === '/sortear-agente' || content.includes('sortear agente') || content.startsWith('sortear')) {
    const userId = message.author.id;
    const userAgentsSet = userAgentsMap.get(userId);
    let pool = userAgentsSet && userAgentsSet.size > 0 ? Array.from(userAgentsSet) : ALL_VALORANT_AGENTS;

    const drawnAgent = pool[Math.floor(Math.random() * pool.length)];
    const embed = buildDrawnAgentEmbed(message.author, drawnAgent, userAgentsSet ? userAgentsSet.size : 0);

    const replyMsg = await message.reply({ embeds: [embed] });

    // Auto-Delete reply message after 2 minutes (120,000 ms)
    setTimeout(async () => {
      try {
        await replyMsg.delete();
      } catch (e) {}
    }, 120_000);
  }
});

/* ========================================================================= */
/* 🎯 DISCORD INTERACTION SYSTEM: SLASH COMMANDS & BUTTONS & SELECT MENUS    */
/* ========================================================================= */
client.on('interactionCreate', async (interaction) => {
  try {
    const customId = interaction.customId || '';

    // SLASH COMMAND HANDLER FOR /sortear-agente
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'sortear-agente' || interaction.commandName === 'sortear') {
        const userId = interaction.user.id;
        const userAgentsSet = userAgentsMap.get(userId);
        let pool = userAgentsSet && userAgentsSet.size > 0 ? Array.from(userAgentsSet) : ALL_VALORANT_AGENTS;

        const drawnAgent = pool[Math.floor(Math.random() * pool.length)];
        const embed = buildDrawnAgentEmbed(interaction.user, drawnAgent, userAgentsSet ? userAgentsSet.size : 0);

        await interaction.reply({ embeds: [embed] });

        // Auto-Delete slash command response after 2 minutes (120,000 ms)
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (e) {}
        }, 120_000);

        return;
      }
    }
  } catch (err) {
    console.error('[Interaction Error]:', err.message);
  }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.member.id === client.user.id) {
    currentVoiceChannelId = newState.channelId;
    currentVoiceChannelName = newState.channel ? newState.channel.name : null;
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild || message.channel.type === ChannelType.DM) {
    const userId = message.author.id;
    if (!dmStore.has(userId)) dmStore.set(userId, []);
    
    dmStore.get(userId).push({
      id: message.id || Date.now().toString(),
      sender: 'user',
      content: message.content,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      authorName: message.author.username,
      authorAvatar: message.author.displayAvatarURL()
    });
    console.log(`[Killjoy DM Messenger] Nova mensagem de ${message.author.tag}: ${message.content}`);
  }
});

client.login(TOKEN).catch(err => console.error('Erro ao conectar bot:', err));

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
      await entersState(activeConnection, VoiceConnectionStatus.Ready, 12_000);
      console.log(`[Killjoy Voice Engine] Conectado com sucesso na call "${channelId}"!`);
    } catch (err) {
      console.error('[Killjoy Voice Engine] Timeout ao conectar na call:', err);
    }

    activeConnection.subscribe(audioPlayer);
    currentVoiceChannelId = channelId;

    setupVoiceReceiver(activeConnection);
  }
  return activeConnection;
}

function setupVoiceReceiver(connection) {
  connection.receiver.speaking.on('start', (userId) => {
    activeSpeakers.set(userId, Date.now());
    try {
      const opusStream = connection.receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 100
        }
      });

      const decoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });
      const pcmStream = opusStream.pipe(decoder);

      pcmStream.on('data', (chunk) => {
        activeSpeakers.set(userId, Date.now());
        voiceAudioBuffer.push(chunk);
        if (voiceAudioBuffer.length > MAX_PCM_CHUNKS) {
          voiceAudioBuffer.shift();
        }
      });

      pcmStream.on('error', () => {});
    } catch (e) {}
  });

  connection.receiver.speaking.on('end', (userId) => {
    activeSpeakers.delete(userId);
  });
}

function stopAudioExecutionSilently() {
  try {
    audioPlayer.stop(true);
    currentAudioResource = null;
  } catch (e) {}
}

function stopAudioExecution() {
  try {
    audioQueue = [];
    currentlyPlaying = null;
    currentAudioResource = null;
    playbackStartTime = null;
    isPaused = false;
    audioPlayer.stop(true);
  } catch (e) {}
}

function playAudioInVoice(audioPathOrUrl, volume = 0.8, title = 'Áudio MP3', pitch = 1.0, duration = 180, startTimeSeconds = 0) {
  stopAudioExecutionSilently();

  currentVolume = volume !== undefined ? parseFloat(volume) : 0.8;
  currentPitch = parseFloat(pitch);
  playbackStartTime = Date.now() - (startTimeSeconds * 1000);
  playbackDuration = duration || 180;
  isPaused = false;
  currentlyPlaying = { title, url: audioPathOrUrl, volume: currentVolume, pitch: currentPitch, duration: playbackDuration };

  console.log(`[Killjoy Voice Engine] Tocando: ${title} (Volume: ${(currentVolume * 100).toFixed(0)}%, Tom: ${currentPitch}x, Pos: ${startTimeSeconds.toFixed(1)}s)`);

  try {
    const ffmpegArgs = [];
    if (startTimeSeconds > 0) {
      ffmpegArgs.push('-ss', startTimeSeconds.toFixed(2));
    }
    if (audioPathOrUrl.startsWith('http')) {
      ffmpegArgs.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
    }

    ffmpegArgs.push('-i', audioPathOrUrl);

    if (currentPitch !== 1.0) {
      const clampedPitch = Math.max(0.5, Math.min(2.0, currentPitch));
      ffmpegArgs.push('-filter:a', `atempo=${clampedPitch}`);
    }

    ffmpegArgs.push('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');

    const ffmpegProc = spawn(ffmpegPath, ffmpegArgs, { stdio: ['ignore', 'pipe', 'ignore'] });

    const resource = createAudioResource(ffmpegProc.stdout, {
      inputType: StreamType.Raw,
      inlineVolume: true
    });

    currentAudioResource = resource;

    if (resource.volume) {
      resource.volume.setVolume(currentVolume);
    }

    audioPlayer.play(resource);
  } catch (err) {
    console.error('[Killjoy Voice Engine] Erro ao reproduzir:', err.message);
    playNextInQueue();
  }
}

function playNextInQueue() {
  if (audioQueue.length > 0) {
    const nextTrack = audioQueue.shift();
    playAudioInVoice(nextTrack.url, nextTrack.volume, nextTrack.title, nextTrack.pitch || 1.0, nextTrack.duration || 180);
  } else {
    currentlyPlaying = null;
    playbackStartTime = null;
  }
}

// HTTP SERVER
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Validação básica de Origem para ambiente local e nuvem (Render)
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  const host = req.headers['host'] || '';
  const isLocalRequest = !origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('onrender.com') || host.includes('localhost') || host.includes('127.0.0.1') || host.includes('onrender.com');

  if (req.method === 'POST' && req.url.startsWith('/api/') && !isLocalRequest) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Acesso negado: Origem não autorizada.' }));
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const htmlPath = path.join(__dirname, 'index.html');
    fs.readFile(htmlPath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Erro ao carregar index.html');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/overlay.html') {
    const htmlPath = path.join(__dirname, 'overlay.html');
    fs.readFile(htmlPath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Erro ao carregar overlay.html');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/data') {
    if (!botReady) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Bot ainda está conectando ao Discord...' }));
    }

    try {
      const guild = await client.guilds.fetch(GUILD_ID);

      const textChannels = guild.channels.cache.filter(c => c.isTextBased()).sort((a, b) => a.position - b.position).map(c => ({ id: c.id, name: c.name, parentId: c.parentId }));
      const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased()).sort((a, b) => a.position - b.position).map(c => ({ id: c.id, name: c.name, userLimit: c.userLimit, parentId: c.parentId }));
      const allChannelsList = guild.channels.cache.filter(c => !c.isThread()).map(c => ({ id: c.id, name: c.name, type: c.type }));
      const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position).map(c => ({ id: c.id, name: c.name }));

      const voiceMembers = guild.members.cache.filter(m => m.voice.channelId).map(m => ({
        id: m.id,
        name: m.nickname || m.user.globalName || m.user.username,
        avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 }),
        channelId: m.voice.channelId,
        channelName: m.voice.channel?.name
      }));

      const roles = guild.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.hexColor })).filter(r => r.name !== '@everyone');

      const allMembers = guild.members.cache.map(m => {
        const presStatus = m.presence ? m.presence.status : 'offline';
        const activityName = m.presence && m.presence.activities.length > 0 ? m.presence.activities[0].name : null;

        return {
          id: m.id,
          name: m.nickname || m.user.globalName || m.user.username,
          tag: m.user.tag,
          avatar: m.user.displayAvatarURL({ extension: 'png', size: 256 }),
          status: presStatus,
          activity: activityName,
          voiceChannelId: m.voice.channelId,
          voiceChannelName: m.voice.channel?.name,
          isMuted: m.voice.serverMute || m.communicationDisabledUntilTimestamp > Date.now(),
          isDeaf: m.voice.serverDeaf,
          roles: m.roles.cache.map(r => r.name).filter(r => r !== '@everyone')
        };
      });

      const now = Date.now();
      const speakingMembersList = [];
      for (const [userId, lastTime] of activeSpeakers.entries()) {
        if (now - lastTime < 1200) {
          speakingMembersList.push(userId);
        } else {
          activeSpeakers.delete(userId);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        botTag: client.user.tag,
        defconLevel,
        totalMembers: guild.memberCount,
        totalRoles: guild.roles.cache.size,
        currentVoiceChannelId,
        currentVoiceChannelName,
        currentlyPlaying,
        currentVolume,
        currentPitch,
        audioQueue,
        speakingMembers: speakingMembersList,
        roles,
        categories,
        textChannels,
        voiceChannels,
        allChannelsList,
        voiceMembers,
        allMembers
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      const bodyString = Buffer.concat(chunks).toString('utf8');
      const data = JSON.parse(bodyString || '{}');

      // REAL MUSIC SEARCH WITH HD ARTWORK THUMBNAILS VIA ITUNES API
      if (req.url === '/api/search-music') {
        try {
          const query = data.query || 'Valorant';
          const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`;
          const fetchRes = await fetch(itunesUrl);
          const searchJson = await fetchRes.json();

          const results = (searchJson.results || []).map(track => {
            const highResArt = track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '300x300bb') : 'https://cdn.discordapp.com/embed/avatars/0.png';
            return {
              title: `${track.trackName} - ${track.artistName}`,
              url: track.previewUrl,
              artwork: highResArt,
              duration: '0:30 (HD Preview)'
            };
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, results }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      // GET DM CHAT HISTORY FOR A MEMBER DIRECTLY FROM DISCORD API
      if (req.url === '/api/get-dm-history') {
        try {
          const memberId = data.memberId;
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(memberId);

          let history = [];
          try {
            const dmChannel = await member.createDM();
            const fetched = await dmChannel.messages.fetch({ limit: 50 });
            const sorted = Array.from(fetched.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            
            history = sorted.map(m => ({
              id: m.id,
              sender: m.author.id === client.user.id ? 'bot' : 'user',
              content: m.content,
              timestamp: m.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              authorName: m.author.id === client.user.id ? 'Killjoy (Você)' : m.author.username,
              authorAvatar: m.author.displayAvatarURL()
            }));

            // Sync with local dmStore
            dmStore.set(memberId, history);
          } catch (e) {
            history = dmStore.get(memberId) || [];
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, history }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      // CLEAN DM WITHOUT PREFIX & CHAT HISTORY STORE!
      if (req.url === '/api/send-dm') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(data.memberId);
          if (!data.message || !data.message.trim()) throw new Error('Digite uma mensagem válida!');
          
          const sentMsg = await member.send(data.message.trim()); // CLEAN DIRECT MESSAGE!
          
          if (!dmStore.has(data.memberId)) dmStore.set(data.memberId, []);
          dmStore.get(data.memberId).push({
            id: sentMsg.id || Date.now().toString(),
            sender: 'bot',
            content: data.message.trim(),
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            authorName: 'Killjoy (Você)',
            authorAvatar: client.user.displayAvatarURL()
          });

          const history = dmStore.get(data.memberId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, history }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      // DELETE CHANNEL ENDPOINT
      if (req.url === '/api/delete-channel') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const channel = await guild.channels.fetch(data.channelId);
          if (!channel) throw new Error('Canal não encontrado!');
          const chName = channel.name;
          await channel.delete('Deletado via Killjoy Control Center');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, channelName: chName }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      // DISCORD BOT PRESENCE UPDATE FIX
      if (req.url === '/api/update-presence') {
        try {
          const { text, type, status } = data;
          
          const statusMap = { 'online': 'online', 'idle': 'idle', 'dnd': 'dnd', 'invisible': 'invisible' };
          const typeMap = {
            'Playing': ActivityType.Playing,
            'Watching': ActivityType.Watching,
            'Listening': ActivityType.Listening,
            'Streaming': ActivityType.Streaming
          };

          client.user.setPresence({
            status: statusMap[status] || 'online',
            activities: [{
              name: text || 'Os Patifes 🛠️',
              type: typeMap[type] !== undefined ? typeMap[type] : ActivityType.Playing
            }]
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, status, type, text }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      // CREATE CHANNEL WITH CATEGORY PARENT SUPPORT
      if (req.url === '/api/create-channel') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const type = data.type === 'voice' ? ChannelType.GuildVoice : data.type === 'category' ? ChannelType.GuildCategory : ChannelType.GuildText;
          
          const channelData = {
            name: data.name,
            type
          };

          if (data.categoryId) {
            channelData.parent = data.categoryId;
          }

          const created = await guild.channels.create(channelData);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, channelName: created.name }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/add-role-all') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          await guild.members.fetch();
          const roleNameQuery = data.roleName || 'Patifes';
          
          const availableRoles = guild.roles.cache.map(r => r.name);
          const role = guild.roles.cache.find(r => r.name.toLowerCase().includes(roleNameQuery.toLowerCase()));
          if (!role) {
            throw new Error(`Cargo contendo "${roleNameQuery}" não encontrado! Cargos disponíveis: ${availableRoles.join(', ')}`);
          }

          let addedCount = 0;
          for (const [, member] of guild.members.cache) {
            if (!member.user.bot && !member.roles.cache.has(role.id)) {
              try {
                await member.roles.add(role, 'Atribuído via Killjoy Control Center');
                addedCount++;
              } catch (e) {}
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, addedCount, roleName: role.name }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/voice-mute-member') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(data.memberId);
          if (member.voice.channelId) {
            const newState = data.mute !== undefined ? data.mute : !member.voice.serverMute;
            await member.voice.setMute(newState, 'Mute de servidor via Killjoy Control Center');
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/voice-deaf-member') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(data.memberId);
          if (member.voice.channelId) {
            const newState = data.deaf !== undefined ? data.deaf : !member.voice.serverDeaf;
            await member.voice.setDeaf(newState, 'Ensurdecer via Killjoy Control Center');
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/random-move') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(data.memberId);
          if (!member.voice.channelId) throw new Error('O membro não está em nenhuma call de voz!');
          
          const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased() && c.id !== member.voice.channelId);
          const randomChannel = voiceChannels.random();
          if (!randomChannel) throw new Error('Nenhuma outra call encontrada!');

          await member.voice.setChannel(randomChannel, 'Roleta Russa via Killjoy Control Center');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, targetChannel: randomChannel.name }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/unmute-member') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(data.memberId);
          await member.timeout(null, 'Desmutado via Killjoy Control Center');
          if (member.voice.channelId) {
            await member.voice.setMute(false, 'Desmutado via Killjoy Control Center');
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/kick-member') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(data.memberId);
          await member.kick(data.reason || 'Expulso via Killjoy Control Center');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/ban-member') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const member = await guild.members.fetch(data.memberId);
          await member.ban({ reason: data.reason || 'Banido via Killjoy Control Center' });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/set-volume') {
        try {
          const vol = data.volume !== undefined ? parseFloat(data.volume) : 0.8;
          currentVolume = vol;
          if (currentAudioResource && currentAudioResource.volume) {
            currentAudioResource.volume.setVolume(currentVolume);
            console.log(`[Killjoy Voice Engine] 🔊 Volume alterado para ${(currentVolume * 100).toFixed(0)}% na call!`);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, volume: currentVolume }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/upload-and-play') {
        try {
          const { channelId, base64Data, volume, pitch, title } = data;
          const guild = await client.guilds.fetch(GUILD_ID);
          const targetChannelId = channelId || currentVoiceChannelId;

          if (!targetChannelId) throw new Error('Selecione uma call de voz primeiro!');
          if (!base64Data) throw new Error('Nenhum arquivo de áudio recebido!');

          const buffer = Buffer.from(base64Data.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
          fs.writeFileSync(TEMP_AUDIO_PATH, buffer);

          await ensureVoiceConnection(guild, targetChannelId);
          const targetVol = volume !== undefined ? parseFloat(volume) : currentVolume;
          playAudioInVoice(TEMP_AUDIO_PATH, targetVol, title || 'Arquivo MP3 Upload', pitch || currentPitch);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/play-audio-stream') {
        try {
          const { channelId, audioUrl, volume, pitch, title } = data;
          const guild = await client.guilds.fetch(GUILD_ID);
          const targetChannelId = channelId || currentVoiceChannelId;

          if (!targetChannelId) throw new Error('Selecione uma call de voz primeiro!');
          if (!audioUrl) throw new Error('Cole a URL de um áudio MP3!');

          await ensureVoiceConnection(guild, targetChannelId);
          const targetVol = volume !== undefined ? parseFloat(volume) : currentVolume;
          playAudioInVoice(audioUrl, targetVol, title || audioUrl, pitch || currentPitch);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/queue-audio') {
        try {
          const { channelId, audioUrl, title, volume, pitch } = data;
          const guild = await client.guilds.fetch(GUILD_ID);
          const targetChannelId = channelId || currentVoiceChannelId;

          if (!targetChannelId) throw new Error('Selecione uma call de voz primeiro!');
          await ensureVoiceConnection(guild, targetChannelId);

          const targetVol = volume !== undefined ? parseFloat(volume) : currentVolume;
          const track = { title: title || 'Música na Fila', url: audioUrl, volume: targetVol, pitch: pitch || currentPitch };
          if (!currentlyPlaying) {
            playAudioInVoice(track.url, track.volume, track.title, track.pitch);
          } else {
            audioQueue.push(track);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, queueLength: audioQueue.length }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/skip-audio') {
        try {
          stopAudioExecutionSilently();
          playNextInQueue();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/save-voice-clip') {
        try {
          if (voiceAudioBuffer.length === 0) {
            throw new Error('Nenhum áudio de voz capturado ainda! Converse na call primeiro.');
          }

          const pcmData = Buffer.concat(voiceAudioBuffer);
          const rawPcmPath = path.join(__dirname, 'temp_raw.pcm');
          fs.writeFileSync(rawPcmPath, pcmData);

          const ffmpegArgs = ['-f', 's16le', '-ar', '48000', '-ac', '2', '-i', rawPcmPath, '-y', CLIP_OUTPUT_PATH];
          const proc = spawn(ffmpegPath, ffmpegArgs);

          proc.on('close', () => {
            try { fs.unlinkSync(rawPcmPath); } catch (e) {}
            const clipBuffer = fs.readFileSync(CLIP_OUTPUT_PATH);
            const base64Clip = clipBuffer.toString('base64');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true, data: `data:audio/mp3;base64,${base64Clip}` }));
          });
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
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
          if (connection) { connection.destroy(); }
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

      if (req.url === '/api/pause-audio') {
        try {
          audioPlayer.pause();
          isPaused = true;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, isPaused: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/resume-audio') {
        try {
          audioPlayer.unpause();
          isPaused = false;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, isPaused: false }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/toggle-mic') {
        try {
          const connection = getVoiceConnection(GUILD_ID);
          if (!connection) throw new Error('Killjoy não está conectada em nenhuma call!');
          const newMuteState = !connection.joinConfig.selfMute;
          connection.rejoin({ selfMute: newMuteState, selfDeaf: false });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, isSelfMute: newMuteState }));
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
          const targetChannelId = data.targetChannelId || currentVoiceChannelId || guild.channels.cache.filter(c => c.isVoiceBased()).first()?.id;
          if (!targetChannelId) throw new Error('Nenhuma call encontrada!');
          const targetChannel = await guild.channels.fetch(targetChannelId);
          const voiceMembers = guild.members.cache.filter(m => m.voice.channelId && m.voice.channelId !== targetChannelId);
          
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

      if (req.url === '/api/set-pitch') {
        try {
          const pitch = data.pitch !== undefined ? parseFloat(data.pitch) : 1.0;
          currentPitch = pitch;
          if (currentlyPlaying && playbackStartTime) {
            const elapsedSeconds = Math.max(0, (Date.now() - playbackStartTime) / 1000);
            playAudioInVoice(currentlyPlaying.url, currentVolume, currentlyPlaying.title, currentPitch, playbackDuration, elapsedSeconds);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, pitch: currentPitch }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/generate-squads') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          await guild.members.fetch();
          const targetChannelId = currentVoiceChannelId || guild.channels.cache.filter(c => c.isVoiceBased()).first()?.id;
          if (!targetChannelId) throw new Error('Nenhuma call de voz encontrada com membros!');

          const channel = await guild.channels.fetch(targetChannelId);
          const membersInCall = Array.from(channel.members.values()).filter(m => !m.user.bot);
          if (membersInCall.length < 2) throw new Error('São necessários pelo menos 2 membros na call para dividir os squads!');

          const shuffled = membersInCall.sort(() => 0.5 - Math.random());
          const mid = Math.ceil(shuffled.length / 2);
          const teamAttackers = shuffled.slice(0, mid);
          const teamDefenders = shuffled.slice(mid);

          const embed = new EmbedBuilder()
            .setColor(0xffe600)
            .setTitle('⚔️ SORTEIO TÁTICO DE SQUADS — VALORANT MATCH')
            .setDescription(`Divisão automática dos agentes conectados na call **"${channel.name}"**:`)
            .addFields(
              { name: '🔴 TIME ATACANTE (ATTACKERS)', value: teamAttackers.map(m => `• ${m.displayName}`).join('\n') || 'Nenhum', inline: true },
              { name: '🔵 TIME DEFENSOR (DEFENDERS)', value: teamDefenders.map(m => `• ${m.displayName}`).join('\n') || 'Nenhum', inline: true }
            )
            .setFooter({ text: 'KTOS 7.0 // Killjoy Tactical Operating System 🛠️' })
            .setTimestamp();

          const textChannel = guild.channels.cache.filter(c => c.isTextBased()).find(c => c.name.includes('geral') || c.name.includes('chat')) || guild.channels.cache.filter(c => c.isTextBased()).first();
          if (textChannel) await textChannel.send({ embeds: [embed] });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: true,
            attackers: teamAttackers.map(m => m.displayName),
            defenders: teamDefenders.map(m => m.displayName)
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }

      if (req.url === '/api/clutch-mute') {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const targetChannelId = currentVoiceChannelId || guild.channels.cache.filter(c => c.isVoiceBased()).first()?.id;
          if (!targetChannelId) throw new Error('Nenhuma call encontrada!');

          const channel = await guild.channels.fetch(targetChannelId);
          const shouldMute = data.mute !== undefined ? data.mute : true;

          for (const [, member] of channel.members) {
            if (!member.user.bot) {
              try { await member.voice.setMute(shouldMute, 'Modo Clutch via KTOS 7.0'); } catch(e) {}
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, isClutchMuted: shouldMute }));
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
    });
    return;
  }

  res.writeHead(404);
  res.end('Não encontrado');
});

server.listen(PORT, () => {
  console.log(`[Killjoy Control Center 35.0 CLEAN DM & MUSIC ARTWORK] Server rodando em http://localhost:${PORT}`);
  if (TOKEN) {
    client.login(TOKEN).catch(err => {
      console.error('[Killjoy Discord Login] Erro ao conectar bot:', err.message);
    });
  } else {
    console.warn('[Killjoy Discord Login] AVISO: Nível de TOKEN ausente no arquivo .env.');
  }
});
