import 'dotenv/config';
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

const wanted = ['Casual', 'Tryhard', 'Competitivo', 'Mobile', 'PC', 'Duelista', 'Sentinela', 'Controlador', 'Iniciador', 'Sem Mira'];
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.once('clientReady', async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  await guild.roles.fetch();
  const me = await guild.members.fetchMe();
  const roles = wanted.map(name => {
    const role = guild.roles.cache.find(item => item.name.toLowerCase() === name.toLowerCase());
    return { name, exists: Boolean(role), editable: role?.editable ?? false, position: role?.position ?? null };
  });
  console.log(JSON.stringify({ manageRoles: me.permissions.has(PermissionFlagsBits.ManageRoles), highestRole: me.roles.highest.name, highestPosition: me.roles.highest.position, roles, availableRoles: guild.roles.cache.filter(role => !role.managed && role.name !== '@everyone').map(role => ({ name: role.name, position: role.position })) }));
  client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
