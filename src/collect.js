import 'dotenv/config';
import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
const oldBotId = process.env.OLD_BOT_ID?.trim() || null;

if (!token || !guildId) {
  console.error('Preencha DISCORD_TOKEN e GUILD_ID no arquivo .env.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const messageChannelTypes = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.AnnouncementThread,
  ChannelType.PublicThread,
  ChannelType.PrivateThread
]);

const announcements = [
  '🔧 **Killjoy na área!** Estou analisando o histórico da Neon neste canal e catalogando os recursos que ela usava. Relaxa, eu cuido disso. 🤖',
  '🛰️ **Varredura iniciada.** Estou estudando as mensagens da Neon por aqui para reconstruir comandos, respostas e sistemas. Nenhuma mensagem será alterada.',
  '💛 **Operação: recuperar a Neon.** Estou lendo o histórico disponível deste canal e mapeando o que o bot antigo fazia. Já volto com o diagnóstico!',
  '🧪 **Análise em andamento!** A Killjoy está examinando as atividades da Neon neste canal. Só leitura — nada será apagado ou modificado.'
];

async function announce(channel, index) {
  try {
    const permissions = channel.permissionsFor(client.user);
    if (!permissions?.has(PermissionFlagsBits.SendMessages) || !channel.isSendable()) return null;
    return await channel.send({
      content: announcements[index % announcements.length],
      allowedMentions: { parse: [] }
    });
  } catch {
    return null;
  }
}

function serializeMessage(message, channel) {
  return {
    id: message.id,
    channelId: channel.id,
    channelName: channel.name,
    author: {
      id: message.author.id,
      username: message.author.username,
      displayName: message.member?.displayName ?? message.author.globalName,
      bot: message.author.bot
    },
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    replyTo: message.reference?.messageId ?? null,
    attachments: [...message.attachments.values()].map(a => ({
      id: a.id,
      name: a.name,
      url: a.url,
      contentType: a.contentType,
      size: a.size
    })),
    embeds: message.embeds.map(embed => embed.toJSON()),
    components: message.components.map(component => component.toJSON()),
    reactions: [...message.reactions.cache.values()].map(reaction => ({
      emoji: reaction.emoji.toString(),
      count: reaction.count
    }))
  };
}

async function collectChannel(channel) {
  const collected = [];
  let before;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;

    for (const message of batch.values()) {
      if (!oldBotId || message.author.id === oldBotId) {
        collected.push(serializeMessage(message, channel));
      }
    }

    before = batch.last().id;
    process.stdout.write(`\r#${channel.name}: ${collected.length} mensagens selecionadas`);
    if (batch.size < 100) break;
  }

  process.stdout.write('\n');
  return collected.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function discoverChannels(guild) {
  await guild.channels.fetch();
  const channels = [...guild.channels.cache.values()].filter(channel =>
    messageChannelTypes.has(channel.type) && channel.viewable
  );

  const containers = [...guild.channels.cache.values()].filter(channel =>
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildAnnouncement ||
    channel.type === ChannelType.GuildForum ||
    channel.type === ChannelType.GuildMedia
  );

  for (const container of containers) {
    try {
      const active = await container.threads.fetchActive();
      channels.push(...active.threads.values());
      const archived = await container.threads.fetchArchived({ fetchAll: true });
      channels.push(...archived.threads.values());
    } catch {
      // Alguns canais não permitem listar threads; a coleta continua nos demais.
    }
  }

  return [...new Map(channels.map(channel => [channel.id, channel])).values()];
}

client.once('ready', async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.fetch();
    console.log(`Coletando o servidor: ${guild.name}`);

    const channels = await discoverChannels(guild);
    const output = {
      collectedAt: new Date().toISOString(),
      guild: { id: guild.id, name: guild.name },
      oldBotId,
      channels: []
    };

    for (const [index, channel] of channels.entries()) {
      try {
        const statusMessage = await announce(channel, index);
        const messages = await collectChannel(channel);
        output.channels.push({
          id: channel.id,
          name: channel.name,
          parentId: channel.parentId ?? null,
          type: channel.type,
          messages
        });
        if (statusMessage) {
          await statusMessage.edit({
            content: `✅ **Canal analisado!** Encontrei **${messages.length}** mensagens da Neon disponíveis aqui. Os dados foram catalogados para reconstrução. — Killjoy 💛`,
            allowedMentions: { parse: [] }
          }).catch(() => {});
        }
      } catch (error) {
        console.warn(`Não foi possível ler #${channel.name}: ${error.message}`);
      }
    }

    const dataDir = path.resolve('data');
    await mkdir(dataDir, { recursive: true });
    const filename = oldBotId ? `bot-${oldBotId}.json` : 'servidor-completo.json';
    const destination = path.join(dataDir, filename);
    await writeFile(destination, JSON.stringify(output, null, 2), 'utf8');

    const total = output.channels.reduce((sum, channel) => sum + channel.messages.length, 0);
    console.log(`Concluído: ${total} mensagens salvas em ${destination}`);
  } catch (error) {
    console.error('Falha na coleta:', error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token).catch(error => {
  console.error('Não foi possível entrar no Discord:', error.message);
  process.exit(1);
});
