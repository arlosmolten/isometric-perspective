import { isometricModuleConfig } from './consts.js';
import { 
  comparePlaceablePosition,
  isIsometricAutosortingEnabledForPlaceable
} from './utils.js';

export async function isoDepthSortReady(){
  const scene = canvas.scene;
  if (!scene ||!canvas.ready) return;
  const tokens = scene.tokens;
  const updates = tokens.map(tokenDocument => {
    const token = tokenDocument.object;
    const updateList =[];

    if (token !== null){
      if(isIsometricAutosortingEnabledForPlaceable(token,scene)){
        const newSort = comparePlaceablePosition(token);
        if (tokenDocument.sort!== newSort) {
          updateList.push({
            _id: token.id,
            sort: newSort
          });
        }
      }
    }
    return updateList
  })
  const validUpdates = updates.filter(update => update._id && update._id!== "");
  if (updates.length > 0) {
    await scene.updateEmbeddedDocuments('Token', validUpdates);
  }
}

export async function isoDepthSort(placeable,scene,label){   
    await awaitTokenAnimation(placeable.document); 
    const newSort = comparePlaceablePosition(placeable);
    const update = {
      _id: placeable.document.id,
      sort: newSort
    };
    await scene.updateEmbeddedDocuments(label, [update]); 
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