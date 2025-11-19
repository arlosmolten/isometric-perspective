import { MODULE_ID } from './config.js';
import { applyIsometricTransformation } from './transform.js';
import { TileIsoSettings } from './apps/tile-iso-app.js';

export function registerTileConfig() {
  Hooks.on('renderTileConfig', addTileIsoButton);
  Hooks.on('createTile', handleTileMutation);
  Hooks.on('updateTile', handleTileMutation);
  Hooks.on('refreshTile', handleTileRefresh);
}

function addTileIsoButton(app, html) {
  const root = resolveElement(html);
  if (!root) return;

  const header = root.querySelector('.window-header .window-title');
  if (!header) return;
  if (root.querySelector('button.iso-tile-config-open')) return;

  const label = game.i18n.localize('isometric-perspective.tab_isometric_name');
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('iso-tile-config-open');
  button.title = label;
  button.textContent = label;

  header.insertAdjacentElement('afterend', button);

  button.addEventListener('click', () => {
    const isoApp = new TileIsoSettings(app.object);
    isoApp.render(true);
  });
}

function resolveElement(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  if (Array.isArray(element)) {
    for (const entry of element) {
      if (entry instanceof HTMLElement) return entry;
    }
  }
  return null;
}

function handleTileMutation(tileDocument, updateData = {}) {
  const tile = canvas.tiles?.get(tileDocument.id);
  if (!tile) return;

  if (Object.keys(updateData).length > 0 && !hasRelevantTileChanges(updateData)) return;
  scheduleTileTransform(tile);
}

function handleTileRefresh(tile) {
  if (!(tile instanceof foundry.canvas.placeables.Tile)) return;
  scheduleTileTransform(tile);
}

function scheduleTileTransform(tile) {
  const scene = tile.scene;
  if (!scene) return;

  const isSceneIsometric = scene.getFlag(MODULE_ID, 'isometricEnabled');
  requestAnimationFrame(() => applyIsometricTransformation(tile, isSceneIsometric));
}

function hasRelevantTileChanges(updateData) {
  const keys = ['x', 'y', 'width', 'height', 'rotation'];
  if (keys.some((key) => key in updateData)) return true;
  if (updateData.texture !== undefined) return true;

  const flagUpdates = foundry.utils.getProperty(updateData, `flags.${MODULE_ID}`);
  return flagUpdates !== undefined;
}
