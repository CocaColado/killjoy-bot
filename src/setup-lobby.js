import 'dotenv/config';
import { ChannelType, Client, GatewayIntentBits } from 'discord.js';
import { lobbyPanel } from './lobby.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('clientReady', async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID); await guild.channels.fetch();
  const channel = guild.channels.cache.find(item => item.type === ChannelType.GuildText && item.name.includes('lobby'));
  if (!channel) throw new Error('Canal de lobby não encontrado.');
  const recent = await channel.messages.fetch({ limit: 50 });
  const oldPanel = recent.find(message => message.author.id === client.user.id && message.embeds[0]?.title?.includes('Central de Lobby'));
  if (oldPanel) await oldPanel.edit(lobbyPanel(0)); else await channel.send(lobbyPanel(0));
  await channel.setTopic('Entre na fila, encontre pessoas compatíveis e monte seu squad com a Killjoy.').catch(() => {});
  console.log(`Central pronta em #${channel.name} (${channel.id}).`); client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
