import { isometricModuleConfig } from './consts.js';
import { 
  sortPlaceableByPosition,
  sortPlaceableByRegion,
  isIsometricAutosortingEnabledForPlaceable
} from './utils.js';

export function isoDepthSortTileMixin(Base){
  return class DepthSortTile extends (Base){
    _refreshState() {
      super._refreshState();
      //prevent mesh flickering on hover or controlled
      this.zIndex = 0;
      this.mesh.zIndex = 0;

      const isTileSortable = this.document.flags[isometricModuleConfig.MODULE_ID]?.isoTileAutoSortingEnabled || false;
      if (isTileSortable){
        this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS; 
      } else { 
        this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TILES; 
      }
    }
    _onUpdate(changed, options, userId) {
      super._onUpdate(changed, options, userId);
      console.log("changed", changed)
      this.zIndex = 0;
      this.mesh.zIndex = 0;
      if ("y" in changed || "x" in changed) {
        sortPlaceableByPosition(this);
      }
    }
  }
}

export function isoDepthSortTokenMixin(Base){  
  return class DepthSortPlaceable extends Base{
    _refreshState() {
      super._refreshState();
      //prevent mesh flickering on hover or controlled
      this.zIndex = 0;
      this.mesh.zIndex = 0;
      // sortPlaceableByPosition(this);
    }

    _onUpdate(changed, options, userId) {
      super._onUpdate(changed, options, userId);
      this.zIndex = 0;
      this.mesh.zIndex = 0;
      
      if ("y" in changed || "x" in changed) {
        const currentRegions = Array.from(this.document.regions).map(region => region);
        const currentRegion = currentRegions[0]?._id;
        this.document.setFlag(isometricModuleConfig.MODULE_ID, 'currentRegion', currentRegion);
        sortPlaceableByRegion(this);
      }
    }
  }
}