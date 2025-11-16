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
  const header = html.find('.window-header .window-title');
  if (!header.length) return;
  if (html.find('button.iso-tile-config-open').length) return;

  const label = game.i18n.localize('isometric-perspective.tab_isometric_name');
  const button = $(`<button type="button" class="iso-tile-config-open" title="${label}">${label}</button>`);
  header.after(button);

  button.on('click', () => {
    const isoApp = new TileIsoSettings(app.object);
    isoApp.render(true);
  });
}

function handleTileMutation(tileDocument, updateData = {}) {
  const tile = canvas.tiles?.get(tileDocument.id);
  if (!tile) return;

  if (Object.keys(updateData).length > 0 && !hasRelevantTileChanges(updateData)) return;
  scheduleTileTransform(tile);
}

function handleTileRefresh(tile) {
  if (!(tile instanceof Tile)) return;
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
