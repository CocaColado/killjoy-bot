const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const store = require('../../state/store');
const { saveProfilesDB, saveAgentsDB } = require('../../utils/db');

// All Valorant Agents Hardcoded for Fallback
const ALL_VALORANT_AGENTS = ['Astra', 'Breach', 'Brimstone', 'Chamber', 'Clove', 'Cypher', 'Deadlock', 'Fade', 'Gekko', 'Harbor', 'Iso', 'Jett', 'KAY/O', 'Killjoy', 'Neon', 'Omen', 'Phoenix', 'Raze', 'Reyna', 'Sage', 'Skye', 'Sova', 'Vyse', 'Yoru'];

module.exports = async function handleInteraction(interaction) {
  try {
    const customId = interaction.customId || '';

    // SLASH COMMAND HANDLER
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'sortear-agente' || interaction.commandName === 'sortear') {
        const userId = interaction.user.id;
        const userAgentsSet = store.userAgentsMap.get(userId);
        let pool = userAgentsSet && userAgentsSet.size > 0 ? Array.from(userAgentsSet) : ALL_VALORANT_AGENTS;
        const drawnAgent = pool[Math.floor(Math.random() * pool.length)];

        // We don't have buildDrawnAgentEmbed exported, so we just use a basic one here temporarily
        // until we extract embed builders.
        const embed = new EmbedBuilder()
          .setColor(0xFFE600)
          .setTitle('🎲 Sorteio de Agente')
          .setDescription(`O agente sorteado para você foi: **${drawnAgent}**!`)
          .setFooter({ text: 'Killjoy Control Center' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        setTimeout(async () => {
          try { await interaction.deleteReply(); } catch (e) {}
        }, 120_000);
        return;
      }
    }

    // MESSAGE COMPONENT HANDLER
    if (interaction.isMessageComponent()) {
      if (customId === 'sel_agents_am' || customId === 'sel_agents_ny') {
        const userId = interaction.user.id;
        if (!store.userAgentsMap.has(userId)) store.userAgentsMap.set(userId, new Set());
        const userSet = store.userAgentsMap.get(userId);
        interaction.values.forEach(agent => userSet.add(agent));
        saveAgentsDB();
        return await interaction.reply({ content: `✅ Agentes adicionados ao seu arsenal: **${interaction.values.join(', ')}**`, ephemeral: true });
      }

      if (customId === 'btn_agents_all') {
        store.userAgentsMap.set(interaction.user.id, new Set(ALL_VALORANT_AGENTS));
        saveAgentsDB();
        return await interaction.reply({ content: '✅ Você adicionou **TODOS** os agentes ao seu arsenal!', ephemeral: true });
      }

      if (customId === 'btn_agents_clear') {
        store.userAgentsMap.delete(interaction.user.id);
        saveAgentsDB();
        return await interaction.reply({ content: '🧹 Seu arsenal de agentes foi resetado.', ephemeral: true });
      }

      if (customId === 'btn_agents_view') {
        const userSet = store.userAgentsMap.get(interaction.user.id);
        if (!userSet || userSet.size === 0) {
          return await interaction.reply({ content: 'Você não tem nenhum agente cadastrado ainda.', ephemeral: true });
        }
        return await interaction.reply({ content: `📋 Seu arsenal atual (${userSet.size} agentes):\n**${Array.from(userSet).join(', ')}**`, ephemeral: true });
      }

      if (customId === 'btn_register' || customId === 'btn_edit') {
        const existingProfile = store.playerProfiles.get(interaction.user.id);
        const modal = new ModalBuilder()
          .setCustomId('modal_player_register')
          .setTitle(customId === 'btn_edit' ? 'Editar ficha' : 'Registro de Jogador');
        
        const nickInput = new TextInputBuilder().setCustomId('valorant_nick').setLabel('Nick no Valorant').setStyle(TextInputStyle.Short).setRequired(true);
        const eloInput = new TextInputBuilder().setCustomId('valorant_elo').setLabel('Elo atual').setStyle(TextInputStyle.Short).setRequired(true);
        const agentsInput = new TextInputBuilder().setCustomId('valorant_agents').setLabel('Agentes principais').setStyle(TextInputStyle.Paragraph).setRequired(true);

        if (existingProfile) {
          if (existingProfile.nick) nickInput.setValue(existingProfile.nick);
          if (existingProfile.elo) eloInput.setValue(existingProfile.elo);
          if (existingProfile.agents) agentsInput.setValue(existingProfile.agents);
        }

        modal.addComponents(new ActionRowBuilder().addComponents(nickInput), new ActionRowBuilder().addComponents(eloInput), new ActionRowBuilder().addComponents(agentsInput));
        return await interaction.showModal(modal);
      }

      if (customId === 'btn_view') {
        const profile = store.playerProfiles.get(interaction.user.id);
        if (!profile) {
          return await interaction.reply({ content: '⚠️ Ficha não encontrada.', ephemeral: true });
        }
        const profileEmbed = new EmbedBuilder()
          .setColor(0xFFE600)
          .setTitle('🎭 Perfil de Jogador')
          .addFields(
            { name: '🎮 Nick', value: profile.nick || 'N/A', inline: true },
            { name: '🏆 Elo', value: profile.elo || 'N/A', inline: true },
            { name: '🦾 Agentes', value: profile.agents || 'N/A', inline: false }
          );
        return await interaction.reply({ embeds: [profileEmbed], ephemeral: true });
      }

      await interaction.reply({ content: '⚠️ Este botão ou menu expirou ou não está mais ativo.', ephemeral: true }).catch(() => {});
      return;
    }

    // MODAL SUBMIT HANDLER
    if (interaction.isModalSubmit()) {
      if (customId === 'modal_player_register') {
        const nick = interaction.fields.getTextInputValue('valorant_nick').trim();
        const elo = interaction.fields.getTextInputValue('valorant_elo').trim();
        const agents = interaction.fields.getTextInputValue('valorant_agents').trim();
        
        store.playerProfiles.set(interaction.user.id, { userId: interaction.user.id, username: interaction.user.username, nick, elo, agents });
        saveProfilesDB();
        
        return await interaction.reply({ content: '✅ Ficha salva com sucesso!', ephemeral: true });
      }
      await interaction.deferUpdate().catch(() => {});
      return;
    }

  } catch (err) {
    console.error('[InteractionRouter Error]:', err.message);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: 'Ocorreu um erro interno na interação.', ephemeral: true }).catch(() => {});
    }
  }
};
