import { MODULE_ID } from './config.js';

const PRESET_SETTING = 'scenePresets';

function getStoredPresets() {
  try {
    return game.settings.get(MODULE_ID, PRESET_SETTING) ?? {};
  } catch (error) {
    console.warn('[isometric-perspective] Failed to read scene presets', error);
    return {};
  }
}

export function getScenePresets() {
  return getStoredPresets();
}

export function getScenePreset(id) {
  return getStoredPresets()[id] ?? null;
}

export async function saveScenePreset(name, data, id = null) {
  const presets = getStoredPresets();
  const targetId = id || String(Date.now());
  presets[targetId] = {
    name,
    data
  };
  await game.settings.set(MODULE_ID, PRESET_SETTING, presets);
  return targetId;
}

export async function deleteScenePreset(id) {
  const presets = getStoredPresets();
  if (!presets[id]) return;
  delete presets[id];
  await game.settings.set(MODULE_ID, PRESET_SETTING, presets);
}
