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
      if (this.document.documentName === "Tile"){
        const isTileSortable = this.document.flags[isometricModuleConfig.MODULE_ID]?.isoTileAutoSortingEnabled || false;
        if (isTileSortable){ this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS; 
        } else { this.mesh.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TILES; }
      }
      this.zIndex = 0;
      this.mesh.zIndex = 0;
      // this.zIndex = this.isPreview ? 3 : this.controlled ? 2 : this.hover ? 1 : 0;
      sortPlaceablePosition(this);
    }
    _onUpdate(changed, options, userId) {
      super._onUpdate(changed, options, userId);

      if (this.document.documentName === "Token"){
        // const currentRegions = this.document.regions;
        if ("_regions" in changed) {
          const priorRegions = options._priorRegions?.[this.document.id]?.map(id => this.document.parent.regions.get(id));
          const currentRegions = this.document.regions;
          const newlyEnteredRegions = currentRegions.filter(region => !priorRegions.includes(region));
          const currentRegionEnd = Array.from(newlyEnteredRegions).map(region => region);
          console.log("current region? : " , currentRegionEnd[0]?.name, console.log("changed?",changed))
        }
      }
      // prevent sorting when the y coordinates of a placeable didnt change ( thanks Michael for the tip! )
      if ("y" in changed) {
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