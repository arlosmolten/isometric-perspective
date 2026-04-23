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

  // Give Foundry a tick to utilize animation properties
  await new Promise(r => setTimeout(r, 0));

  const anim = token.movementAnimationPromise || token.animation;
  if (anim) {
    try { await anim; } catch (e) { /* Ignore interruptions */ }
  } else {
    // Fallback: Check foundry.canvas.animation.CanvasAnimation
    if (foundry.canvas.animation.CanvasAnimation && foundry.canvas.animation.CanvasAnimation.animations) {
      const animations = foundry.canvas.animation.CanvasAnimation.animations;
      // foundry.canvas.animation.CanvasAnimation.animations can be an Object or Map depending on Foundry version
      const entries = (animations instanceof Map) ? animations.entries() : Object.entries(animations);

      for (const [key, promiseData] of entries) {
        if (key.includes(document.id)) {
          // promiseData might be the promise itself or an object containing the promise
          const promise = promiseData.promise || promiseData;
          if (promise) {
            try { await promise; } catch (e) { }
          }
        }
      }
    }
  }
}