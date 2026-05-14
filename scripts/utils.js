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
    .sort((sprite,sibling)=> compareSpriteByPosition(sprite,sibling));
  }
}

export function sortPlaceableByRegion(placeable) {
  if(placeable.mesh.sortLayer === foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS ){
    const placeableMeshLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
    const canvasLayer = canvas.primary.children;
    const currentSortLayer = placeable.mesh.parent

    const displayList = canvasLayer.filter( sprite => sprite.sortLayer === placeableMeshLayer);
    
    return displayList.toSorted((sprite,sibling)=> {
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

// possible cases: 
/** 
 * - region detection is not working properly
 * - sorting by position now is probably working properly now, at least it no longer get undefined or duplicates
 * - x/y sorting seems to still have issues with offset
 * - token sorting is broken again, currently very supicious of how the +1 - 1 case is often resolved as 0 , 
 *   like it seems that there is a case where all 4 conditions are ignored
 * 
 *  the sort by position is finally working as intended ( for now until a new bug is found) but seems to be quite more robust than before
 *  this is the next form of sorting that needs attention
*/

function compareSpriteByRegion(sprite,sibling) {
  let sortChange = 0; // positive value = sorted above, negative value = sorted below
  const currentSprite = sortableSprite(sprite);
  const currentSibling = sortableSprite(sibling);

    if(currentSprite.id !== currentSibling.id){
    if (currentSprite.type === "Token" && currentSibling.type === "Tile"){
      if(currentSprite.occupiedRegion && currentSibling.linkedRegion){
        if( currentSprite.occupiedRegion === currentSibling.linkedRegion){
          currentSprite.forceSortAbove = true
          currentSibling.forceSortBelow = true
        }
      }

    } else if (currentSprite.type === "Tile" && currentSibling.type === "Token"){
      if(currentSprite.linkedRegion && currentSibling.occupiedRegion){
        if(currentSprite.linkedRegion === currentSibling.occupiedRegion){
          currentSprite.forceSortBelow = true
          currentSibling.forceSortAbove = true
        }
      }
    }

    if(currentSprite.forceSortAbove){
      sortChange = 1;
    }
    
    if(currentSprite.forceSortBelow){
      sortChange = -1;
    }

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
    if(currentSprite.tileMirrorHorizontal || currentSprite.tileFlipped || currentSibling.tileMirrorHorizontal || currentSibling.tileFlipped){
      sortChange = sortByY(currentSprite,currentSibling);
    } else {
      sortChange = sortByX(currentSprite,currentSibling);
    }
  return sortChange;
}

function sortByX(spriteA , spriteB){
  let result = 1;
  if (spriteA.x > spriteB.x) { result = -1;}
  return result;
}

function sortByY(spriteA , spriteB){
  let result = 1;
  if (spriteA.y < spriteB.y) { result = -1;}
  return result;
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

// used to debug visually a point on the tile selection box's footprint but its bugged, should fix later
// export function graphicDebugTool(x,y,container){
//   const dot = new PIXI.Graphics();
//   dot.drawRect(2000,2000,200,200);
//   // dot.drawRect(x,y,200,200);
//   dot.visible = true;
//   dot.beginFill(0xff0000)
//   dot.endFill();
//   container.addChild(dot);
// }

function sortableSprite(sprite){

  let adjustedX = sprite.object.document.x;
  let adjustedY = sprite.object.document.y;
  if(sprite.object.document.documentName === "Tile"){
    adjustedX = (sprite.object.document.x) - (sprite.object.document.width * 0.5)
    adjustedY = (sprite.object.document.y) + (sprite.object.document.height * 0.25)
  }
  return {
    id:sprite.object.document.id,
    type:sprite.object.document.documentName,
    name: sprite.object.document.name? sprite.object.document.name : "no name",
    x: adjustedX,
    y: adjustedY,
    height:sprite.object.document.height,
    width:sprite.object.document.width,
    forceSortBelow: false,
    forceSortAbove: false,
    linkedRegion:sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'regionLink'),
    occupiedRegion: sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion'),
    tileMirrorHorizontal: sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL)?sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL) : null,
    tileFlipped: sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'tileFlipped')?sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID,'tileFlipped') : null
  }
  return sortableSprite;
}

// for debugging canvasLayers
export function debugCanvasLayer(spriteList){
    const data = []
    spriteList.map(sprite => {
      data.push({
        // id: sprite.object.document.id,
        // type: sprite.object.document.documentName,
        name: sprite.object.document.name? sprite.object.document.name : "no name",
        //sprite.documentName === "Tile"? (sprite.x) - (sprite.width *0.25) : sprite.x,
        // x: sprite.object.document.x,
        // y: sprite.object.document.y,
        x: sprite.object.document.documentName === "Tile"? (sprite.object.document.x) - (sprite.object.document.width*0.25) : sprite.object.document.x,
        y: sprite.object.document.documentName === "Tile"? (sprite.object.document.y) + (sprite.object.document.width*0.25) : sprite.object.document.y,
        // sortLayer: sprite.sortLayer, 
        sort: sprite.sort,
        // occupiedRegion: sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion')? sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion') : "none",
        // tileMirrorHorizontal: sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL)?sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL) : null,
        // tileFlipped: sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'tileFlipped')?sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID,'tileFlipped') : null,
      })
    });
    console.table(data)
}