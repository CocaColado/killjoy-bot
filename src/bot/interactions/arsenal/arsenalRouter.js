import { buildCategoryView, buildAgentCard, buildFinalScreen } from './arsenalViews.js';
import { toggleAgent, getArsenal, resetArsenal, saveArsenal } from './arsenalStore.js';

export async function handleAgentInteraction(interaction) {
  const customId = interaction.customId;

  if (!customId?.startsWith('agent:')) {
    return false;
  }

  const parts = customId.split(':');
  const action = parts[1];

  // ==============================
  // Abrir Arsenal
  // ==============================
  if (action === 'setup') {
    await interaction.reply({
      ...buildCategoryView(),
      ephemeral: true
    });
    return true;
  }

  // ==============================
  // Categorias
  // ==============================
  if (action === 'category') {
    const category = parts[2];
    const view = buildAgentCard(interaction.user.id, category, 0);
    await interaction.update(view);
    return true;
  }

  // ==============================
  // Navegação
  // ==============================
  if (action === 'page') {
    const category = parts[2];
    const index = Number(parts[3]);
    const view = buildAgentCard(interaction.user.id, category, index);
    await interaction.update(view);
    return true;
  }

  // ==============================
  // Adicionar / remover agente
  // ==============================
  if (action === 'toggle') {
    const category = parts[2];
    const agentId = parts[3];
    const index = Number(parts[4]);

    toggleAgent(interaction.user.id, agentId);
    
    // We update the view to reflect the new state
    const view = buildAgentCard(interaction.user.id, category, index);
    await interaction.update(view);
    return true;
  }

  // ==============================
  // Voltar
  // ==============================
  if (action === 'categories') {
    await interaction.update(buildCategoryView());
    return true;
  }

  // ==============================
  // Meu arsenal
  // ==============================
  if (action === 'list' || action === 'view') {
    const arsenal = getArsenal(interaction.user.id);
    await interaction.reply({
      ephemeral: true,
      content: arsenal.agents.length > 0
          ? `📋 Seus agentes:\n**${arsenal.agents.sort().join(', ')}**`
          : '📋 Seu arsenal está vazio.'
    });
    return true;
  }

  // ==============================
  // Salvar (Finalizar)
  // ==============================
  if (action === 'save') {
    saveArsenal(interaction.user.id);
    const view = buildFinalScreen(interaction.user.id);
    await interaction.update(view);
    return true;
  }

  // ==============================
  // Reset
  // ==============================
  if (action === 'reset' || action === 'clear') {
    resetArsenal(interaction.user.id);
    await interaction.reply({
      ephemeral: true,
      content: '🧹 Seu arsenal foi apagado.\nVocê pode começar de novo clicando em Montar meu arsenal.'
    });
    return true;
  }

  return false;
}
