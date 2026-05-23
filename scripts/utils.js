import { 
  isometricModuleConfig,
  fastFlipCompatiility,
  TILE_FACINGS,
  DEFAULT_TILE_FACING
} from './consts.js';
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
          compare = comparesiblingyRegion(sprite,sibling);
        } else if (sibling.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion')) {
          compare = comparesiblingyRegion(sprite,sibling);
        }
        return compare;
      }
    });

  }
}

/**
 * change placeables sort values based on its y value on the grid compared to its siblings.
 * @param {Placeable|PlaceableDocument} placeable - The placeable document used as a reference for the sortlayer.
 */
export function sortPlaceableByPosition() {
  const placeableMeshLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
  const canvasLayer = canvas.primary.children;
  const currentSortLayer = canvas.primary;
  return canvasLayer.filter( sprite => sprite.sortLayer === placeableMeshLayer)
  .sort((sprite,sibling)=> compareSiblingPosition(sprite,sibling))
  .toSorted((sprite,sibling)=> compareSiblingPosition(sprite,sibling));
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

function compareSiblingPosition(sprite,sibling){    
  let sortChange = 0;
  const currentSprite = sortableSprite(sprite);
  const currentSibling = sortableSprite(sibling);
  // for cases with tiles linked to a region with region sort enabled.
  if(isRegionMatching(currentSprite,currentSibling)){
    sortChange = sortByRegion(currentSprite,currentSibling);
  } else {
    // debugSort(currentSprite,currentSibling)
    sortChange = sortByFacing(currentSprite,currentSibling);
  }
  return sortChange;
}

// compare cases where the placeable type is: 
// token vs token
// tile vs tile 
// token vs tile
// avoid cluttering getSortingRule() and improve code readability
function comparePairings(sprite,sibling){
  if(isToken(sprite) && isToken(sibling)){
    return "Token-Token";
  } else if(isTile(sprite) && isTile(sibling)){
    return "Tile-Tile";
  } else if(isTile(sprite) && isToken(sibling)){
    return "Tile-Token";
  } else if(isToken(sprite) && isTile(sibling)){
    return "Token-Tile";
  }
}

// compare a sprite and its sibling and return the right sorting rule based on:
// ... if the sibling is a token : sort by vertical depth --done 
// ... if the sibling is a token inside a region with linked walls : sort the linked walls behind the token -- todo
// ... if the sibling is a tile : compare depth based on their facing and if they are flipped -- wip
//     ... if a sibling is  a tile and is facing south west , sort on the y axis
//     ... if a sibling is  a tile and is facing south east , sort on the x axis
function sortByFacing(spriteToSort, siblingToCompare){
  if(spriteToSort.id !== siblingToCompare.id){ // never compare an object against itself
    switch(comparePairings(spriteToSort,siblingToCompare)){
      case "Token-Token":
        // tokens are always sorted by x/y depth against each others
        return spriteToSort.isoDepth - siblingToCompare.isoDepth; // other cases dont need complex rules, simply compare by vertical position on the screen
        break;
      case "Tile-Tile":
      case "Tile-Token":
      case "Token-Tile":
        // tiles have a bit more complex logic , especially if they have a large width, so tiles are compared by a perpendicular X axis or Y axis
        // this take in account a tile facing and if its flipped , 
        switch(getFacing(siblingToCompare)){ 
          case 'south west':
            return siblingToCompare.x - spriteToSort.x 
            break;
          case 'south east':
            return spriteToSort.y - siblingToCompare.y 
            break;
          default:
            return spriteToSort.isoDepth - siblingToCompare.isoDepth; 
        }
        break;
      default:
        return spriteToSort.isoDepth - siblingToCompare.isoDepth; 
        break;
    }
  }
}

function sortByRegion(sprite, sibling){
  if(isTile(sprite)){
    return -1;
  } else if (isTile(sibling)){
    return 1;
  }
}

function isRegionMatching (sprite, sibling){
  if(sprite.occupiedRegion !== null && sibling.linkedRegion !== null){
    if(sprite.occupiedRegion === sibling.linkedRegion){ return true }
  } else if(sibling.occupiedRegion !== null && sprite.linkedRegion !== null){
    if(sibling.occupiedRegion === sprite.linkedRegion){ return true }
  } else { return false; }
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
// IMPROVEMENT: draw the gizmo in a way to indicate which axis a tile is facing 
// other improvement : instead of a drop down, two floating arrow buttons setting the facing that appear when the tile is controlled
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


function isTile(sprite){
  return sprite.type == "Tile";
}

function isToken(sprite){
  return sprite.type == "Token";
}

function isTileFlipped (sprite){
  let result = false;
  if(sprite.tileMirrorHorizontal || sprite.tileFlipped){
    result = true;
  }
  return result;
}

// console.log("FLIPPED?", sprite.name , isTileFlipped(sprite), isTileFlipped(sprite)? 'south east' : 'south west') 

//return a tile true facing in case the tile is in a flipped state if the initial facing is south west or south
function getFacing(sprite) {
  if(!isTile(sprite)) return null;
  switch(sprite.tileFacing){
    case 'south west':
      return isTileFlipped(sprite)? 'south east' : 'south west';
      break;
    case 'south east':
      return isTileFlipped(sprite)? 'south west' : 'south east';
      break;
    case 'south':
      return 'south';
      break;
    case 'side':
      return 'side';
      break;
    default:
      return null;
  }
}

/**
 * // a factory function that return a new object that contain all the relevant data required for depth sorting
 * // notes : turn that into a class later
 * @param {*} sprite 
 * @returns 
 */

// may seems overkill but passing the values directly sometimes cause weird "in between" value mutations that bricks sorting calculations
function sortableSprite(sprite){
  const id = sprite.object.document.id;
  const type = sprite.object.document.documentName;
  const name = sprite.object.document.name? sprite.object.document.name : "no name";
  const x = sprite.object.document.x;
  const y = sprite.object.document.y;
  let anchorX = sprite.object.document.x;
  let anchorY = sprite.object.document.y;
  let tileMirrorHorizontal = null;
  const tileFacing = sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'tileFacing') ?? DEFAULT_TILE_FACING;    
  if (game.modules.get(fastFlipCompatiility.MODULE_ID)?.active){
    tileMirrorHorizontal = sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL)
  }
  const tileFlipped = sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'tileFlipped')?sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID,'tileFlipped') : null;
  
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
    isoDepth: y-x,
    height:height,
    width:width,
    forceSortBelow: false,
    forceSortAbove: false,
    linkedRegion:newLinkedRegion,
    occupiedRegion: newOccupiedRegion,
    tileMirrorHorizontal: tileMirrorHorizontal,
    tileFlipped: tileFlipped,
    tileFacing:tileFacing,
  }
}

function debugSort(sprite,sibling){
  if(sprite.id !== sibling.id){
    const data = {
      sprite:{
        value: sprite.name,
        result: sprite.type,
        facing: getFacing(sprite),
      },
      sibling:{
        value: sibling.name,
        result: sibling.type,
        facing: getFacing(sibling),
      },
      sort:{
        value: sortByFacing(sprite, sibling)
      }
    };
    console.table(data);
  }
}

// for debugging canvasLayers 
export function debugCanvasLayer(spriteList){
    const data = [];

    spriteList.map(sprite => {
      let newLinkedRegion = sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'regionLink');
      let newOccupiedRegion = sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion');
      if(!newLinkedRegion){newLinkedRegion = null;}
      if(!newOccupiedRegion){newOccupiedRegion = null;}
      let tileMirrorHorizontal = null;
      const tileFacing = sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'tileFacing') ?? DEFAULT_TILE_FACING;
      if (game.modules.get(fastFlipCompatiility.MODULE_ID)?.active){
        tileMirrorHorizontal = sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL)
      }
      const tileFlipped = sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'tileFlipped')?sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID,'tileFlipped') : null; 
      const trueFacing = getFacing({
        type: sprite.object.document.documentName,
        tileFacing: tileFacing,
        tileFlipped: tileFlipped,
        tileMirrorHorizontal:tileMirrorHorizontal
      })

      data.push({
        // id: sprite.object.document.id,
        // type: sprite.object.document.documentName,
        name: sprite.object.document.name? sprite.object.document.name : "no name",
        //sprite.documentName === "Tile"? (sprite.x) - (sprite.width *0.25) : sprite.x,
        x: sprite.object.document.x,
        y: sprite.object.document.y,
        // sortLayer: sprite.sortLayer, 
        sort: sprite.sort,
        // linkedRegion:newLinkedRegion,
        // occupiedRegion: newOccupiedRegion,
        // occupiedRegion: sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion')? sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion') : "none",
        // tileMirrorHorizontal: sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL)?sprite.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL) : null,
        // tileFlipped: sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'tileFlipped')?sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID,'tileFlipped') : null,
        // tileFacing: tileFacing,
        trueFacing : trueFacing
      })
    });
    console.table(data)
}