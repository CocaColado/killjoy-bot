import 'dotenv/config';
import { ChannelType, Client, EmbedBuilder, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('clientReady', async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  await guild.channels.fetch();
  await guild.roles.fetch();
  const ownerRole = guild.roles.cache.find(role => role.name.includes('𝐃𝐨𝐧𝐨') || role.name.toLocaleLowerCase('pt-BR').includes('dono'));
  if (!ownerRole) throw new Error('Cargo de dono não encontrado.');
  const teamCategory = guild.channels.cache.find(channel => channel.type === ChannelType.GuildCategory && channel.name.toLocaleLowerCase('pt-BR').includes('equipe'));
  let channel = guild.channels.cache.find(item => item.type === ChannelType.GuildText && item.name.includes('killjoy-control'));
  if (!channel) {
    channel = await guild.channels.create({
      name: '🛠️・killjoy-control',
      type: ChannelType.GuildText,
      parent: teamCategory?.id,
      topic: 'Central privada dos donos para controlar e configurar a Killjoy.',
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: ownerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.UseApplicationCommands] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] }
      ]
    });
  }
  await channel.send({ embeds: [new EmbedBuilder().setColor(0xffd84d).setTitle('🛠️ Central de Controle da Killjoy')
    .setDescription('Canal privado para os donos administrarem a Killjoy e prepararem alterações no servidor. Membros e moderadores comuns não conseguem visualizar este espaço.\n\nUse os comandos administrativos aqui para evitar bagunça nos canais públicos.')
    .addFields(
      { name: '🎛️ Configuração', value: '`/painel` publica cargos, tickets, regras e informações.' },
      { name: '🧪 Testes', value: '`/testar-boas-vindas`, `/som-killjoy` e `/ping`.' },
      { name: '🛡️ Moderação', value: '`/aviso` registra advertências com histórico.' },
      { name: '⚠️ Segurança', value: 'A Killjoy nunca pedirá token, senha ou chave dentro do Discord.' }
    ).setFooter({ text: 'Killjoy Control // acesso restrito aos donos' }).setTimestamp()] });
  console.log(`Central criada em #${channel.name}, restrita ao cargo ${ownerRole.name}.`);
  client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
