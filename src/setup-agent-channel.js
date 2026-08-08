import 'dotenv/config';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client,
  EmbedBuilder, GatewayIntentBits, StringSelectMenuBuilder
} from 'discord.js';

const agents = ['Astra', 'Breach', 'Brimstone', 'Chamber', 'Clove', 'Cypher', 'Deadlock', 'Fade', 'Gekko', 'Harbor', 'Iso', 'Jett', 'KAY/O', 'Killjoy', 'Miks', 'Neon', 'Omen', 'Phoenix', 'Raze', 'Reyna', 'Sage', 'Skye', 'Sova', 'Tejo', 'Veto', 'Viper', 'Vyse', 'Waylay', 'Yoru'];
const agentEmojis = { Astra: '🌌', Breach: '🦾', Brimstone: '🛰️', Chamber: '🎩', Clove: '🦋', Cypher: '👁️', Deadlock: '🕸️', Fade: '🌑', Gekko: '🦎', Harbor: '🌊', Iso: '🎯', Jett: '🌪️', 'KAY/O': '🤖', Killjoy: '🛠️', Miks: '🎵', Neon: '⚡', Omen: '👻', Phoenix: '🔥', Raze: '💣', Reyna: '👑', Sage: '💎', Skye: '🦅', Sova: '🏹', Tejo: '🚀', Veto: '⛓️', Viper: '☣️', Vyse: '🌹', Waylay: '✨', Yoru: '🌀' };
const groups = [agents.slice(0, 15), agents.slice(15)];
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  await guild.channels.fetch();
  const existing = guild.channels.cache.find(channel => channel.name.includes('agentes') && channel.type === ChannelType.GuildText);
  const gamesCategory = guild.channels.cache.find(channel => channel.type === ChannelType.GuildCategory && channel.name.toLocaleLowerCase('pt-BR').includes('jogos'));
  const channel = existing ?? await guild.channels.create({ name: '🎯・agentes', type: ChannelType.GuildText, parent: gamesCategory?.id, topic: 'Cadastre seus agentes e use os sorteios da Killjoy.' });
  const selects = groups.map((group, index) => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`agent:add:${index}`).setPlaceholder(index === 0 ? 'Adicionar agentes — A até M' : 'Adicionar agentes — N até Y')
      .setMinValues(1).setMaxValues(group.length).addOptions(group.map(agent => ({ label: agent, value: agent, emoji: agentEmojis[agent] })))
  ));
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('agent:all').setLabel('Tenho todos').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('agent:list').setLabel('Ver meu cadastro').setEmoji('📋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('agent:reset').setLabel('Resetar').setEmoji('🧹').setStyle(ButtonStyle.Secondary)
  );
  const payload = {
    embeds: [new EmbedBuilder().setColor(0xffd84d).setTitle('🎯 Arsenal de Agentes')
      .setDescription('Marque abaixo somente os agentes que você possui. Você pode selecionar vários de uma vez e voltar depois para adicionar mais.\n\nA Killjoy usará apenas o seu cadastro em `/sortear-agente`. Se você desbloquear alguém novo, é só selecionar aqui.')
      .addFields(
        { name: '✅ Tenho todos', value: 'Libera o elenco inteiro para seus sorteios.', inline: true },
        { name: '📋 Ver cadastro', value: 'Mostra sua lista somente para você.', inline: true },
        { name: '🧹 Resetar', value: 'Apaga sua lista para começar novamente.', inline: true }
      ).setFooter({ text: 'Killjoy Control — seleção calculada, diversão garantida 💛' })],
    components: [...selects, buttons]
  };
  const recent = await channel.messages.fetch({ limit: 50 });
  const currentPanel = recent.find(message => message.author.id === client.user.id && message.embeds[0]?.title === '🎯 Arsenal de Agentes');
  if (currentPanel) await currentPanel.edit(payload);
  else await channel.send(payload);
  console.log(`Painel criado em #${channel.name} (${channel.id}).`);
  client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
