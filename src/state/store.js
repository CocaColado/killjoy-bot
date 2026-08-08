// src/state/store.js
// Centralized state manager to replace global variables

const state = {
  botReady: false,
  botLoginError: null,
  defconLevel: 0,
  
  // Voice & Audio
  currentVoiceChannelId: null,
  currentVoiceChannelName: null,
  audioQueue: [],
  currentlyPlaying: null,
  activeConnection: null,
  currentAudioResource: null,
  currentVolume: 0.8,
  currentPitch: 1.0,
  playbackStartTime: null,
  playbackDuration: 180,
  isPaused: false,

  // Temporary Data Maps
  registrationState: new Map(),
  dmStore: new Map(),
  activeSpeakers: new Map(),
  
  // Persistent Data (Will be loaded by DB utility)
  userAgentsMap: new Map(),
  playerProfiles: new Map(),
};

module.exports = state;
