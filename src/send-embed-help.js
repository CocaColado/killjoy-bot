import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.once('clientReady', async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  await guild.channels.fetch();
  const members = await guild.members.fetch({ query: 'pestan', limit: 10 });
  const friend = members.find(member => member.user.username.toLocaleLowerCase('pt-BR').includes('pestan') || member.displayName.toLocaleLowerCase('pt-BR').includes('pestan'));
  const channel = guild.channels.cache.find(item => item.name.includes('agentes') && item.isTextBased());
  if (!channel) throw new Error('Canal de agentes não encontrado.');
  const mention = friend ? `<@${friend.id}>` : '**pestan**';
  await channel.send({
    content: `🛠️ ${mention}, diagnóstico da Killjoy: seu Discord está escondendo os cartões e imagens dos agentes.\n\nAbra **Configurações do usuário → Chat** (ou **Texto e imagens**) e ative **Mostrar incorporações e visualizações de links publicados no chat**. Depois pressione **Ctrl + R** para recarregar o Discord.\n\nAí meus relatórios táticos voltam a aparecer completos. 💛`,
    allowedMentions: friend ? { users: [friend.id] } : { parse: [] }
  });
  console.log(`Ajuda enviada em #${channel.name}${friend ? ` para ${friend.user.tag}` : ''}.`);
  client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
