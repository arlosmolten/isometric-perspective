import { isometricModuleConfig } from './consts.js';
import { applyIsometricTransformation } from './transform.js';
import { adjustInputWithMouseDrag, parseNum, patchConfig, createAdjustableButton} from './utils.js';

export async function createTileIsometricTab(app, html, data) {

  const tileTabConfig = {
    moduleConfig: isometricModuleConfig,
    label: game.i18n.localize("isometric-perspective.tab_isometric_name"),
    tabGroup : "sheet",
    tabId : "isometric",
    icon: "fas fa-cube",
    templatePath: 'modules/isometric-perspective/templates/tile-config.hbs'
  }

  // Tile config data
  const FoundryTileConfig = foundry.applications.sheets.TileConfig;
  const DefaultTileConfig = Object.values(CONFIG.Tile.sheetClasses.base).find((d) => d.default)?.cls;
  const TileConfig = DefaultTileConfig?.prototype instanceof FoundryTileConfig ? DefaultTileConfig : FoundryTileConfig;
  patchConfig(TileConfig,tileTabConfig);
  
}

export function initTileForm(app, html, context, options){

  //Tile art offset
  createAdjustableButton({
    buttonElement: html.querySelector('.fine-adjust'),
    inputs: [
      html.querySelector('input[name="flags.isometric-perspective.offsetX"]'),
      html.querySelector('input[name="flags.isometric-perspective.offsetY"]')
    ],
    adjustmentScale: [0.1, 0.1], 
    roundingPrecision: 2
  });

  //Dynamic tile and wall linking

  const selectWallButton = html.querySelector('.select-wall');
  const clearWallButton = html.querySelector('.clear-wall');
  const linkedWallsIdInput = html.querySelector('input[name="flags.isometric-perspective.linkedWallIds"]');

  // Initialize values
  const currentOffsetX = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'offsetX');
  const currentOffsetY = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'offsetY');
  const currentScale = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'scale');

  const inputOffsetX = html.querySelector('input[name="flags.isometric-perspective.offsetX"]');
  const inputOffsetY = html.querySelector('input[name="flags.isometric-perspective.offsetY"]');
  const inputScale = html.querySelector('range-picker[name="flags.isometric-perspective.scale"]');

  if (inputOffsetX) inputOffsetX.value = currentOffsetX ?? 0;
  if (inputOffsetY) inputOffsetY.value = currentOffsetY ?? 0;
  if (inputScale) inputScale.value = currentScale ?? 1;

  selectWallButton?.addEventListener('click', selectWall);
  clearWallButton?.addEventListener('click', clearWall);

  // Tile config data
  const FoundryTileConfig = foundry.applications.sheets.TileConfig;
  const DefaultTileConfig = Object.values(CONFIG.Tile.sheetClasses.base).find((d) => d.default)?.cls;
  const TileConfig = DefaultTileConfig?.prototype instanceof FoundryTileConfig ? DefaultTileConfig : FoundryTileConfig;

  function selectWall(event) {    
    Object.values(ui.windows).filter(w => w instanceof TileConfig).forEach(j => j.minimize());
    canvas.walls.activate();

    Hooks.once('controlWall', async (wall) => {
      const selectedWallId = wall.id.toString();
      const currentWallIds = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds') || [];
      
      // Add the new ID only if it is not already in the list.
      if (!currentWallIds.includes(selectedWallId)) {
        const newWallIds = [...currentWallIds, selectedWallId];
        await app.document.setFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds', newWallIds);
        if (linkedWallsIdInput) linkedWallsIdInput.value = newWallIds.join(", ");
      }

      // Returns the window to its original position and activates the TileLayer layer.
      Object.values(ui.windows).filter(w => w instanceof TileConfig).forEach(j => j.maximize());
      canvas.tiles.activate();
    });
  }

  async function clearWall () {
    await app.document.setFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds', []);
    if (linkedWallsIdInput) linkedWallsIdInput.value = '';
  }
}

export function handleCreateTile(tileDocument) {
  const tile = canvas.tiles.get(tileDocument.id);
  if (!tile) return;
  const scene = tile.scene;
  const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  requestAnimationFrame(() => applyIsometricTransformation(tile, isSceneIsometric));
}

export function handleUpdateTile(tileDocument, updateData, options, userId) {
  const tile = canvas.tiles.get(tileDocument.id);
  if (!tile) return;
  
  const scene = tile.scene;
  const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  
  if (updateData.x !== undefined ||
      updateData.y !== undefined ||
      updateData.width !== undefined ||
      updateData.height !== undefined ||
      updateData.texture !== undefined) {
    requestAnimationFrame(() => applyIsometricTransformation(tile, isSceneIsometric));
  }
}

export function handleRefreshTile(tile) {
  const scene = tile.scene;
  const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  applyIsometricTransformation(tile, isSceneIsometric);
}
  
  
