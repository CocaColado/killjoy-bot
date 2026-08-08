import store from '../../../state/store.js';
import { saveAgentsDB } from '../../../utils/db.js';

export function getArsenal(userId) {
  const set = store.userAgentsMap.get(userId) || new Set();
  return {
    agents: Array.from(set)
  };
}

export function hasAgent(userId, agentId) {
  const set = store.userAgentsMap.get(userId);
  return set ? set.has(agentId) : false;
}

export function toggleAgent(userId, agentId) {
  if (!store.userAgentsMap.has(userId)) {
    store.userAgentsMap.set(userId, new Set());
  }
  
  const agents = store.userAgentsMap.get(userId);

  if (agents.has(agentId)) {
    agents.delete(agentId);
  } else {
    agents.add(agentId);
  }

  return { agents: Array.from(agents) };
}

export function resetArsenal(userId) {
  store.userAgentsMap.delete(userId);
  saveAgentsDB();
}

export function saveArsenal(userId) {
  saveAgentsDB();
}
