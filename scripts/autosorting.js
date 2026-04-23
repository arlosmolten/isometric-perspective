import { isometricModuleConfig } from './consts.js';
import { 
  comparePlaceablePosition,
  isIsometricAutosortingEnabledForPlaceable
} from './utils.js';

export async function isoDepthSortReady(){
  const scene = canvas.scene;
  const tokens = scene.tokens;
  const updates = tokens.map(tokenDocument => {
    const token = canvas.tokens.get(tokenDocument.id);
      if(isIsometricAutosortingEnabledForPlaceable(token)){
        if (!token) return null;
        const newSort = comparePlaceablePosition(token);
        return {
          _id: tokenDocument.id,
          sort: newSort
        };
      }
    }).filter(update => update !== null);
  
    if (updates.length > 0) {
      scene.updateEmbeddedDocuments('Token', updates);
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
    // Fallback: Check CanvasAnimation
    if (CanvasAnimation && CanvasAnimation.animations) {
      const animations = CanvasAnimation.animations;
      // CanvasAnimation.animations can be an Object or Map depending on Foundry version
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