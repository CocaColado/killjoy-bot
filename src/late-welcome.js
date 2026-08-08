import 'dotenv/config';
import { AttachmentBuilder, ChannelType, Client, EmbedBuilder, GatewayIntentBits } from 'discord.js';
import sharp from 'sharp';

const targetId = process.argv[2];
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const escapeXml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);

client.once('clientReady', async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID); await guild.channels.fetch();
  const member = await guild.members.fetch(targetId);
  const channel = guild.channels.cache.find(item => item.type === ChannelType.GuildText && item.name.includes('boas-vindas'));
  const avatarResponse = await fetch(member.user.displayAvatarURL({ extension: 'png', size: 512 }));
  const avatar = await sharp(Buffer.from(await avatarResponse.arrayBuffer())).resize(230, 230, { fit: 'cover' }).composite([{ input: Buffer.from('<svg width="230" height="230"><circle cx="115" cy="115" r="108" fill="white"/></svg>'), blend: 'dest-in' }]).png().toBuffer();
  const name = escapeXml(member.displayName).slice(0, 22);
  const overlay = Buffer.from(`<svg width="1000" height="420" xmlns="http://www.w3.org/2000/svg"><style>.label{font:700 22px Arial;fill:#d7ff35;letter-spacing:4px}.name{font:900 54px Arial;fill:#fff}.body{font:500 24px Arial;fill:#b8c8d8}.count{font:800 23px Arial;fill:#071018}.footer{font:700 18px Arial;fill:#00e0c6;letter-spacing:2px}</style><circle cx="183" cy="210" r="123" fill="none" stroke="#d7ff35" stroke-width="7"/><circle cx="183" cy="210" r="132" fill="none" stroke="#00e0c6" stroke-width="2" stroke-dasharray="18 12"/><text x="355" y="118" class="label">NOVO AGENTE DETECTADO</text><text x="355" y="190" class="name">${name}</text><text x="355" y="235" class="body">foi aprovado pela Killjoy. Pode entrar!</text><rect x="355" y="270" width="210" height="54" rx="12" fill="#ffd52a"/><text x="380" y="305" class="count">MEMBRO ${guild.memberCount}</text><text x="600" y="305" class="footer">KILLJOY // ONLINE</text></svg>`);
  const card = await sharp('assets/killjoy-welcome-bg.png').resize(1000, 420, { fit: 'cover' }).composite([{ input: avatar, left: 68, top: 95 }, { input: overlay, left: 0, top: 0 }]).png().toBuffer();
  const registration = guild.channels.cache.find(item => item.type === ChannelType.GuildText && item.name.includes('registro'));
  const embed = new EmbedBuilder().setColor(0xffd84d).setTitle('🛠️ Novo agente detectado').setThumbnail(member.user.displayAvatarURL({ size: 256 })).setDescription(`**${member.displayName}** foi aprovado pela Killjoy. Pode entrar!\n\nComplete sua ficha em ${registration ?? '#registro'}, pegue seus cargos e encontre sua tropa no lobby.\n\nAgora somos **${guild.memberCount}** membros.`).setImage('attachment://killjoy-welcome.png').setFooter({ text: 'Killjoy Control // recepção atrasada, sistema calibrado 💛' }).setTimestamp();
  await channel.send({ content: `${member}`, embeds: [embed], files: [new AttachmentBuilder(card, { name: 'killjoy-welcome.png' })], allowedMentions: { users: [member.id] } });
  console.log(`Recepção enviada para ${member.user.username}.`); client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
