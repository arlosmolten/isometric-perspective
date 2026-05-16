import { isometricModuleConfig } from './consts.js';
import { adjustInputWithMouseDrag, parseNum, patchConfig, createAdjustableButton} from './utils.js';

export async function createRegionIsometricTab(app, html, data) {

  const regionTabConfig = {
    moduleConfig: isometricModuleConfig,
    label: game.i18n.localize("isometric-perspective.tab_isometric_name"),
    tabGroup : "sheet",
    tabId : "isometric",
    icon: "fas fa-cube",
    templatePath: 'modules/isometric-perspective/templates/region-config.hbs'
  }

// Region config data
const FoundryRegionConfig = foundry.applications.sheets.RegionConfig;
const DefaultRegionConfig = Object.values(CONFIG.Region.sheetClasses.base).find((d) => d.default)?.cls;
const RegionConfig = DefaultRegionConfig?.prototype instanceof FoundryRegionConfig ? DefaultRegionConfig : FoundryRegionConfig;
patchConfig(RegionConfig,regionTabConfig);  
}

export function initRegionForm(app, html, context, options){
  const depthSortingCheckbox = html.querySelector('input[name="flags.isometric-perspective.isoRegionTilesAutoSortingEnabled"]');
  const linkTilesBox = html.querySelector('.linked-tiles-container');
  const isRegionDepthSortEnabled = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'isoRegionTilesAutoSortingEnabled');
  
  depthSortingCheckbox.addEventListener('change', (event) => {
    if (event.target.checked === true){
      app.document.setFlag(isometricModuleConfig.MODULE_ID, 'isoRegionTilesAutoSortingEnabled', true);
    } else {
      app.document.setFlag(isometricModuleConfig.MODULE_ID, 'isoRegionTilesAutoSortingEnabled', false);
    }
  });

  if (isRegionDepthSortEnabled){
    linkTilesBox.classList.remove('hidden');
  } else {
    linkTilesBox.classList.add('hidden');
  }

// Region room tiles linking
  const selectTileButton = html.querySelector('.select-tiles');
  const clearTileButton = html.querySelector('.clear-tiles');
  const linkedTilesIdInput = html.querySelector('input[name="flags.isometric-perspective.linkedTilesIds"]');

  selectTileButton?.addEventListener('click', selectTiles);
  clearTileButton?.addEventListener('click', clearTiles);

// Region config data
  const FoundryRegionConfig = foundry.applications.sheets.RegionConfig;
  const DefaultRegionConfig = Object.values(CONFIG.Region.sheetClasses.base).find((d) => d.default)?.cls;
  const RegionConfig = DefaultRegionConfig?.prototype instanceof FoundryRegionConfig ? DefaultRegionConfig : FoundryRegionConfig;

  function selectTiles(event) {    
    Object.values(ui.windows).filter(w => w instanceof RegionConfig).forEach(j => j.minimize());
    canvas.tiles.activate();

    Hooks.once('controlTile', async (tile) => {
      const selectedTilesId = tile.id.toString();
      const flagIds = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'linkedTilesIds') || [];
      const currentTilesIds = [].concat(flagIds);

      // Add the new ID only if it is not already in the list.
      if (!currentTilesIds.includes(selectedTilesId)) {
        const newTilesIds = [...currentTilesIds, selectedTilesId];
        await app.document.setFlag(isometricModuleConfig.MODULE_ID, 'linkedTilesIds', newTilesIds);
        const canvasLayer = canvas.primary.children;
        const currentRegionId = context.document._id;
        tile.document.setFlag(isometricModuleConfig.MODULE_ID, 'regionLink', currentRegionId); // this flag aint set correctly
      }
      // Returns the window to its original position and activates the RegionLayer layer.
      Object.values(ui.windows).filter(w => w instanceof RegionConfig).forEach(j => j.maximize());
      canvas.regions.activate();
    });
  }

  async function clearTiles () {
    const canvasLayer = canvas.primary.children;
    const linkedTilesIds = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'linkedTilesIds')
    
    // unlink linked tiles regionLink
    canvasLayer.filter(children => children.object?.document?.getFlag(isometricModuleConfig.MODULE_ID, 'regionLink'))
    .filter( tile => tile.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'regionLink') === app.document.id)
    .map( tile => {
      tile.object.document.setFlag(isometricModuleConfig.MODULE_ID, 'regionLink', null);
    })

    await app.document.setFlag(isometricModuleConfig.MODULE_ID, 'linkedTilesIds', []);
    if (linkedTilesIdInput) linkedTilesIdInput.value = '';
  }
}
  
  
