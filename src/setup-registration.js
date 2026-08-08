import 'dotenv/config';
import { ChannelType, Client, GatewayIntentBits } from 'discord.js';
import { registrationPanel } from './registration.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('clientReady', async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID); await guild.channels.fetch();
  const channel = guild.channels.cache.find(item => item.type === ChannelType.GuildText && item.name.includes('registro'));
  if (!channel) throw new Error('Canal de registro não encontrado.');
  const messages = await channel.messages.fetch({ limit: 50 });
  const oldPanels = messages.filter(message => message.author.id === client.user.id);
  for (const message of oldPanels.values()) await message.delete().catch(() => {});
  await channel.send(registrationPanel());
  await channel.setTopic('Monte e edite sua ficha de jogador com a Killjoy.').catch(() => {});
  console.log(`Registro atualizado em #${channel.name} (${channel.id}).`); client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
