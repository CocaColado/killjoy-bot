import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

const legacy = {
  '1515814969847840792': 'casual', '1515814971471036558': 'tryhard', '1515814972536656015': 'competitivo',
  '1515814975866798200': 'mobile', '1515814976848269312': 'pc',
  '1515814977762754605': 'duelista', '1515814980191129600': 'sentinela', '1515814981705142413': 'controlador', '1515814982741397597': 'iniciador'
};
const obsoleteSeparators = ['1515814969277415615', '1515814974696722595', '1515809369659412621'];
const specs = {
  pc: ['🖥', 'ᴘᴄ', 0x5865f2], console: ['🎮', 'ᴄᴏɴsᴏʟᴇ', 0x9b59ff], mobile: ['📱', 'ᴍᴏʙɪʟᴇ', 0x00a2ff],
  casual: ['🌿', 'ᴄᴀsᴜᴀʟ', 0x2ecc71], competitivo: ['🏆', 'ᴄᴏᴍᴘᴇᴛɪᴛɪᴠᴏ', 0xffd84d], tryhard: ['🔥', 'ᴛʀʏʜᴀʀᴅ', 0xff4655], resenha: ['😂', 'sᴏ́ ʀᴇsᴇɴʜᴀ', 0xf1c40f],
  duelista: ['⚔', 'ᴅᴜᴇʟɪsᴛᴀ', 0xff4655], iniciador: ['🎯', 'ɪɴɪᴄɪᴀᴅᴏʀ', 0x00d8ff], controlador: ['🌫', 'ᴄᴏɴᴛʀᴏʟᴀᴅᴏʀ', 0x9b59ff], sentinela: ['🛡', 'sᴇɴᴛɪɴᴇʟᴀ', 0x2ecc71], flex: ['🔄', 'ғʟᴇx', 0x00e0c6],
  valorant: ['🔺', 'ᴠᴀʟᴏʀᴀɴᴛ', 0xff4655], marvel: ['🦸', 'ᴍᴀʀᴠᴇʟ ʀɪᴠᴀʟs', 0xf39c12], roblox: ['🧱', 'ʀᴏʙʟᴏx', 0x00a2ff], minecraft: ['⛏', 'ᴍɪɴᴇᴄʀᴀғᴛ', 0x65b741], outros: ['🎲', 'ᴏᴜᴛʀᴏs ᴊᴏɢᴏs', 0x9b59ff],
  sem_elo: ['➖', 'sᴇᴍ ᴇʟᴏ', 0x95a5a6], ferro: ['⚙', 'ғᴇʀʀᴏ', 0x6b7280], bronze: ['🥉', 'ʙʀᴏɴᴢᴇ', 0xcd7f32], prata: ['🥈', 'ᴘʀᴀᴛᴀ', 0xbfc9d4], ouro: ['🥇', 'ᴏᴜʀᴏ', 0xffc400], platina: ['💠', 'ᴘʟᴀᴛɪɴᴀ', 0x45c9c1], diamante: ['💎', 'ᴅɪᴀᴍᴀɴᴛᴇ', 0x9b8cff], ascendente: ['🟢', 'ᴀsᴄᴇɴᴅᴇɴᴛᴇ', 0x20c997], imortal: ['🔴', 'ɪᴍᴏʀᴛᴀʟ', 0xe74c5b], radiante: ['🌟', 'ʀᴀᴅɪᴀɴᴛᴇ', 0xffd700]
};

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.once('clientReady', async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID); await guild.roles.fetch(); await guild.members.fetch();
  const legacyIds = new Set(Object.keys(legacy)); const targets = {};
  let separator = guild.roles.cache.find(role => role.name === '━━━━ ᴘᴇʀғɪʟ ᴅᴇ ᴊᴏɢᴀᴅᴏʀ ━━━━');
  if (!separator) separator = await guild.roles.create({ name: '━━━━ ᴘᴇʀғɪʟ ᴅᴇ ᴊᴏɢᴀᴅᴏʀ ━━━━', color: 0x2b2d31, reason: 'Nova organização do registro' });
  for (const [key, [emoji, name, color]] of Object.entries(specs)) {
    let role = guild.roles.cache.find(item => !legacyIds.has(item.id) && !item.managed && item.name.startsWith(emoji));
    if (!role) role = await guild.roles.create({ name: `${emoji}・${name}`, color, reason: 'Novo sistema de registro' });
    else await role.edit({ name: `${emoji}・${name}`, color, reason: 'Identidade visual do registro' });
    targets[key] = role;
  }
  for (const [legacyId, targetKey] of Object.entries(legacy)) {
    const oldRole = guild.roles.cache.get(legacyId); if (!oldRole) continue;
    for (const member of oldRole.members.values()) await member.roles.add(targets[targetKey], 'Migração do registro antigo').catch(() => {});
    await oldRole.delete('Substituído pelo novo sistema de registro');
  }
  for (const id of obsoleteSeparators) { const role = guild.roles.cache.get(id); if (role) await role.delete('Seção antiga consolidada no novo registro'); }
  const ordered = [separator, ...Object.values(targets)];
  const positions = {}; let position = 30;
  for (const role of ordered) positions[role.id] = position--;
  await guild.roles.setPositions(positions).catch(() => {});
  console.log(`Redesign concluído: ${Object.keys(targets).length} cargos estilizados e ${Object.keys(legacy).length} cargos antigos migrados.`); client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
