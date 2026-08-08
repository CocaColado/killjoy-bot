const fs = require('fs');
const path = require('path');
const store = require('../state/store');

const AGENTS_DB_PATH = path.join(__dirname, '../../user_agents.json');
const PROFILES_DB_PATH = path.join(__dirname, '../../player_profiles.json');

// Robust Persistent JSON Storage for Player Profiles
function loadProfilesDB() {
  try {
    if (fs.existsSync(PROFILES_DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(PROFILES_DB_PATH, 'utf8'));
      const map = new Map();
      for (const [userId, profile] of Object.entries(data)) {
        map.set(userId, profile);
      }
      return map;
    }
  } catch (e) {
    console.error('Erro ao carregar player_profiles.json:', e.message);
  }
  return new Map();
}

function saveProfilesDB() {
  try {
    const obj = {};
    for (const [userId, profile] of store.playerProfiles.entries()) {
      obj[userId] = profile;
    }
    fs.writeFileSync(PROFILES_DB_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro Crítico ao salvar player_profiles.json (Protegido contra crash):', e.message);
  }
}

// Persistent JSON Storage Functions for Saved User Agents
function loadAgentsDB() {
  try {
    if (fs.existsSync(AGENTS_DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(AGENTS_DB_PATH, 'utf8'));
      const map = new Map();
      for (const [userId, agents] of Object.entries(data)) {
        map.set(userId, new Set(agents));
      }
      return map;
    }
  } catch (e) {
    console.error('Erro ao carregar user_agents.json:', e.message);
  }
  return new Map();
}

function saveAgentsDB() {
  try {
    const obj = {};
    for (const [userId, agentSet] of store.userAgentsMap.entries()) {
      obj[userId] = Array.from(agentSet);
    }
    fs.writeFileSync(AGENTS_DB_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro Crítico ao salvar user_agents.json:', e.message);
  }
}

function initDB() {
  store.playerProfiles = loadProfilesDB();
  store.userAgentsMap = loadAgentsDB();
}

module.exports = {
  loadProfilesDB,
  saveProfilesDB,
  loadAgentsDB,
  saveAgentsDB,
  initDB
};
