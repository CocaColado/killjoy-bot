const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const store = require('../../state/store');

// All Valorant Agents & Split
const ALL_VALORANT_AGENTS = ['Astra', 'Breach', 'Brimstone', 'Chamber', 'Clove', 'Cypher', 'Deadlock', 'Fade', 'Gekko', 'Harbor', 'Iso', 'Jett', 'KAY/O', 'Killjoy', 'Neon', 'Omen', 'Phoenix', 'Raze', 'Reyna', 'Sage', 'Skye', 'Sova', 'Vyse', 'Yoru'];
const AGENTS_AM = ['Astra', 'Breach', 'Brimstone', 'Chamber', 'Clove', 'Cypher', 'Deadlock', 'Fade', 'Gekko', 'Harbor', 'Iso', 'Jett', 'KAY/O', 'Killjoy', 'Neon'];
const AGENTS_NY = ['Omen', 'Phoenix', 'Raze', 'Reyna', 'Sage', 'Skye', 'Sova', 'Vyse', 'Yoru'];
const AGENT_EMOJIS = {
  'Astra': '🔮', 'Breach': '💥', 'Brimstone': '☄️', 'Chamber': '💼', 'Clove': '🪷',
  'Cypher': '🕵️', 'Deadlock': '🕸️', 'Fade': '👁️', 'Gekko': '🐊', 'Harbor': '🌊',
  'Iso': '🛡️', 'Jett': '💨', 'KAY/O': '🤖', 'Killjoy': '🛠️',
  'Neon': '⚡', 'Omen': '👤', 'Phoenix': '🔥', 'Raze': '💣', 'Reyna': '🩸',
  'Sage': '🧊', 'Skye': '🦅', 'Sova': '🏹', 'Vyse': '🪽', 'Yoru': '🦊'
};

module.exports = async function handleMessage(message) {
  if (message.author.bot) return;

  // DM Listener
  if (!message.guild || message.channel.type === ChannelType.DM) {
    const userId = message.author.id;
    if (!store.dmStore.has(userId)) store.dmStore.set(userId, []);
    
    store.dmStore.get(userId).push({
      id: message.id || Date.now().toString(),
      sender: 'user',
      content: message.content,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      authorName: message.author.username,
      authorAvatar: message.author.displayAvatarURL()
    });
    console.log(`[Killjoy DM Messenger] Nova mensagem de ${message.author.tag}: ${message.content}`);
    // Optional: Return or continue to allow commands in DMs if needed. Usually commands aren't allowed in DM.
    return;
  }

  const content = message.content.toLowerCase().trim();

  // COMMAND: !painel-agentes
  if (content === '!painel-agentes') {
    if (!message.member?.permissions.has('Administrator')) {
      return message.reply('❌ Apenas administradores podem gerar o painel de agentes.');
    }
    try {
      const embed = new EmbedBuilder()
        .setColor(0xFFE600)
        .setTitle('🔫 Arsenal de Agentes')
        .setDescription('**Quais agentes você joga?**\nSelecione seus mains abaixo. Isso ajuda o bot a sortear um agente pra você quando você não souber o que jogar!\n\nUse o comando `/sortear-agente` ou digite `sortear agente` no chat depois de escolher.')
        .setFooter({ text: 'Killjoy Control // Arsenal' });

      const selectAM = new StringSelectMenuBuilder().setCustomId('sel_agents_am').setPlaceholder('Adicionar agentes — A até M').setMinValues(1).setMaxValues(AGENTS_AM.length);
      AGENTS_AM.forEach(agent => selectAM.addOptions(new StringSelectMenuOptionBuilder().setLabel(agent).setValue(agent).setEmoji(AGENT_EMOJIS[agent] || '👤')));

      const selectNY = new StringSelectMenuBuilder().setCustomId('sel_agents_ny').setPlaceholder('Adicionar agentes — N até Y').setMinValues(1).setMaxValues(AGENTS_NY.length);
      AGENTS_NY.forEach(agent => selectNY.addOptions(new StringSelectMenuOptionBuilder().setLabel(agent).setValue(agent).setEmoji(AGENT_EMOJIS[agent] || '👤')));

      const row1 = new ActionRowBuilder().addComponents(selectAM);
      const row2 = new ActionRowBuilder().addComponents(selectNY);
      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_agents_all').setLabel('Tenho todos').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_agents_view').setLabel('Ver meu cadastro').setEmoji('📋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_agents_clear').setLabel('Resetar').setEmoji('🧹').setStyle(ButtonStyle.Danger)
      );

      const panelMessage = await message.channel.send({ embeds: [embed], components: [row1, row2, row3] });
      try { await panelMessage.pin(); } catch (e) {}
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // COMMAND: !painel-registro
  if (content === '!painel-registro') {
    if (!message.member?.permissions.has('Administrator')) {
      return message.reply('❌ Apenas administradores podem gerar o painel de registro.');
    }
    try {
      const embed = new EmbedBuilder()
        .setColor(0xFFE600)
        .setTitle('🧪 Central de Registro da Killjoy')
        .setDescription('**Monte sua ficha de jogador**\n\nLeva menos de um minuto. Suas escolhas ficam salvas e ajudam a encontrar gente com o mesmo estilo, horário e objetivos.\n\n🎮 **Perfil completo**\nNick, elo e agentes principais.\n\n🔄 **Sem arrependimento**\nVocê pode editar tudo depois.\n\nClique em um dos botões abaixo para começar.')
        .setFooter({ text: 'Killjoy Control // Identificação de Agentes 💛' });

      const registerButton = new ButtonBuilder().setCustomId('btn_register').setLabel('Começar registro').setEmoji('🧪').setStyle(ButtonStyle.Success);
      const editButton = new ButtonBuilder().setCustomId('btn_edit').setLabel('Editar ficha').setEmoji('📝').setStyle(ButtonStyle.Primary);
      const viewButton = new ButtonBuilder().setCustomId('btn_view').setLabel('Ver meu perfil').setEmoji('👤').setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(registerButton, editButton, viewButton);

      const panelMessage = await message.channel.send({ embeds: [embed], components: [row] });
      try { await panelMessage.pin(); } catch (e) {}
    } catch (e) {
      console.error('Erro ao criar painel de registro:', e);
    }
    return;
  }

  // COMMAND: sortear agente
  if (content === 'sortear agente' || content === '/sortear-agente' || content.includes('sortear agente') || content.startsWith('sortear')) {
    const userId = message.author.id;
    const userAgentsSet = store.userAgentsMap.get(userId);
    let pool = userAgentsSet && userAgentsSet.size > 0 ? Array.from(userAgentsSet) : ALL_VALORANT_AGENTS;

    const drawnAgent = pool[Math.floor(Math.random() * pool.length)];
    
    // We recreate a simplified version of buildDrawnAgentEmbed to keep it self-contained for now
    const embed = new EmbedBuilder()
      .setColor(0xFFE600)
      .setTitle('🎲 Sorteio de Agente')
      .setDescription(`Você vai jogar de: **${drawnAgent}**!`)
      .setFooter({ text: 'Killjoy Control Center' })
      .setTimestamp();

    const replyMsg = await message.reply({ embeds: [embed] });

    setTimeout(async () => {
      try { await replyMsg.delete(); } catch (e) {}
    }, 120_000);
  }
};
