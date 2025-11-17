import { isometricModuleConfig } from './consts.js';

export function registerDynamicTileConfig() {
  const enableOcclusionDynamicTile = game.settings.get(isometricModuleConfig.MODULE_ID, "enableOcclusionDynamicTile");
  const worldIsometricFlag = game.settings.get(isometricModuleConfig.MODULE_ID, "worldIsometricFlag");
  
  if (!worldIsometricFlag || !enableOcclusionDynamicTile) return;
  
  // ---------------------- CANVAS ----------------------
  Hooks.on('canvasInit', () => {
    // Remove any existing container if it exists
    if (alwaysVisibleContainer) {
      canvas.stage.removeChild(alwaysVisibleContainer);
      alwaysVisibleContainer.destroy({ children: true });
    }
    
    // Cria o container principal
    alwaysVisibleContainer = new PIXI.Container();
    alwaysVisibleContainer.name = "AlwaysVisibleContainer";
    alwaysVisibleContainer.eventMode = 'passive';
    
    // Cria subcamadas separadas para tiles e tokens
    tilesLayer = new PIXI.Container();
    tokensLayer = new PIXI.Container();
    
    tilesLayer.name = "AlwaysVisibleTiles";
    tokensLayer.name = "AlwaysVisibleTokens";
    
    // Adiciona as camadas na ordem correta
    alwaysVisibleContainer.addChild(tilesLayer);
    alwaysVisibleContainer.addChild(tokensLayer);
    
    canvas.stage.addChild(alwaysVisibleContainer);
    canvas.stage.sortChildren();
  });
  // Add a hook to reset the container when scene changes
  Hooks.on('changeScene', () => {
    if (alwaysVisibleContainer) {
      // Remove the container from the stage
      canvas.stage.removeChild(alwaysVisibleContainer);
      
      // Destroy the container and its children
      alwaysVisibleContainer.destroy({ children: true });
      
      // Reset references
      alwaysVisibleContainer = null;
      tilesLayer = null;
      tokensLayer = null;
    }
  });
  Hooks.on('canvasReady', () => {
    updateAlwaysVisibleElements();
  });
  Hooks.on('canvasTokensRefresh', () => {
    updateAlwaysVisibleElements();
  });
  Hooks.on('updateUser', (user, changes) => {
    if (user.id === game.user.id && 'character' in changes) {
      updateAlwaysVisibleElements();
    }
  });



  // ---------------------- TILE ----------------------
  Hooks.on('createTile', (tile, data, options, userId) => {
    tile.setFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds', []); // Changed to array
  });
  Hooks.on('updateTile', async (tileDocument, change, options, userId) => {
    if ('flags' in change && isometricModuleConfig.MODULE_ID in change.flags) {
      const currentFlags = change.flags[isometricModuleConfig.MODULE_ID];
      if ('linkedWallIds' in currentFlags) {
        const validArray = ensureWallIdsArray(currentFlags.linkedWallIds);
        await tileDocument.setFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds', validArray);
      }
    }
    updateAlwaysVisibleElements();
  });
  Hooks.on('refreshTile', (tile) => {
    updateAlwaysVisibleElements();
  });
  Hooks.on('deleteTile', (tile, options, userId) => {
    updateAlwaysVisibleElements();
  });



  // ---------------------- TOKEN ----------------------
  Hooks.on('createToken', (token, options, userId) => {
    // Adiciona um pequeno atraso para garantir que o token esteja completamente inicializado
    setTimeout(() => {
      updateAlwaysVisibleElements();
    }, 100);
  });
  Hooks.on('controlToken', (token, controlled) => {
    if (controlled) {
      lastControlledToken = token; // Store the last controlled token
    }
    updateAlwaysVisibleElements();
  });
  Hooks.on('updateToken', (tokenDocument, change, options, userId) => {
    // Se o token atualizado for o último controlado, atualize a referência
    if (lastControlledToken && tokenDocument.id === lastControlledToken.id) {
      lastControlledToken = canvas.tokens.get(tokenDocument.id);
    }
    updateAlwaysVisibleElements();
  });
  Hooks.on('deleteToken', (token, options, userId) => {
    if (lastControlledToken && token.id === lastControlledToken.id) {
      lastControlledToken = null;
    }
    updateAlwaysVisibleElements();
  });
  Hooks.on("refreshToken", (token) => {
    updateAlwaysVisibleElements();
  });
  /*
  Hooks.on('renderTokenConfig', (app, html, data) => {
    // hide all tokens
    updateTokensOpacity(0);

    // Handler for the submit form
    html.querySelector('form').on('submit', async (event) => {
      updateTokensOpacity(1);
    });
  });
  */



  // ---------------------- OTHERS ----------------------
  Hooks.on('sightRefresh', () => {
    if (canvas.ready && alwaysVisibleContainer) {
      updateAlwaysVisibleElements();
    }
  });

  Hooks.on('updateWall', (wallDocument, change, options, userId) => {
    // Verifica se a mudança é relacionada ao estado da porta
    if ('ds' in change) {
      // Procura por tiles que têm esta wall vinculada
      const linkedTiles = canvas.tiles.placeables.filter(tile => {
        const walls = getLinkedWalls(tile);
        return walls.some(wall => wall && wall.id === wallDocument.id);
      });
      
      // Se encontrou algum tile vinculado, atualiza os elementos visíveis
      if (linkedTiles.length > 0) {
        updateAlwaysVisibleElements();
      }
    }
  });

  // Additional buttons for the tile layer
  Hooks.on("getSceneControlButtons", (controls) => {
    const newButtons = controls.find(b => b.name === "tiles"); // "token, measure, tiles, drawings, walls, lightning"
  
    newButtons.tools.push({
      name: 'dynamic-tile-increase',
      title: 'Increase Dynamic Tile Opacity',
      icon: 'fa-solid fa-layer-group',
      active: true,
      onClick: () => increaseTilesOpacity(),
      button: true
    },{
      name: 'dynamic-tile-decrease',
      title: 'Decrease Dynamic Tile Opacity',
      icon: 'fa-duotone fa-solid fa-layer-group',
      active: true,
      onClick: () => decreaseTilesOpacity(),
      button: true
    });
  });
}



// Container PIXI para elementos sempre visíveis
let alwaysVisibleContainer;
let tilesLayer;
let tokensLayer;
let tilesOpacity = 1.0;
let tokensOpacity = 1.0;
let selectedWallIds = []; // Changed to array
let lastControlledToken = null;


function updateLayerOpacity(layer, opacity) {
  if (!layer) return;
  layer.children.forEach(sprite => {
      sprite.alpha = opacity;
  });
}

export function updateTilesOpacity(value) {
  tilesOpacity = Math.max(0, Math.min(1, value));
  if (tilesLayer) {
    updateLayerOpacity(tilesLayer, tilesOpacity);
  }
}

export function increaseTilesOpacity() {
  updateTilesOpacity(tilesOpacity + 0.5);
}

export function decreaseTilesOpacity() {
  updateTilesOpacity(tilesOpacity - 0.5);
}

export function resetOpacity() {
  tilesOpacity = 1.0;
  updateTilesOpacity(tilesOpacity);

  //tokensOpacity = 1.0;
  //updateTokensOpacity(tokensOpacity);
}


export function updateTokensOpacity(value) {
  tokensOpacity = Math.max(0, Math.min(1, value));
  if (tokensLayer) {
      updateLayerOpacity(tokensLayer, tokensOpacity);
  }
}

export function increaseTokensOpacity() {
  updateTokensOpacity(tokensOpacity + 0.1);
}

export function decreaseTokensOpacity() {
  updateTokensOpacity(tokensOpacity - 0.1);
}













function cloneTileSprite(tile, walls) {
  const sprite = new PIXI.Sprite(tile.texture);
  sprite.position.set(tile.position.x, tile.position.y);
  sprite.anchor.set(tile.anchor.x, tile.anchor.y);
  sprite.angle = tile.angle;
  sprite.scale.set(tile.scale.x, tile.scale.y);
  
  // Check if any linked wall is a closed door
  const hasClosedDoor = walls.some(wall => 
    wall && (wall.document.door === 1 || wall.document.door === 2) && wall.document.ds === 1
  );
  
  if (hasClosedDoor) {
    return null; // Doesn't create the sprite if the door is open
  }
  
  let alpha = tile.alpha * tilesOpacity;
  sprite.alpha = alpha;
  sprite.eventMode = 'passive';
  sprite.originalTile = tile;
  return sprite;
}

function cloneTokenSprite(token) {
  if (!token || !token.texture) {
    if (isometricModuleConfig.DEBUG_PRINT) { console.warn("Dynamic Tile cloneTokenSprite() common error.") }
    return null;
  }
  try {
    const sprite = new PIXI.Sprite(token.texture);
    sprite.position.set(token.position.x, token.position.y);
    sprite.anchor.set(token.anchor.x, token.anchor.y);
    sprite.angle = token.angle;
    sprite.scale.set(token.scale.x, token.scale.y);
    sprite.alpha = token.alpha * tokensOpacity;
    sprite.eventMode = 'passive';
    sprite.originalToken = token;

    // // Clone filters if they exist
    // if (token.filters && token.filters.length > 0) {
    //   sprite.filters = token.filters.map(filter => {
    //     const newFilter = new filter.constructor(filter.uniforms);
    //     Object.assign(newFilter, filter);
    //     return newFilter;
    //   });
    // }

    return sprite;
  } catch (error) {
    console.error("Erro ao clonar sprite do token:", error);
    return null;
  }
}

// Função para encontrar o token inicial na inicialização
function getInitialToken() {
  // Primeiro, tenta pegar o token controlado
  const controlled = canvas.tokens.controlled[0];
  if (controlled) return controlled;

  // Se não houver token controlado, tenta usar o último token conhecido
  if (lastControlledToken) return lastControlledToken;

  // Se não houver último token conhecido, tenta pegar o token do personagem do usuário
  const actor = game.user.character;
  if (actor) {
      const userToken = canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
      if (userToken) return userToken;
  }

  // Se ainda não encontrou, pega o primeiro token que o usuário possui permissão
  const availableToken = canvas.tokens.placeables.find(t => t.observer);
  if (availableToken) return availableToken;

  // Se tudo falhar, retorna null
  return null;
}

function updateAlwaysVisibleElements() {
  if (!canvas.ready || !alwaysVisibleContainer) return;

  // Clear layers
  tilesLayer.removeChildren();
  tokensLayer.removeChildren();

  // Get the selected token
  const controlled = getInitialToken();
  if (!controlled) return;

  // Collect Tiles with linked walls
  const tilesWithLinkedWalls = canvas.tiles.placeables.filter(tile => {
    // Usa a função auxiliar para garantir que temos um array
    const walls = getLinkedWalls(tile);
    return walls.length > 0;
  });

  // Update tiles
  tilesWithLinkedWalls.forEach(tile => {
    const walls = getLinkedWalls(tile);
    
    // Check if token can see any of the linked walls
    const canSeeAnyWall = walls.some(wall => canTokenSeeWall(controlled, wall));

    if (canSeeAnyWall) {
      const clonedSprite = cloneTileSprite(tile.mesh, walls);
      if (clonedSprite) {
        tilesLayer.addChild(clonedSprite);
      }
    }
  });

  
  
  // Always add the controlled token
  const controlledTokenSprite = cloneTokenSprite(controlled.mesh);
  if (controlledTokenSprite) {  // Check if Sprite was created successfully
    tokensLayer.addChild(controlledTokenSprite);
  }

  // Add tokens that the controlled token can see
  canvas.tokens.placeables.forEach(token => {
    if (!token.mesh) return;  // Skip if the mesh does not exist
    if (token.id === controlled.id) return; // Skip the controlled token

    // Check if the token can be seen
    if (canTokenSeeToken(controlled, token)) {
      // Check if the token is behind some tile linked to a wall
      const behindTiles = tilesWithLinkedWalls.filter(tile => {
        const walls = getLinkedWalls(tile);

        // Check if token is behind any of the linked walls
        return walls.some(wall => {
          if (!wall) return false;

          // If the wall is a door and is open, do not consider token as "behind"
          if ((wall.document.door === 1 || wall.document.door === 2) && wall.document.ds === 1) {
            return false;
          }

          // Check if the token is above the wall
          return isTokenInFrontOfWall(token, wall);
        });
      });

      const tokenSprite = cloneTokenSprite(token.mesh);
      if (tokenSprite) {
        if (behindTiles.length > 0) {
          tokenSprite.zIndex = -1; // Rendering behind, if behind any tile
        }
        tokensLayer.addChild(tokenSprite);
      }
    }
  });

  updateLayerOpacity(tilesLayer, tilesOpacity);
  //updateLayerOpacity(tokensLayer, tokensOpacity);

  // Habilita o zIndex para a camada de tokens
  tokensLayer.sortableChildren = true;
}

function ensureWallIdsArray(linkedWallIds) {
  // Se for undefined ou null, retorna array vazio
  if (!linkedWallIds) return [];

  // Se já for um array, retorna ele mesmo
  if (Array.isArray(linkedWallIds)) return linkedWallIds;

  // Se for uma string
  if (typeof linkedWallIds === 'string') {
    // Se for uma string vazia ou só com espaços, retorna array vazio
    if (!linkedWallIds.trim()) return [];
    // Divide a string por vírgulas e limpa os espaços
    return linkedWallIds.split(',').map(id => id.trim()).filter(id => id);
  }

  // Se for um objeto
  if (typeof linkedWallIds === 'object') {
    try {
      // Tenta converter para string e depois para array
      return JSON.stringify(linkedWallIds)
        .replace(/[{}\[\]"]/g, '')
        .split(',')
        .map(id => id.trim())
        .filter(id => id);
    } catch {
      return [];
    }
  }

  // Se não for nenhum dos casos acima, retorna array vazio
  return [];
}

// Função para obter walls linkadas a um tile de forma segura
function getLinkedWalls(tile) {
  if (!tile || !tile.document) return [];
  const linkedWallIds = ensureWallIdsArray(tile.document.getFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds'));
  return linkedWallIds.map(id => canvas.walls.get(id)).filter(Boolean);
}

// Função auxiliar para verificar e corrigir flags existentes
async function validateAndFixTileFlags(tile) {
  const currentLinkedWalls = tile.getFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds');
  const validArray = ensureWallIdsArray(currentLinkedWalls);
  
  // Se o valor atual for diferente do array válido, atualiza
  if (JSON.stringify(currentLinkedWalls) !== JSON.stringify(validArray)) {
    await tile.setFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds', validArray);
  }
  return validArray;
}











// Funções auxiliares para os calculos de posição


/**

  --- Regras para determinar visibilidade, partindo de um ponto de vista 2D (top-down) ---

- Se a parede estiver na horizontal: Qualquer ponto que o token estiver abaixo da linha horizontal é
considerado que ele esteja em frente a parede. Senão ele está atrás da parede.

- Se a parede estiver na vertical: Qualquer ponto que o token estiver à esquerda da linha vertical que
a parede faz, ele é considerado estar em frente a parede. Senão ele está atrás da parede.

- Se a parede estiver inclinada com o sentido desta barra / e o angulo que ela faz com uma reta
horizontal é menor que 45º: Trace uma linha infinita entre os dois pontos que formam a parede.
Faça a diferença entre o ponto Y do token e o ponto y da linha sob o mesmo valor de X. Se essa
diferença for positiva, o token está em frente a parede, senão ele está atrás da parede.

- Se a parede estiver inclinada com o sentido desta barra \ e o angulo que ela faz com uma reta
horizontal é menor que 45º: Trace uma linha infinita entre os dois pontos que formam a parede.
Faça a diferença entre o ponto Y do token e o ponto y da linha sob o mesmo valor de X. Se essa
diferença for positiva, o token está em frente a parede, senão ele está atrás da parede.

- Se a parede estiver inclinada com o sentido desta barra / e o angulo que ela faz com uma reta
horizontal é maior que 45º: Trace uma linha infinita entre os dois pontos que formam a parede.
Faça a diferença entre o ponto Y do token e o ponto y da linha sob o mesmo valor de X. Se essa
diferença for positiva, o token está atrás da parede, senão ele está na frente da parede.

- Se a parede estiver inclinada com o sentido desta barra \ e o angulo que ela faz com uma reta
horizontal é maior que 45º: Trace uma linha infinita entre os dois pontos que formam a parede.
Faça a diferença entre o ponto Y do token e o ponto y da linha sob o mesmo valor de X. Se essa
diferença for positiva, o token está em frente a parede, senão ele está atrás da parede.
 
*/

/**
 * Calcula o ângulo em graus entre uma linha e a horizontal
 * @param {number} x1 - Coordenada X do primeiro ponto
 * @param {number} y1 - Coordenada Y do primeiro ponto
 * @param {number} x2 - Coordenada X do segundo ponto
 * @param {number} y2 - Coordenada Y do segundo ponto
 * @returns {number} - Ângulo em graus (0-360)
 */
function calculateAngle(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);
  return angle;
}



/**
* Determina se a parede está inclinada no sentido / ou \
* @param {number} x1 - Coordenada X do primeiro ponto
* @param {number} y1 - Coordenada Y do primeiro ponto
* @param {number} x2 - Coordenada X do segundo ponto
* @param {number} y2 - Coordenada Y do segundo ponto
* @returns {string} - 'forward' para / ou 'backward' para \
*/
function getWallDirection(x1, y1, x2, y2) {
  // Se y2 for menor que y1 quando x2 é maior que x1, é uma parede '/'
  // Caso contrário, é uma parede '\'
  if (x2 > x1) {
    return y2 < y1 ? 'forward' : 'backward';
  } else {
    return y2 > y1 ? 'forward' : 'backward';
  }
}



/**
* Verifica se um token está em frente a uma parede baseado nas regras especificadas
* @param {Object} token - Objeto token com propriedade center {x, y}
* @param {Object} wall - Objeto wall com propriedades edge.a {x, y} e edge.b {x, y}
* @returns {boolean} - true se o token estiver em frente à parede, false caso contrário
*/
function isTokenInFrontOfWall(token, wall) {
  if (isometricModuleConfig.FOUNDRY_VERSION === 11) {
    if (!wall?.A || !wall?.B || !token?.center) return false;
  } else {
    if (!wall?.edge?.a || !wall?.edge?.b || !token?.center) return false;
  }

  const { x: x1, y: y1 } = isometricModuleConfig.FOUNDRY_VERSION === 11 ? wall.A : wall.edge.a;
  const { x: x2, y: y2 } = isometricModuleConfig.FOUNDRY_VERSION === 11 ? wall.B : wall.edge.b;
  const { x: tokenX, y: tokenY } = token.center;

  // Verifica se a parede é horizontal (ângulo próximo a 0°)
  // Token está em frente se estiver abaixo da linha horizontal
  if (Math.abs(y1 - y2) < 0.001) {
    return tokenY > y1;
  }

  // Verifica se a parede é vertical (ângulo próximo a 90°)
  // Token está em frente se estiver à esquerda da linha vertical
  if (Math.abs(x1 - x2) < 0.001) {
    return tokenX < x1;
  }

  // Calcula o ângulo da parede com a horizontal
  const angle = calculateAngle(x1, y1, x2, y2);
  
  // Determina a direção da inclinação da parede (/ ou \)
  const wallDirection = getWallDirection(x1, y1, x2, y2);

  // Calcula a posição Y na linha da parede para o X do token
  const slope = (y2 - y1) / (x2 - x1);
  const wallYAtTokenX = slope * (tokenX - x1) + y1;
  const difference = tokenY - wallYAtTokenX;

  if (wallDirection === 'forward') { // Parede tipo /
    if (angle < 45) {
      return difference > 0; // Token está em frente se estiver acima da linha
    } else {
      return difference < 0; // Token está em frente se estiver abaixo da linha
    }
  } else { // Parede tipo \
    if (angle < 45) {
      return difference > 0; // Token está em frente se estiver acima da linha
    } else {
      return difference > 0; // Token está em frente se estiver acima da linha
    }
  }
}



/**
* Verifica se um token pode ver uma parede
* @param {Object} token - Objeto token
* @param {Object} wall - Objeto wall
* @returns {boolean} - true se o token puder ver a parede, false caso contrário
*/
function canTokenSeeWall(token, wall) {
  if (!wall || !token) return false;

  // Verifica se o token está em frente à parede
  const isInFront = isTokenInFrontOfWall(token, wall);
  if (!isInFront) return false;

  // Verifica colisão com outros objetos entre o token e os pontos da parede
  const wallPoints = isometricModuleConfig.FOUNDRY_VERSION === 11 ? [wall.A, wall.center, wall.B] : [wall.edge.a, wall.center, wall.edge.b];
  const tokenPosition = token.center;

  for (const point of wallPoints) {
    const visibilityTest = isometricModuleConfig.FOUNDRY_VERSION === 11 ? canvas.effects.visibility.testVisibility(point, { tolerance: 2 }) : canvas.visibility?.testVisibility(point, { tolerance: 2 });
    // Usa o testVisibility do token para verificar se ele pode ver o ponto
    if (visibilityTest) {
      const ray = new Ray(tokenPosition, point);
      const collision = CONFIG.Canvas.polygonBackends.sight.testCollision(ray.B, ray.A, { 
        mode: "any", 
        type: "sight" 
      });
      
      // Se não houver colisão com algum ponto dentro do alcance, o token pode ver a parede
      if (!collision) {
        return true
      }
    }
  }

  return false;
}

function canTokenSeeToken(sourceToken, targetToken) {
  if (!sourceToken || !targetToken) return false;
  
  // Usa o canvas testVisibility no token alvo como verificação
  return canvas.visibility?.testVisibility(targetToken.center, { tolerance: 2 });
}