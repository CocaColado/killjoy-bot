import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { readFile, writeFile } from 'node:fs/promises';
import { applyCompatibleRoles, profileEmbed } from './registration.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.once('clientReady', async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID); await guild.members.fetch(); await guild.roles.fetch(); await guild.channels.fetch();
  const channel = guild.channels.cache.find(item => item.isTextBased() && item.name.includes('registro'));
  const profiles = JSON.parse(await readFile('data/registration-profiles.json', 'utf8').catch(() => '{}'));
  const requestedUserId = process.argv[2];
  if (!requestedUserId || !profiles[requestedUserId]?.completedAt) throw new Error('Perfil concluído do usuário solicitado não encontrado.');
  let synced = 0;
  for (const [userId, profile] of Object.entries(profiles)) {
    if (userId !== requestedUserId) continue;
    if (!profile.completedAt) continue;
    const member = await guild.members.fetch(userId).catch(() => null); if (!member) continue;
    await applyCompatibleRoles(member, profile);
    const payload = { content: `🧪 ${member} concluiu a calibração de agente.`, embeds: [await profileEmbed(member.user, profile)], allowedMentions: { users: [member.id] } };
    let message = profile.publicMessageId ? await channel.messages.fetch(profile.publicMessageId).catch(() => null) : null;
    if (message) await message.edit(payload); else { message = await channel.send(payload); profile.publicMessageId = message.id; }
    synced++;
  }
  await writeFile('data/registration-profiles.json', JSON.stringify(profiles, null, 2), 'utf8');
  console.log(`${synced} perfil(is) sincronizado(s).`); client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
