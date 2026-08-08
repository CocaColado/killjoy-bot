import 'dotenv/config';
import { spawn } from 'node:child_process';
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { AudioPlayerStatus, NoSubscriberBehavior, StreamType, VoiceConnectionStatus, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel } from '@discordjs/voice';
import ffmpegPath from 'ffmpeg-static';

const songPath = process.argv[2];
if (!songPath) throw new Error('Informe o caminho da música.');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] });
client.once('clientReady', async () => {
  let connection;
  let transcoder;
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.members.fetch();
    await guild.channels.fetch();
    const ownersInVoice = guild.members.cache.filter(member => !member.user.bot && member.voice.channel && (member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.some(role => role.name.toLocaleLowerCase('pt-BR').includes('dono'))));
    const target = ownersInVoice.first()?.voice.channel ?? guild.channels.cache.find(channel => channel.isVoiceBased() && channel.members.some(member => !member.user.bot));
    if (!target) throw new Error('Não encontrei ninguém em uma call acessível.');
    const permissions = target.permissionsFor(guild.members.me);
    if (!permissions?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) throw new Error('A Killjoy não tem permissão para conectar e falar nessa call.');

    connection = joinVoiceChannel({ channelId: target.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true });
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    transcoder = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', songPath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    const resource = createAudioResource(transcoder.stdout, { inputType: StreamType.Raw, inlineVolume: true });
    resource.volume.setVolume(0.08);
    connection.subscribe(player);
    player.play(resource);
    console.log(`Killjoy tocando em #${target.name} com volume de 8%.`);
    await new Promise((resolve, reject) => {
      player.once(AudioPlayerStatus.Idle, resolve);
      player.once('error', reject);
      transcoder.once('error', reject);
    });
  } catch (error) {
    console.error(error.message);
  } finally {
    transcoder?.kill();
    connection?.destroy();
    client.destroy();
  }
});
client.login(process.env.DISCORD_TOKEN);
