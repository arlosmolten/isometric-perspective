import { isometricModuleConfig } from './consts.js';
import { comparePlaceablePosition} from './utils.js';

export function registerSortingConfig() {
  const isometricWorldEnabled = game.settings.get(isometricModuleConfig.MODULE_ID, "worldIsometricFlag");
  const enableAutoSorting = game.settings.get(isometricModuleConfig.MODULE_ID, "enableAutoSorting");
  if (!isometricWorldEnabled || !enableAutoSorting) return;
  if (game.version.startsWith("11")) return; //There isn't a sort method on v11. Needs another way to sort.

  Hooks.on('createToken', async (tokenDocument, options, userId) => {
    const scene = tokenDocument.parent;
    if (!scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled")) return;
    
    // If the movement is from the current user
    if (userId === game.userId) {
      const token = canvas.tokens.get(tokenDocument.id);
      if (token) updateTokenSort(token);
    }
  });

  Hooks.on('updateToken', async (tokenDocument, change, options, userId) => {
    const scene = tokenDocument.parent;
    if (!scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled")) return;
    // Check if there has been a change in position
    if ((change.x !== undefined || change.y !== undefined) && userId === game.userId) {
      const token = canvas.tokens.get(tokenDocument.id);
      if (token) await updateTokenSort(token); // might require more than just tokens 
    }

  });

  Hooks.on("canvasReady", (canvas) => {
    const scene = canvas.scene;
    if (!scene) return;
    if (!scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled")) return;
    
    const tokens = scene.tokens;
    const updates = tokens.map(tokenDocument => {
      const token = canvas.tokens.get(tokenDocument.id);
      if (!token) return null;

      const newSort = comparePlaceablePosition(token);

      return {
        _id: tokenDocument.id,
        sort: newSort
      };
    }).filter(update => update !== null);

    if (updates.length > 0) {
      // comparePlaceablePosition(token, scene);
      scene.updateEmbeddedDocuments('Token', updates);
    }
  });

}

async function updateTokenSort(token) {

  //scene safety check
  const scene = token.scene || token.document.parent || canvas.scene;
  if (!scene) return;
  if (!token.document.isOwner) return;
  //safety check if the token has been deleted during movement
  await awaitTokenAnimation(token.document);
  if (!scene.tokens.has(token.document.id)) return;  
  // sort by grid Y 
  const newSort = comparePlaceablePosition(token);
  const update = {
    _id: token.document.id,
    sort: newSort
  };
  await scene.updateEmbeddedDocuments('Token', [update]);
}

/*
// Adiciona um comando de macro para reordenar os tokens manualmente (opcional)
Hooks.on('getSceneControlButtons', (controls) => {
  const tokenControls = controls.find(c => c.name === 'token');
  
  tokenControls.tools.push({
    name: 'reorder-tokens',
    title: 'Reordenar Tokens',
    icon: 'fas fa-sort-amount-down',
    onClick: () => {
      // Se precisar reordenar todos os tokens, pode manter o código anterior
      const tokens = canvas.tokens.placeables;
      tokens.forEach(token => updateTokenSort(token));
    },
    button: true
  });
});

// my old code, just for backup reasons
function calculateTokenSortValue(token) {
  const scene = game.scenes.active;
  if (!scene) return token.sort;

  // Gets the dimensions of the canvas
  const { width, height } = scene;

  // Calculates the sort value using the X+Y method. Those are all methods to prioritize each corner (but the only who matter to isometric is south).
  return Math.floor((width - token.x) + token.y);                // South
  //return Math.floor(token.x + (height - token.y));             // North
  //return Math.floor(token.x + token.y);                        // East
  //return Math.floor((width - token.x) + (height - token.y));   // West
}
*/

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
