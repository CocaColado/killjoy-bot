import 'dotenv/config';
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { readFile, writeFile } from 'node:fs/promises';

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
const oldBotId = process.env.OLD_BOT_ID;
if (!token || !guildId || !oldBotId) throw new Error('DISCORD_TOKEN, GUILD_ID e OLD_BOT_ID são obrigatórios.');

const backupPath = `data/bot-${oldBotId}.json`;
const statePath = 'data/migration-state.json';
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

async function loadState() {
  try { return JSON.parse(await readFile(statePath, 'utf8')); }
  catch { return { migrated: {}, failures: [] }; }
}

function cleanEmbed(embed) {
  const allowed = ['title', 'description', 'url', 'color', 'fields', 'author', 'thumbnail', 'image', 'footer', 'timestamp'];
  return Object.fromEntries(allowed.filter(key => embed[key] !== undefined).map(key => [key, embed[key]]));
}

function cleanComponents(rows) {
  return rows.map(row => ({
    type: 1,
    components: (row.components ?? []).map(component => {
      const button = { type: 2, style: component.style, disabled: component.disabled ?? false };
      if (component.label) button.label = component.label;
      if (component.emoji) button.emoji = component.emoji;
      if (component.url) button.url = component.url;
      else if (component.custom_id) button.custom_id = component.custom_id;
      return button;
    })
  })).filter(row => row.components.length);
}

client.once('clientReady', async () => {
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  const state = await loadState();
  const guild = await client.guilds.fetch(guildId);
  await guild.channels.fetch();

  let migratedNow = 0;
  const failures = [];
  for (const savedChannel of backup.channels) {
    if (!savedChannel.messages?.length) continue;
    const channel = guild.channels.cache.get(savedChannel.id);
    if (!channel?.isTextBased() || !channel.isSendable()) {
      failures.push({ channelId: savedChannel.id, reason: 'Canal inacessível' });
      continue;
    }

    for (const saved of savedChannel.messages) {
      if (state.migrated[saved.id]) continue;
      try {
        const original = await channel.messages.fetch(saved.id);
        if (original.author.id !== oldBotId) throw new Error('A mensagem não pertence mais à Neon');

        const attachmentLinks = (saved.attachments ?? []).map(file => `[📎 ${file.name}](${file.url})`).join('\n');
        const contentParts = [saved.content, attachmentLinks].filter(Boolean);
        const sent = await channel.send({
          content: contentParts.join('\n').slice(0, 2000) || undefined,
          embeds: (saved.embeds ?? []).slice(0, 10).map(cleanEmbed),
          components: cleanComponents(saved.components ?? []).slice(0, 5),
          allowedMentions: { parse: [] }
        });
        await original.delete();
        state.migrated[saved.id] = { replacementId: sent.id, channelId: channel.id, at: new Date().toISOString() };
        await writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
        migratedNow++;
        console.log(`#${channel.name}: ${saved.id} -> ${sent.id}`);
      } catch (error) {
        failures.push({ messageId: saved.id, channelId: savedChannel.id, reason: error.message });
      }
    }
  }

  state.failures = failures;
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');

  if (!failures.length) {
    try {
      const neon = await guild.members.fetch(oldBotId);
      if (!neon.user.bot) throw new Error('O ID antigo não pertence a um bot');
      if (!neon.kickable) throw new Error('A Killjoy não pode expulsar a Neon; ajuste a posição dos cargos e Expulsar membros');
      await neon.kick('Migração concluída para Killjoy');
      console.log(`Migração concluída (${migratedNow} novas). Neon removida do servidor.`);
    } catch (error) {
      console.error(`Mensagens migradas, mas Neon não foi removida: ${error.message}`);
      process.exitCode = 2;
    }
  } else {
    console.error(`Migração parcial: ${failures.length} falha(s). Neon foi mantida por segurança.`);
    process.exitCode = 1;
  }
  client.destroy();
});

client.login(token);
