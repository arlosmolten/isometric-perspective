import { isometricModuleConfig } from './consts.js';
import { calculateTokenSortValue } from './utils.js';

export function registerSortingConfig() {
  const isometricWorldEnabled = game.settings.get(isometricModuleConfig.MODULE_ID, "worldIsometricFlag");
  const enableAutoSorting = game.settings.get(isometricModuleConfig.MODULE_ID, "enableAutoSorting");
  if (!isometricWorldEnabled || !enableAutoSorting) return;
  if (game.version.startsWith("11")) return; //There isn't a sort method on v11. Needs another way to sort.

  Hooks.on('createToken', async (tokenDocument, options, userId) => {
    // If the movement is from the current user
    if (userId === game.userId) {
      const token = canvas.tokens.get(tokenDocument.id);
      if (token) updateTokenSort(token);
    }
  });

  Hooks.on('updateToken', async (tokenDocument, change, options, userId) => {
    // Check if there has been a change in position
    if (change.x !== undefined || change.y !== undefined) {
      const token = canvas.tokens.get(tokenDocument.id);
      if (token) await updateTokenSort(token);
    }
  });

  Hooks.on("canvasReady", (canvas) => {
    const scene = game.scenes.active;
    if (!scene) return;

    const tokens = scene.tokens;
    const updates = tokens.map(tokenDocument => {
      const token = canvas.tokens.get(tokenDocument.id);
      if (!token) return null;

      const newSort = calculateTokenSortValue(token);
    
      return {
        _id: tokenDocument.id,
        sort: newSort
      };
    }).filter(update => update !== null);

    if (updates.length > 0) {
      scene.updateEmbeddedDocuments('Token', updates);
    }
  });

}


async function updateTokenSort(token) {
  const scene = game.scenes.active;
  if (!scene) return;

  // Wait for the movement animation to complete using robust helper
  await awaitTokenAnimation(token.document);
  
  // Calculates the new sort value for the token
  const newSort = calculateTokenSortValue(token);

  if (game.settings.get(isometricModuleConfig.MODULE_ID, "debug")) {
    const others = canvas.tokens.placeables.filter(t => t.id !== token.id);
    console.group(`Autosorting Debug: ${token.name} (${token.id})`);
    console.log(`Pos: (${token.document.x}, ${token.document.y}) -> Calculated Sort: ${newSort}`);
    
    // Sort others by Visual Y to see expected order
    const sortedOthers = others.map(t => {
       const doc = t.document;
       // Duplicate logic just for debug print or export calculateVisualY from utils if possible
       // For now, re-using calculateTokenSortValue gives integer sort, which is proxy for VisualY
       return { name: t.name, sort: calculateTokenSortValue(t), currentSort: t.document.sort };
    }).sort((a,b) => b.sort - a.sort); // Highest sort first

    console.table(sortedOthers);
    
    // Check if we are correctly placed
    const potentiallyOccluded = sortedOthers.filter(t => t.sort > newSort);
    const potentiallyOccluding = sortedOthers.filter(t => t.sort < newSort);
    
    console.log(`Should be BEHIND (Higher Sort):`, potentiallyOccluded.map(t => `${t.name} (${t.id})`));
    console.log(`Should be IN FRONT OF (Lower Sort):`, potentiallyOccluding.map(t => `${t.name} (${t.id})`));
    console.groupEnd();
  }
  
  // Creates a refresh object for the token
  const update = {
    _id: token.document.id,
    sort: newSort
  };
  
  // Updates token in scene
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
                      try { await promise; } catch (e) {}
                  }
              }
          }
      }
  }
}
