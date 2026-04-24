import { isometricModuleConfig } from './consts.js';
import { 
  comparePlaceablePosition,
  isIsometricAutosortingEnabledForPlaceable
} from './utils.js';

export function isoDepthSortMixin(Base){  
  return class DepthSortPlaceable extends Base{
    _refreshState() {
      super._refreshState();
      const sortableType = this.name.split(".").shift();
      const newSort = comparePlaceablePosition(this);
      if(sortableType === "Token"){
        async () => await awaitTokenAnimation(this.document);
        this.sort = newSort;
        this.mesh.sort = newSort;
      } else {
        this.sort = newSort;
        this.mesh.sort = newSort;
      }
    }
  }
}

export async function isoDepthSort(placeable,scene,label){   
    await awaitTokenAnimation(placeable.document); 
    const newSort = comparePlaceablePosition(placeable);
    placeable.sort = newSort;
    placeable.mesh.sort = newSort;
    console.log("SORTING?", placeable.sort, placeable.mesh.sort);
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