import { isometricModuleConfig } from './consts.js';
import { 
  comparePlaceablePosition,
  sortPlaceablePosition,
  isIsometricAutosortingEnabledForPlaceable
} from './utils.js';

export function isoDepthSortMixin(Base){  
  return class DepthSortPlaceable extends Base{
    _refreshState() {
      super._refreshState();
      if (this !== null && this.document.documentName === "Tile"){
        const isTileSortable = this.document.flags[isometricModuleConfig.MODULE_ID]?.isoTileAutoSortingEnabled || false;
        if (isTileSortable){ 
          this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS; 
        } else { 
          this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TILES; 
        }
        // console.log("exs87FIUnqNJYNEI", this.document.flags)
      }

      this.zIndex = 0;
      this.mesh.zIndex = 0;

      if (this.document.documentName === "Token"){
        const currentRegions = Array.from(this.document.regions).map(region => region);
        const regionList =[]
        currentRegions.map(region => {
          regionList.push(region._id);
        })
        this.document.setFlag(isometricModuleConfig.MODULE_ID, 'hasRegion', regionList);
        sortPlaceablePosition(this)
      } else {
        sortPlaceablePosition(this);
      }
    }
    _onUpdate(changed, options, userId) {
      super._onUpdate(changed, options, userId);

      let currentOccupiedRegion = null;

      if (this.document.documentName === "Token"){
        const currentRegions = Array.from(this.document.regions).map(region => region);
        if ("y" in changed) {
          const regionList =[]
          currentRegions.map(region => {
            regionList.push(region._id);
          })
          this.document.setFlag(isometricModuleConfig.MODULE_ID, 'hasRegion', regionList);
          sortPlaceablePosition(this)
        }
      } else {
        sortPlaceablePosition(this);
      }
    }
  }
}


/**
 * Waits for a token's movement animation to complete.
 * @param {TokenDocument} document 
 */
async function awaitTokenAnimation(document) {
  const token = document.object;
  if (!token) return;
  // wait for the token movement to end
  const movementAnim = token.animation || token.movementAnimationPromise;
  if (movementAnim) {
    try { await movementAnim; } catch (e) { /* Ignore interruptions */ }
  }
  // extra check if the token is moving on another level or between levels.
  if (token.levelIndicator?.animation) {
    try { await token.levelIndicator.animation; } catch (e) { }
  }
}