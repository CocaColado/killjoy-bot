import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { AGENTS, CATEGORY_META } from './arsenalData.js';
import { hasAgent, getArsenal } from './arsenalStore.js';

export function buildPublicArsenalPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xffe600)
    .setTitle('🎯 Arsenal de Agentes')
    .setDescription(
      '**Monte seu arsenal pessoal da Killjoy.**\n\n' +
      'Escolha os agentes que você joga e eles serão usados nos sorteios.'
    )
    .addFields(
      {
        name: '🎯 Montar arsenal',
        value: 'Escolha seus agentes por função.',
        inline: true
      },
      {
        name: '📋 Meu arsenal',
        value: 'Veja sua seleção atual.',
        inline: true
      },
      {
        name: '🧹 Resetar',
        value: 'Comece novamente.',
        inline: true
      }
    )
    .setFooter({
      text: 'Killjoy Control — Arsenal inteligente 💛'
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('agent:setup')
      .setLabel('Montar meu arsenal')
      .setEmoji('🎯')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('agent:list')
      .setLabel('Meu arsenal')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('agent:reset')
      .setLabel('Resetar')
      .setEmoji('🧹')
      .setStyle(ButtonStyle.Danger)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

export function buildCategoryView() {
  const embed = new EmbedBuilder()
    .setColor(0xffe600)
    .setTitle('🎯 Monte seu Arsenal')
    .setDescription(
      'Escolha uma função para visualizar os agentes.\n\n' +
      'Você pode voltar e editar quantas vezes quiser.'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('agent:category:duelists')
      .setLabel('Duelistas')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('agent:category:controllers')
      .setLabel('Controladores')
      .setEmoji('☁️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('agent:category:initiators')
      .setLabel('Iniciadores')
      .setEmoji('🧠')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('agent:category:sentinels')
      .setLabel('Sentinelas')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

export function buildAgentCard(userId, category, index = 0) {
  const agents = AGENTS[category];

  if (!agents || agents.length === 0) {
    return null;
  }

  const safeIndex = Math.max(0, Math.min(index, agents.length - 1));
  const agent = agents[safeIndex];
  const selected = hasAgent(userId, agent.name); // Notice using agent.name because ids are names in our generated output

  const embed = new EmbedBuilder()
    .setColor(selected ? 0x22c55e : CATEGORY_META[category].color)
    .setTitle(`${agent.emoji} ${agent.name}`)
    .setDescription(
      `**${CATEGORY_META[category].emoji} ${agent.role}**\n\n` +
      (
        selected
          ? '✅ Este agente está no seu arsenal.'
          : '➕ Este agente ainda não está no seu arsenal.'
      )
    )
    .setImage(agent.fullPortrait || agent.displayIcon)
    .setFooter({
      text: `${safeIndex + 1}/${agents.length} • Killjoy Arsenal`
    });

  const navigationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`agent:page:${category}:${safeIndex - 1}`)
      .setLabel('Anterior')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safeIndex === 0),

    new ButtonBuilder()
      .setCustomId(`agent:toggle:${category}:${agent.name}:${safeIndex}`)
      .setLabel(selected ? 'Remover' : 'Adicionar')
      .setEmoji(selected ? '❌' : '✅')
      .setStyle(
        selected
          ? ButtonStyle.Danger
          : ButtonStyle.Success
      ),

    new ButtonBuilder()
      .setCustomId(`agent:page:${category}:${safeIndex + 1}`)
      .setLabel('Próximo')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safeIndex === agents.length - 1)
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('agent:categories')
      .setLabel('Categorias')
      .setEmoji('↩️')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('agent:list')
      .setLabel('Meu arsenal')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('agent:save')
      .setLabel('Finalizar')
      .setEmoji('💾')
      .setStyle(ButtonStyle.Success)
  );

  return {
    embeds: [embed],
    components: [navigationRow, actionRow]
  };
}

export function buildFinalScreen(userId) {
  const arsenal = getArsenal(userId);
  const selected = new Set(arsenal.agents);
  
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle('✅ ARSENAL CONFIGURADO')
    .setDescription(`**${selected.size} agentes selecionados**\n\n`)
    .setFooter({ text: 'A Killjoy usará este arsenal em /sortear-agente.' });
  
  let desc = `**${selected.size} agente${selected.size === 1 ? '' : 's'} selecionado${selected.size === 1 ? '' : 's'}**\n\n`;

  for (const [key, meta] of Object.entries(CATEGORY_META)) {
    const agentsInCategory = AGENTS[key].filter(a => selected.has(a.name));
    if (agentsInCategory.length > 0) {
      desc += `${meta.emoji} **${meta.label}**\n`;
      desc += agentsInCategory.map(a => a.name).join(' • ') + '\n\n';
    }
  }

  if (selected.size === 0) {
    desc = 'Nenhum agente foi cadastrado.';
    embed.setColor(0xff4655);
  }

  embed.setDescription(desc);

  return { embeds: [embed], components: [] };
}
