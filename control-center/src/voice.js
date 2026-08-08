import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus,
  createAudioPlayer, createAudioResource, entersState, joinVoiceChannel
} from '../../node_modules/@discordjs/voice/dist/index.mjs';
import { audit } from './store.js';

let connection = null;
let player = null;
let current = null;
let volume = 0.08;

export function voiceState() {
  return { connected: !!connection, playing: player?.state?.status === AudioPlayerStatus.Playing, current, volume };
}
export async function joinChannel(client, channelId) {
  const guild = client.guilds.cache.first(); const channel = guild.channels.cache.get(channelId);
  if (!channel?.isVoiceBased()) throw new Error('Escolha uma call válida.');
  if (connection) connection.destroy();
  connection = joinVoiceChannel({ channelId:channel.id, guildId:guild.id, adapterCreator:guild.voiceAdapterCreator, selfDeaf:true });
  await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  player = createAudioPlayer({ behaviors:{ noSubscriber:NoSubscriberBehavior.Pause } });
  connection.subscribe(player); player.on('error',e=>console.error('Áudio OVERDRIVE:',e)); player.on(AudioPlayerStatus.Idle,()=>{current=null;});
  await audit('voice.join',`OVERDRIVE entrou em ${channel.name}`); return voiceState();
}
export async function playFile(file, requestedVolume = 0.08) {
  if (!connection || !player) throw new Error('Conecte o OVERDRIVE a uma call primeiro.');
  const absolute = path.resolve(file); if (!existsSync(absolute)) throw new Error('Arquivo de áudio não encontrado neste PC.');
  volume = Math.min(0.25, Math.max(0.01, Number(requestedVolume) || 0.08));
  const resource = createAudioResource(absolute, { inlineVolume:true }); resource.volume?.setVolume(volume); current=path.basename(absolute); player.play(resource);
  await audit('voice.play',`${current} em volume ${Math.round(volume*100)}%`); return voiceState();
}
export function stopAudio() { player?.stop(true); current=null; return voiceState(); }
export async function leaveVoice() { if(connection){connection.destroy();connection=null;} player=null;current=null;await audit('voice.leave','OVERDRIVE saiu da call');return voiceState(); }
