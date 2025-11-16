// Centralized static configuration to avoid circular imports
export const MODULE_ID = 'isometric-perspective';

// Runtime helpers
export function getFoundryVersion() {
  const parts = String(game.version || '').split('.').map(p => parseInt(p, 10) || 0);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

export function isDebugEnabled() {
  try { return !!game.settings.get(MODULE_ID, 'debug'); } catch (err) { return false; }
}

export function isWorldIsometricEnabled() {
  try { return !!game.settings.get(MODULE_ID, 'worldIsometricFlag'); } catch (err) { return false; }
}

// Convenience logging wrapper (small helper used where needed)
export function logDebug(...args) {
  if (isDebugEnabled()) console.log(...args);
}

export function logWarn(...args) {
  console.warn(...args);
}

export function logError(...args) {
  console.error(...args);
}
