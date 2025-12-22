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
    if ((change.x !== undefined || change.y !== undefined) && userId === game.userId) {
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

  // Wait for the movement animation to complete
  const anim = CanvasAnimation.getAnimation(token.animationName);
  if(anim?.promise) await anim.promise;
  
  // Calculates the new sort value for the token
  const newSort = calculateTokenSortValue(token);
  
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
