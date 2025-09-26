import { MODULE_ID, DEBUG_PRINT, FOUNDRY_VERSION } from './main.js';
import { cartesianToIso } from './utils.js';
import { ISOMETRIC_CONST } from './consts.js';


// Função principal que muda o canvas da cena
export function applyIsometricPerspective(scene, isSceneIsometric) {
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  //const isoAngle = ISOMETRIC_TRUE_ROTATION;
  //const scale = scene.getFlag(MODULE_ID, "isometricScale") ?? 1;
  
  if (isometricWorldEnabled && isSceneIsometric) {
    canvas.app.stage.rotation = ISOMETRIC_CONST.rotation;
    canvas.app.stage.skew.set(
      ISOMETRIC_CONST.skewX,
      ISOMETRIC_CONST.skewY
    );
    adjustAllTokensAndTilesForIsometric();
  } else {
    canvas.app.stage.rotation = 0;
    canvas.app.stage.skew.set(0, 0);
  }
}



// Função auxiliar que chama a função de transformação isométrica em todos os tokens e tiles da cena
/*export function adjustAllTokensAndTilesForIsometric() {
  canvas.tokens.placeables.forEach(token => applyIsometricTransformation(token, true));
  canvas.tiles.placeables.forEach(tile => applyIsometricTransformation(tile, true));
}*/
// Batch process to speed up this function
export function adjustAllTokensAndTilesForIsometric() {
  const tokensAndTiles = [...canvas.tokens.placeables, ...canvas.tiles.placeables];
  tokensAndTiles.forEach(obj => applyIsometricTransformation(obj, true));
}






// Função que aplica a transformação isométrica para um token ou tile -------------------------------------------------
export function applyIsometricTransformation(object, isSceneIsometric) {
  // Don't make any transformation if the isometric module isn't active
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  if (!isometricWorldEnabled) return

  // Don't make any transformation if there isn't any mesh
  if (!object.mesh) {
    if (DEBUG_PRINT) {console.warn("Mesh not found:", object)}
    return;
  }
  
  // Disable isometric token projection, if the flag is active
  let isoTileDisabled = object.document.getFlag(MODULE_ID, 'isoTileDisabled') ?? 0;
  let isoTokenDisabled = object.document.getFlag(MODULE_ID, 'isoTokenDisabled') ?? 0;
  if (isoTileDisabled || isoTokenDisabled) {
    object.mesh.anchor.set(0.5, 0.5);  // This is set to make isometric anchor don't mess with non-iso scenes
    return
  }

  
  // Don't make transformation on the token or tile if the scene isn't isometric
  if (!isSceneIsometric) {
    //object.mesh.rotation = 0;
    //object.mesh.skew.set(0, 0);
    //object.mesh.scale.set(objTxtRatio, objTxtRatio);
    //object.mesh.position.set(object.document.x, object.document.y);
    //object.document.texture.fit = "contain"; //height
    object.mesh.anchor.set(0.5, 0.5);  // This is set to make isometric anchor don't mess with non-iso scenes
    return;
  }

  // It undoes rotation and deformation
  object.mesh.rotation = ISOMETRIC_CONST.reverseRotation;
  object.mesh.skew.set(ISOMETRIC_CONST.reverseSkewX, ISOMETRIC_CONST.reverseSkewY);
  //object.mesh.anchor.set(isoAnchorX, isoAnchorY);
    
  // recovers the object characteristics of the object (token/tile)
  let texture = object.texture;
  let originalWidth = texture.width;   // art width
  let originalHeight = texture.height; // art height
  let scaleX = object.document.width;  // scale for 2x2, 3x3 tokens
  let scaleY = object.document.height; // scale for 2x2, 3x3 tokens
  
  // if Disable Auto-Scale checkbox is set, don't auto-scale tokens
  let isoScaleDisabled = object.document.getFlag(MODULE_ID, "isoScaleDisabled");
  if (isoScaleDisabled) scaleX = scaleY = 1;

  
  // elevation info
  let elevation = object.document.elevation;      // elevation from tokens and tiles
  let gridDistance = canvas.scene.grid.distance;  // size of one unit of the grid
  let gridSize = canvas.scene.grid.size;
  let isoScale = object.document.getFlag(MODULE_ID, 'scale') ?? 1;  // dynamic scale
  let offsetX = object.document.getFlag(MODULE_ID, 'offsetX') ?? 0; // art offset of object
  let offsetY = object.document.getFlag(MODULE_ID, 'offsetY') ?? 0; // art offset of object
  
  // if module settings flag is not set, don't move art token
  let ElevationAdjustment = game.settings.get(MODULE_ID, "enableHeightAdjustment");
  if (!ElevationAdjustment) elevation = 0;    
  
  
  
  
  
  if (object instanceof Token) {
    let sx = 1; // standard x
    let sy = 1; // standard y
    let objTxtRatio_W = object.texture.width / canvas.scene.grid.size;
    let objTxtRatio_H = object.texture.height / canvas.scene.grid.size;
    
    switch ( object.document.texture.fit ) {
      case "fill":
        sx = 1;
        sy = 1;
        break;
      case "contain":
        if (Math.max(objTxtRatio_W, objTxtRatio_H) ==  objTxtRatio_W){
          sx = 1
          sy = (objTxtRatio_H) / (objTxtRatio_W)
        }
        else{
          sx = (objTxtRatio_W) / (objTxtRatio_H)
          sy = 1
        }
        break;
      case "cover":
        if (Math.min(objTxtRatio_W, objTxtRatio_H) == objTxtRatio_W){
          sx = 1
          sy = (objTxtRatio_H) / (objTxtRatio_W)
        }
        else{
          sx = (objTxtRatio_W) / (objTxtRatio_H)
          sy = 1
        }
        break;
      case "width":
        sx = 1
        sy = (objTxtRatio_H) / (objTxtRatio_W)
        break;
      case "height":
        sx = (objTxtRatio_W) / (objTxtRatio_H)
        sy = 1
        break;
      default:
        // V11 Compatibility change
        if (FOUNDRY_VERSION === 11) {
          sx = (objTxtRatio_W) / (objTxtRatio_H);
          sy = 1;
          break;
        }
        //throw new Error(`Invalid fill type passed to ${this.constructor.name}#resize (fit=${fit}).`);
        console.warn("Invalid fill type passed to: ", object);
        sx = 1;
        sy = 1;
    }
    object.mesh.width  = Math.abs(sx * scaleX * gridSize * isoScale * Math.sqrt(2))
    object.mesh.height = Math.abs(sy * scaleY * gridSize * isoScale * Math.sqrt(2) * ISOMETRIC_CONST.ratio)
    
    // Elevation math
    offsetX += elevation * (1/gridDistance) * 100 * Math.sqrt(2) * (1/scaleX);
    offsetX *= gridSize / 100;   // grid ratio in comparison with default 100
    offsetY *= gridSize / 100;   // grid ratio in comparison with default 100
    
    // transformed distances
    const isoOffsets = cartesianToIso(offsetX, offsetY);
    
    // Create shadow and line graphics elements
    updateTokenVisuals(object, elevation, gridSize, gridDistance);

    // Position the token
    object.mesh.position.set(
      object.document.x + (scaleX * gridSize/2) + (scaleX * isoOffsets.x),
      object.document.y + (scaleX * gridSize/2) + (scaleX * isoOffsets.y)
    );
    // original code
    //object.mesh.position.set(
      //object.document.x + (isoOffsets.x * scaleX),
      //object.document.y + (isoOffsets.y * scaleY)
    //);
  }

  
  
  
  
  
  
  // If the object is a tile
  else if (object instanceof Tile) {
    //const sceneScale = canvas.scene.getFlag(MODULE_ID, "isometricScale") ?? 1;
    
    // Apply the scale by maintaining the proportion of the original art
    object.mesh.scale.set(
      (scaleX / originalWidth) * isoScale,
      (scaleY / originalHeight) * isoScale * ISOMETRIC_CONST.ratio
    );
    
    // Flip token horizontally, if the flag is active
    let scaleFlip = object.document.getFlag(MODULE_ID, 'tokenFlipped') ?? 0;
    if (scaleFlip) {
      let meshScaleX = object.mesh.scale.x;
      let meshScaleY = object.mesh.scale.y;
      object.mesh.scale.set(-meshScaleX, meshScaleY);
    }

    // Defines the manual offset to center the tile
    let isoOffsets = cartesianToIso(offsetX, offsetY);
    
    // Set tile's position
    object.mesh.position.set(
      object.document.x + (scaleX / 2) + isoOffsets.x,
      object.document.y + (scaleY / 2) + isoOffsets.y
    );
  }
  
}





// Função para transformar o background da cena
export function applyBackgroundTransformation(scene, isSceneIsometric, shouldTransform) {
  if (!canvas?.primary?.background) {
    if (DEBUG_PRINT) console.warn("Background not found.");
    return;
  }

  //const background = scene.stage.background; //don't work
  const background = canvas.environment.primary.background;
  const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
  const scale = scene.getFlag(MODULE_ID, "isometricScale") ?? 1;
  
  if (isometricWorldEnabled && isSceneIsometric && shouldTransform) {
    // Aplica rotação isométrica
    background.rotation = ISOMETRIC_CONST.reverseRotation;
    background.skew.set(
      ISOMETRIC_CONST.reverseSkewX,
      ISOMETRIC_CONST.reverseSkewY
    );
    background.anchor.set(0.5, 0.5);
    background.transform.scale.set(
      scale,
      scale * ISOMETRIC_CONST.ratio // Math.sqrt(3)
    );
    
    // Calculate scene dimensions and padding
    const isoScene = canvas.scene;
    const padding = isoScene.padding;
    const paddingX = isoScene.width * padding;
    const paddingY = isoScene.height * padding;
      
    // Account for background offset settings
    const offsetX = isoScene.background.offsetX || 0;
    const offsetY = isoScene.background.offsetY || 0;
    
    // Set position considering padding and offset
    background.position.set(
      (isoScene.width / 2) + paddingX + offsetX,
      (isoScene.height / 2) + paddingY + offsetY
    );
    
    // Handle foreground if it exists
    /*if (canvas.environment.primary.foreground) {
      const foreground = canvas.environment.primary.foreground;
      foreground.anchor.set(0.5, 0.5);
      foreground.transform.scale.set(1, 1);
      foreground.transform.setFromMatrix(canvas.stage.transform.worldTransform.invert());
      foreground.position.set(
        (s.width / 2) + paddingX + (s.foreground?.offsetX || 0),
        (s.height / 2) + paddingY + (s.foreground?.offsetY || 0)
      );
    }*/

  } else {
    // Reset transformações
    background.rotation = 0;
    background.skew.set(0, 0);
    //background.transform.scale.set(1, 1);
    //background.anchor.set(0.5, 0.5);
    //background.scale.set(1, 1);
    //background.transform.position.set(canvas.scene.width/2, canvas.scene.height/2);
    
    if (DEBUG_PRINT) console.log("applyBackgroundTransformation RESET")
  }
}








// ----------------- Elevation -----------------

// Manter registro de todos os containers visuais criados
const visualContainers = new Set();

// Função para limpar todos os visuais
export function clearAllVisuals() {
  for (const containerId of visualContainers) {
    const container = canvas.stage.getChildByName(containerId);
    if (container) {
      canvas.stage.removeChild(container);
    }
  }
  visualContainers.clear();
}

// Função para verificar se um token existe na cena atual
function isTokenInCurrentScene(tokenId) {
  return canvas.tokens.placeables.some(t => t.id === tokenId);
}

export function updateTokenVisuals(token, elevacao, gridSize, gridDistance) {
  // Primeiro, remova qualquer representação visual existente
  removeTokenVisuals(token);

  // Se não há elevação ou a variável global está desativada, não cria visuais
  const tokenVisuals = game.settings.get(MODULE_ID, "enableTokenVisuals");
  if (elevacao <= 0 || !tokenVisuals) return;

  // Cria um novo container
  const container = new PIXI.Container();
  container.name = `${token.id}-visuals`;
  container.interactive = false;
  container.interactiveChildren = false;
  
  // Registrar o container
  visualContainers.add(container.name);

  // Criar uma sombra circular no chão
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x000000, 0.3);
  shadow.drawCircle(0, 0, (canvas.grid.size/2) * (token.h/canvas.grid.size));
  shadow.endFill();
  shadow.position.set(
    token.x + token.h / 2, 
    token.y + token.h / 2
  );
  container.addChild(shadow);

  // Criar uma linha conectando o chão ao token
  const line = new PIXI.Graphics();
  line.lineStyle(2, 0xff0000, 0.5);
  line.moveTo(              // vai para o centro do token
    token.x + token.h / 2,
    token.y + token.h / 2
  ).lineTo(                 // desenha uma linha de onde moveu para a próxima posição
    //centraliza no token + posiciona no cartesiano diretamente, porque eu preciso somente de uma linha na diagonal
    (token.x + token.h/2) + (elevacao * (gridSize/gridDistance)),
    (token.y + token.h/2) - (elevacao * (gridSize/gridDistance))
  );
  container.addChild(line);

  // Adicionar o container ao canvas
  canvas.stage.addChild(container);
}

export function removeTokenVisuals(token) {
  const container = canvas.stage.getChildByName(`${token.id}-visuals`);
  if (container) {
    canvas.stage.removeChild(container);
    visualContainers.delete(container.name);
  }
}

Hooks.on('canvasReady', () => { 
  clearAllVisuals();
});

Hooks.on('deleteToken', (token) => {
  removeTokenVisuals(token);
});






// HOOK SETUP FOR COMPATIBILITY WITH FOUNDRY V11
Hooks.once('ready', () => {
  setupCompatibilityHooks();
});

function setupCompatibilityHooks() {
  if (FOUNDRY_VERSION === 11) {
    Hooks.on('dropCanvasData', (canvas, object) => {
      const globalPoint = {
        x: event.clientX,
        y: event.clientY
      };
  
      // Converts to local coordinates of the stage
      const localPos = canvas.stage.toLocal(globalPoint);
      object.x = Math.round(localPos.x);
      object.y = Math.round(localPos.y);
    });
    // Hooks.on('dropCanvasData', (canvas, object) => {
    //   let {x, y} = canvas.stage.worldTransform.applyInverse({x: event.clientX, y: event.clientY})

    //   object.x = x;
    //   object.y = y;
    // });
  }
}