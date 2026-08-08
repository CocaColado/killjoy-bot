import 'dotenv/config';
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.once('clientReady', async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const me = await guild.members.fetchMe();
  const neon = await guild.members.fetch(process.env.OLD_BOT_ID);
  console.log(JSON.stringify({
    killjoy: { role: me.roles.highest.name, position: me.roles.highest.position, kickMembers: me.permissions.has(PermissionFlagsBits.KickMembers) },
    neon: { role: neon.roles.highest.name, position: neon.roles.highest.position, kickable: neon.kickable }
  }));
  client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
