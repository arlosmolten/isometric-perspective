import { isometricModuleConfig,fastFlipCompatiility } from './consts.js';
// Função auxiliar para converter coordenadas isométricas para cartesianas
export function isoToCartesian(isoX, isoY) {
  const angle = Math.PI / 4; // 45 graus em radianos
  return {
    x: (isoX * Math.cos(angle) - isoY * Math.sin(angle)),
    y: (isoX * Math.sin(angle) + isoY * Math.cos(angle))
  };
}

// Função auxiliar para converter coordenadas cartesianas para isométricas
export function cartesianToIso(isoX, isoY) {
  const angle = Math.PI / 4; // 45 graus em radianos
  return {
    x: (isoX * Math.cos(-angle) - isoY * Math.sin(-angle)),
    y: (isoX * Math.sin(-angle) + isoY * Math.cos(-angle))
  };
}

// Função auxiliar para calcular a menor diagonal do losango (distância vertical entre vértices)
export function calculateIsometricVerticalDistance(width, height) {
  // Em uma projeção isométrica com rotação de 45°, a distância vertical
  // entre os vértices é a altura do losango formado
  return Math.sqrt(2) * Math.min(width, height);
}

// a simple utility function that can pop the last part of a "." separated string and retrieve the last part of it
// used to get "offsetX" from "flags.isometric-perspective.offsetX"
export function getFlagName(str) {
  const parts = str.split('.');
  return parts.pop();
}

// adjust the input values in real time when the mosue is moving
export function adjustInputWithMouseDrag(event,config){
  if(config.isDragging){
    event.preventDefault();
    const deltaX = event.clientX - config.dragStartX;
    const deltaY = event.clientY - config.dragStartY;
    const finalValueX = roundToPrecision((config.originalX - (deltaY * config.adjustmentX) ) , getDecimalPrecision(config.adjustmentX));
    const finalValueY = roundToPrecision((config.originalY +  (deltaX * config.adjustmentY) ) , getDecimalPrecision(config.adjustmentY));
    config.inputX.value = finalValueX;
    config.inputY.value = finalValueY;
    config.inputX.dispatchEvent(new Event('change', { bubbles: true }));
    config.inputY.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export function parseNum (input) { 
  return parseFloat(input.value) || 0;
} 

export function roundToPrecision(num,precision){
  if (precision <= 0) {
        return Math.round(num);
    }
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
}

function getDecimalPrecision(step) {
    if (step === 0 || step === 1) return 0;
    const stepStr = step.toString();
    if (stepStr.includes('.')) {
        return stepStr.split('.')[1].length;
    }
    return 0;
}

export function patchConfig(documentSheet, config, args) {
  if (!documentSheet) return;
  // Check if already patched
  if (documentSheet.TABS?.sheet?.tabs?.some(tab => tab.id === config.tabId)) return;
  // Adding the isometric tab data to the config parts
  if (documentSheet.TABS?.sheet?.tabs) {
    documentSheet.TABS.sheet.tabs.push({ id: config.tabId, group: config.tabGroup, label:config.label, icon: config.icon });
  }
  // Adding the part template
  if (documentSheet.PARTS) {
    documentSheet.PARTS.isometric = {template: config.templatePath};
    // Re-order footer to be last
    if (documentSheet.PARTS.footer) {
      const footerPart = documentSheet.PARTS.footer;
      delete documentSheet.PARTS.footer;
      documentSheet.PARTS.footer = footerPart;
    }
  }

  // Override part context to include the config data
  const defaultRenderPartContext = documentSheet.prototype._preparePartContext;
  documentSheet.prototype._preparePartContext = async function(partId, context, options) {
    if (partId === "isometric") {
      // Handle both 'document' and 'token' properties for compatibility
      const doc = this.document || this.token;
      if (!doc) {
        console.warn("Isometric Perspective: Unable to access token document");
        return { tab: context.tabs?.[partId] };
      }
      const flags = doc.flags?.[config.moduleConfig.MODULE_ID] ?? {};
      return {
        ...flags,
        ...args,
        document: doc,
        tab: context.tabs?.[partId],
      }
    }
    return defaultRenderPartContext?.call(this, partId, context, options) || {};
  }
}

/**
 * change placeables sort values based on its y value on the grid compared to its siblings.
 * @param {Placeable|PlaceableDocument} placeable - The placeable document used as a reference for the sortlayer.
 */
export function sortPlaceableByPosition(placeable) {
  if(placeable.mesh.sortLayer === foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS ){
    const placeableMeshLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
    const canvasLayer = canvas.primary.children;
    const currentSortLayer = placeable.mesh.parent
    return canvasLayer
    .filter( sprite => sprite.sortLayer === placeableMeshLayer)
    .toSorted((sprite,sibling)=> compareSpriteByPosition(sprite,sibling));
  }
}

export function sortPlaceableByRegion(placeable) {
  if(placeable.mesh.sortLayer === foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS ){
    const placeableMeshLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
    const canvasLayer = canvas.primary.children;
    const currentSortLayer = placeable.mesh.parent
    return canvasLayer
    .filter( sprite => sprite.sortLayer === placeableMeshLayer)
    .toSorted((sprite,sibling)=> {
      let compare = 0;
      if( sprite.object.document.documentName === "Token" || sibling.object.document.documentName === "Token" ) {
        if(sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion')){
          compare = compareSpriteByRegion(sprite,sibling);
        } else if (sibling.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion')) {
          compare = compareSpriteByRegion(sprite,sibling);
        }
        return compare;
      }
    });

  }
}

/**
 * compare two placeables by Y positions if one of the placable is a tile that is flipped
 * otherwise compare them by x positions.
 * this is due to the X axis being a diagonal from bottom left to top right ( acending)
 * an y being a diagonal from bottom riight to top left ( descending)
 *  y-      +x
 *    y-  x+
 *      o
 *    x-  y+
 * x-        y+
*/

function compareSpriteByPosition(sprite,sibling){    
  let sortChange = 0;
  const currentSprite = sortableSprite(sprite);
  const currentSibling = sortableSprite(sibling);

  if(isRegionMatching(currentSprite,currentSibling)){
    if(currentSprite.type === "Tile"){
      sortChange = -1;
    } else if (currentSibling.type === "Tile"){
      sortChange = 1;
    }
  } else {
    //token and tile interaction is quite tricky because it change based on if the tile is flipped or not ...
    if( currentSprite.type === "Token" && currentSibling.tileMirrorHorizontal || currentSibling.tileFlipped){
      sortChange = sortByY(currentSprite,currentSibling); // sort by Y axis if the tile is flipped
    } else if( currentSibling.type === "Token" && currentSprite.tileMirrorHorizontal || currentSprite.tileFlipped){
      sortChange = sortByY(currentSprite,currentSibling); // sort by Y axis if the tile is flipped
    } else if( currentSprite.type === "Token" && !currentSibling.tileMirrorHorizontal || !currentSibling.tileFlipped ){
      sortChange = sortByX(currentSprite,currentSibling); // sort by X axis if the tile is not flipped
    } else if( currentSibling.type === "Token" && !currentSprite.tileMirrorHorizontal || !currentSprite.tileFlipped ){
      sortChange = sortByX(currentSprite,currentSibling); // sort by X axis if the tile is not flipped
    } else {
      // cover the cases where its tile vs tile or token vs tokens
      sortChange = sortByX(currentSprite,currentSibling); // sort by X axis if the tile is not flipped
    }
  }
  return sortChange;
}

// ties in y still cause values cause flicker
// multiples tokens canc ause the logic to break sometimes for some reason

function sortByX(spriteA , spriteB){
  let result = 1;
  if ( spriteA.name === "orc fighter" || spriteB.name === "orc fighter") {
    console.log("orc fighter sorted by X")
  }
  if (spriteA.x >= spriteB.x) { result = -1;}
  return result;
}

function sortByY(spriteA , spriteB){
  let result = 1;
  if ( spriteA.name === "orc fighter" || spriteB.name === "orc fighter") {
    console.log("orc fighter sorted by Y")
  }
  if (spriteA.y <= spriteB.y) { result = -1;}
  else {result = 1;}
  console.log("sprite", spriteA.name,spriteA.y, spriteB.name, spriteA.y,result)
  return result;
}

function isRegionMatching (sprite, sibling){
  if(sprite.occupiedRegion !== null && sibling.linkedRegion !== null){
    if(sprite.occupiedRegion === sibling.linkedRegion){
      if ( sprite.name === "orc fighter" || sibling.name === "orc fighter") {
        console.log("orc fighter sorted by REGION")
      }
      return true
    }
  } else if(sibling.occupiedRegion !== null && sprite.linkedRegion !== null){
    if(sibling.occupiedRegion === sprite.linkedRegion){
      if ( sprite.name === "orc fighter" || sibling.name === "orc fighter") {
        console.log("orc fighter sorted by REGION")
      }
      return true
    }
  } else {
    return false;
  }
}


// Generic function to create adjustable buttons with drag functionality
export function createAdjustableButton(options) {
  // Destructure configuration options with default values
  const {
      buttonElement,            // Button element to attach listener to
      inputs,                   // Array of input elements to update [InputX, InputY]
      adjustmentScale = 0.1,    // Scale factor or Function returning [scaleX, scaleY]
      valueConstraints = null,  // Optional min/max constraints {min, max}
      roundingPrecision = 0,    // Number of decimal places
      onInputCallback = null,   // Optional callback after input update
      onDragStart = null,       // Optional callback on drag start
      onDragEnd = null          // Optional callback on drag end
  } = options;

  if (!buttonElement) return;

  // Apply basic styling if needed
  buttonElement.style.cursor = 'pointer';

  // Apply derived step attribute
  const step = Math.pow(10, -roundingPrecision);
  inputs.forEach(input => {
      if (input) input.step = step;
  });

  // State variables
  let isAdjusting = false;
  let startX = 0;
  let startY = 0;
  let originalValues = [0, 0];

  const applyAdjustment = (e) => {
      if (!isAdjusting) return;

      // Isometric Logic:
      // Mouse Vertical (DeltaY) affects Input X (index 0)
      // Mouse Horizontal (DeltaX) affects Input Y (index 1)
      const moveY = e.clientY; 
      const moveX = e.clientX;
      
      const deltaScreenX = moveX - startX;
      const deltaScreenY = moveY - startY;

      // Determine current scales
      let scales = [0.1, 0.1];
      if (typeof adjustmentScale === 'function') {
          scales = adjustmentScale(); // Expects [scaleX, scaleY]
      } else if (Array.isArray(adjustmentScale)) {
          scales = adjustmentScale;
      } else {
          scales = [adjustmentScale, adjustmentScale];
      }

      // Axis Swap for Isometric:
      // Input 0 (X) <--- Screen Y (Inverted: Up adds, Down subtracts for originalX logic? No, check original logic)
      // Original logic: finalValueX = originalX - (deltaY * adj). DeltaY = clientY - startY. (Drag Down = Pos Delta).
      // So Drag Down (Pos Delta) -> Subtracts X. Drag UP (Neg Delta) -> Adds X.
      // My code below use -deltaScreenY. If Drag Down (Pos), -Pos is Neg. Adds negative -> Subtracts. Correct.
      
      const adjustments = [
          -(deltaScreenY) * scales[0], 
          deltaScreenX * scales[1]     
      ];

      // Update inputs
      inputs.forEach((input, index) => {
          if (!input) return;
          
          let newValue = originalValues[index] + adjustments[index];

          // Constraints
          if (valueConstraints) {
              newValue = Math.max(valueConstraints.min, Math.min(valueConstraints.max, newValue));
          }

          // Rounding
          const factor = Math.pow(10, roundingPrecision);
          newValue = Math.round(newValue * factor) / factor;

          input.value = newValue; 
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      if (onInputCallback) onInputCallback();
  };

  const onMouseDown = (e) => {
      e.preventDefault();
      isAdjusting = true;
      startX = e.clientX;
      startY = e.clientY;

      // Capture original values
      originalValues = inputs.map(input => input ? (parseFloat(input.value) || 0) : 0);

      if (onDragStart) onDragStart();

      window.addEventListener('mousemove', applyAdjustment);
      window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseUp = (e) => {
      isAdjusting = false;
      window.removeEventListener('mousemove', applyAdjustment);
      window.removeEventListener('mouseup', onMouseUp);
      
      if (onDragEnd) onDragEnd();
  };

  buttonElement.addEventListener('mousedown', onMouseDown);
  
  // Prevent form submission on click
  buttonElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
  });
}

export function toggleAnchorAxis(object,toggle){
  cleanupTileAnchorLines()
  if(toggle){
    drawTileAnchorLines(object)
  }
}

// used to debug visually a point on the tile selection box's footprint but its bugged, should fix later
function drawTileAnchorLines(objectAnchor) {
  // Removes existing lines
  cleanupTileAnchorLines();
  
  // Create container for the lines
  const xAxisLine = new PIXI.Graphics();
  xAxisLine.name = 'anchorLine';
  xAxisLine.lineStyle(2, 0x0000FF, 0.75); // line width, color, opacity

  const yAxisLine = new PIXI.Graphics();
  yAxisLine.name = 'anchorLine';
  yAxisLine.lineStyle(2, 0xFF0000, 0.75); // line width, color, opacity

  const zAxisLine = new PIXI.Graphics();
  zAxisLine.name = 'anchorLine';
  zAxisLine.lineStyle(2, 0x00FF00, 0.75); // line width, color, opacity

  // Calculate diagonal length
  const canvasWidth = canvas.dimensions.width;
  const canvasHeight = canvas.dimensions.height;
  const diagonalLength = Math.sqrt(Math.pow(canvasWidth, 2) + Math.pow(canvasHeight, 2));

  //horizontal lines
  xAxisLine.moveTo(objectAnchor.x, objectAnchor.y - diagonalLength / 2);
  xAxisLine.lineTo(objectAnchor.x, objectAnchor.y + diagonalLength / 2);
  yAxisLine.moveTo(objectAnchor.x - diagonalLength / 2, objectAnchor.y);
  yAxisLine.lineTo(objectAnchor.x + diagonalLength / 2, objectAnchor.y);
  
  // vertical line
  zAxisLine.moveTo(objectAnchor.x, objectAnchor.y);
  zAxisLine.lineTo(objectAnchor.x + diagonalLength / 2, objectAnchor.y - diagonalLength / 2);

  // Add on canvas
  canvas.stage.addChild(xAxisLine);
  canvas.stage.addChild(yAxisLine);
  canvas.stage.addChild(zAxisLine);
};

function cleanupTileAnchorLines() {
  const existingLines = canvas.stage.children.filter(child => child.name === 'anchorLine');
  existingLines.forEach(line => line.destroy());
};


/**
 * // a factory function that return a new object that contain all the relevant data required for depth sorting
 * @param {*} sprite 
 * @returns 
 */

function sortableSprite(sprite){
  // may seems overkill but passing the values directly sometimes cause weird "in between" value mutations that bricks sorting calculations
  // also can prepare the data based on some conditions or states, for example the right offset of tiles might change if a tile is flipped or not

  const id = sprite.object.document.id;
  const type = sprite.object.document.documentName;
  const name = sprite.object.document.name? sprite.object.document.name : "no name";
  const x = sprite.object.document.x;
  const y = sprite.object.document.y;
  let anchorX = sprite.object.document.x;
  let anchorY = sprite.object.document.y;
  const tileMirrorHorizontal = sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL)?sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL) : null;
  const tileFlipped = sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'tileFlipped')?sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID,'tileFlipped') : null;

  // if(sprite.object.document.documentName === "Tile"){
  //   anchorX = (sprite.object.document.x) - (sprite.object.document.width * 0.5);
  //   anchorY = (sprite.object.document.y) + (sprite.object.document.height * 0.5);
  // }

  const height = sprite.object.document.height;
  const width = sprite.object.document.width;
  let newLinkedRegion = sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'regionLink');
  let newOccupiedRegion = sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion');
  if(!newLinkedRegion){newLinkedRegion = null};
  if(!newOccupiedRegion){newOccupiedRegion = null};
  

  return {
    id:id,
    type:type,
    name: name,
    x: x,
    y: y,
    anchorX: anchorX,
    anchorY: anchorY,
    height:height,
    width:width,
    forceSortBelow: false,
    forceSortAbove: false,
    linkedRegion:newLinkedRegion,
    occupiedRegion: newOccupiedRegion,
    tileMirrorHorizontal: tileMirrorHorizontal,
    tileFlipped: tileFlipped,
  }
}

// for debugging canvasLayers 
export function debugCanvasLayer(spriteList){
    const data = []

    spriteList.map(sprite => {
      let anchorX = sprite.object.document.x;
      let anchorY = sprite.object.document.y;
      // if(sprite.object.document.documentName === "Tile"){
      //   anchorX = (sprite.object.document.x) - (sprite.object.document.width * 0.25)
      //   anchorY = (sprite.object.document.y) + (sprite.object.document.height * 0.25)
      // }

      let newLinkedRegion = sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'regionLink');
      let newOccupiedRegion = sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion');
      if(!newLinkedRegion){newLinkedRegion = null;}
      if(!newOccupiedRegion){newOccupiedRegion = null;}
      data.push({
        // id: sprite.object.document.id,
        // type: sprite.object.document.documentName,
        name: sprite.object.document.name? sprite.object.document.name : "no name",
        //sprite.documentName === "Tile"? (sprite.x) - (sprite.width *0.25) : sprite.x,
        x: anchorX,
        y: anchorY,
        // sortLayer: sprite.sortLayer, 
        sort: sprite.sort,
        // linkedRegion:newLinkedRegion,
        // occupiedRegion: newOccupiedRegion,
        // occupiedRegion: sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion')? sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion') : "none",
        tileMirrorHorizontal: sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL)?sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL) : null,
        // tileFlipped: sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'tileFlipped')?sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID,'tileFlipped') : null,
      })
    });
    console.table(data)
}