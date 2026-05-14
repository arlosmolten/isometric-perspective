import { isometricModuleConfig } from './consts.js';
import { 
  sortPlaceableByPosition,
  sortPlaceableByRegion,
  debugCanvasLayer
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
      this.zIndex = 0;
      this.mesh.zIndex = 0;
      if ("y" in changed || "x" in changed) {
        const sortList = sortPlaceableByPosition(this);
        for (let i = 0; i < sortList.length; i++) {
          const currentSprite = sortList[i];
          currentSprite.object.document.sort = i;
          currentSprite.sort = i;
        }

        this.mesh.parent.sortDirty = true;
      }
    }
  }
}

export function isoDepthSortTokenMixin(Base){  
  return class DepthSortPlaceable extends Base{
    sortList = [];
    /** 
     * notable observations : a single token move by one square trigger _refreshState() up to 5 times , 
     * and a lot of other _onUpdate() can fire in between, _onUpdate() is usually one step behind _refreshState()
     * _onUpdate()  and _refreshState() should never get mutual triggering code execution , otherwhise this cause an endless loop
     * be warned! this will make your pc fan scream in pain!
    */
    _refreshState() {
      super._refreshState();
      //prevent mesh flickering on hover or controlled
      this.zIndex = 0;
      this.mesh.zIndex = 0;

        // if ( this.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion')) { // to decomment when sortByRegion works
        //   this.sortList = sortPlaceableByRegion(this);
        // } else {
          this.sortList = sortPlaceableByPosition(this);
        // }
      for (let i = 0; i < this.sortList.length; i++) {
        const currentSprite = this.sortList[i];
        currentSprite.object.document.sort = i;
        currentSprite.sort = i;
      }
      debugCanvasLayer(this.sortList)
      this.mesh.parent.sortDirty = true;
    }

    _onUpdate(changed, options, userId) {
      super._onUpdate(changed, options, userId);
      this.zIndex = 0;
      this.mesh.zIndex = 0;
      if ("y" in changed || "x" in changed) {
        const currentRegions = Array.from(this.document.regions).map(region => region);
        const currentRegion = currentRegions[0]?._id;
        this.document.setFlag(isometricModuleConfig.MODULE_ID, 'currentRegion', currentRegion);
      }
    }
  }
}