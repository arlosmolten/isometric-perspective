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

// filter the sort layer into a new array of sortables, copy that array , sort the copy and return the result.
export function sortPlaceableByPosition(placeable) { // might not need palceable later
  console.clear()
  const placeableMeshLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
  const canvasLayer = canvas.primary.children;

  const filteredLayer = canvasLayer.filter( sprite => {
    return sprite.sortLayer === placeableMeshLayer && sprite.object.previewType === null;
  }); // only need DepthSortPlaceables
  // let layerToSort = filteredLayer.map(item => Object.assign({}, item));
  let layerToSort = filteredLayer.map(item => Object.assign({}, item)).reverse();

  layerToSort = layerToSort.toSorted((sprite,sibling) => {
    const currentSprite = new SortableSprite(sprite);
    const currentSibling = new SortableSprite(sibling);
    return currentSprite.getSortOrder(currentSibling)
  });

  // might delete later
  // for(let i = 0; i < layerToSort.length; i++){
  //   const current = new SortableSprite(layerToSort[i]);
  //   const next = new SortableSprite(layerToSort[i+1]);
  //   if(current.isToken() && next.isNotNull()){
  //     const sortScore = sortByFacing(next,current);
  //     // console.log("IS TOKEN?", current.name , next.name , sortScore)
  //   }
  // }
  
  return layerToSort;
}

// SortableSprite is a data class with some utility methods to avoid long chains of sprite.object.document.someValue in the code and overall make the 
// sorting code a bit more readable. Also help isolate cases and avoid endless nesting comparaison, the utility methods always check for validiy as well.
// isFacing() if its a tile, return the right facing state, taking in account if its flipped for SW and SE facings.
// isTile() return true if its a tile, a bit shorter than doing a full comparaison everytime its needed.
// isToken() return true if its a token, a bit shorter than doing a full comparaison everytime its needed.
// isFlipped() return true if the tile is either flipped via the tileFlipped flag or if fast flip is installed , based on tileMirrorHorizontal in that case.
// isRegionValid() because javascript will consider that null === null or undefined === undefined or "" === "" is as valid as iftwo region id match ... 
// isNotNull() in case an invalid object is passed in the constructor, dosent break but marked as null , used when during the token sort correction when traversing the 
// layerToSort if the token is at index 0 or at index layerToSort.length , again, used to make code a bit more readable and to rely less on "===" checks clutters everywhere.
// getDebugData([args,...]) display SortableSprite props in a nice table for debugging purpose
// getSortOrder(sibling) take another adjacent SortableSprite and compare their x , y or iso depth based on facing rules and return a positive or negative value to determine sort order:
// a negative value indicate that the sibling should be sorted below 
// a positive value indicate that the sibling should be sorted above
// zero or NaN indicate a tie , no changes need to happen.
// 
export class SortableSprite {
  constructor(placeable){
    if(placeable){
      this.id = placeable.object.document.id;
      this.type = placeable.object.document.documentName;
      this.name = placeable.object.document.name? placeable.object.document.name : "no name";
      this.x = placeable.object.document.x;
      this.y = placeable.object.document.y;
      this.isoDepth = this.y - this.x;
      this.facing = placeable.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'tileFacing') ?? DEFAULT_TILE_FACING;
      this.sort = placeable.object.document.sort;
      this.tileFlipped = placeable.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'tileFlipped')?placeable.object.document.getFlag(isometricModuleConfig.MODULE_ID,'tileFlipped') : null;
      this.occupiedRegion = placeable.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion');
      this.linkedRegion = placeable.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'regionLink');
      this.tileMirrorHorizontal = null;  
      if (game.modules.get(fastFlipCompatiility.MODULE_ID)?.active){
        this.tileMirrorHorizontal = placeable.object.document.getFlag(fastFlipCompatiility.MODULE_ID, fastFlipCompatiility.TILE_MIRROR_HORIZONTAL);
      }
    } else {
      this.isNull = true;
    }
  }
  // status checks
  isFacing(){
    let currentFacing = null;
    if(this.type !== "Tile") return null;
      switch(this.facing){
      case 'south west':
        currentFacing = this.isFlipped()? 'south east' : 'south west';
        break;
      case 'south east':
        currentFacing = this.isFlipped()? 'south west' : 'south east';
        break;
      case 'south':
        currentFacing = 'south';
        break;
      case 'side':
        currentFacing = 'side';
        break;
      default:
        currentFacing = null;
    }
    return currentFacing;
  }

  isTile(){return this.type === "Tile";}
  isToken(){return this.type === "Token";}
  isNotNull(){return !this.isNull;}

  isFlipped(){
    let result = false;
    if(this.tileMirrorHorizontal || this.tileFlipped){
      result = true;
    }
    return result;
  }

  isRegionValid(){
    let regionIsValid = true;
    if(this.isToken()){
      if(this.occupiedRegion === null || this.occupiedRegion === undefined || this.occupiedRegion === ""){ regionIsValid = false};
    }
    if(this.isTile()){
      if(this.linkedRegion === null || this.linkedRegion === undefined || this.linkedRegion === ""){ regionIsValid = false};
    }
    return regionIsValid;
  }
  // sorting
  getSortOrder(sibling){
    let depthScore = 0;
    if(this.isTile){
      switch(this.isFacing()){ // evaluates cases based on which way the tile is facing in case its facing in a diagonal way
        case 'south west':
        depthScore = sibling.x - this.x;
        break;
      case 'south east': 
        depthScore = sibling.y - this.y;
        break;
      default:
        depthScore = Math.floor(( sibling.isoDepth - this.isoDepth ) * 0.5);
      }
    } else { // tokens dont care about facing
      depthScore = Math.floor(( sibling.isoDepth - this.isoDepth ) * 0.5);
    }
    console.log(this.name, "sibling: " , sibling.name , depthScore)
    return depthScore;
  }
  // debug
  getDebugData(data){
    const debugData = {}
    for (const [key, value] of Object.entries(this)) {
      data.map(entry => {
        if(entry === key){
          debugData[key] = value;
        }
      })
    }
    console.table(debugData);
  }
}

///*** SortableSprite end *///

// if needed can be moved in SortableSprite
function switchPlaceablePositions(filteredLayer,sortScore){
  const sprite = filteredLayer[sortScore.spriteIndex];
  const sibling = filteredLayer[sortScore.siblingIndex];
  filteredLayer[sortScore.spriteIndex] = sibling;
  filteredLayer[sortScore.siblingIndex] = sprite;
}

// should be moved in SortableSprite
function isRegionMatching (sprite, sibling){
  if(isDifferentId(sprite,sibling)){ // never compare an object against itself
    if(isRegionValid(sprite) && isRegionValid(sibling) || isRegionValid(sibling) && isRegionValid(sprite)){
      if(sprite.occupiedRegion === sibling.linkedRegion || sibling.occupiedRegion === sprite.linkedRegion){ return true; }
    } else { return false;}
  }
}

// could be moved in SortableSprite if needed
function isDifferentId(spriteA,spriteB){
  return !(spriteA.id === spriteB.id)
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

// dont know yet if should be moved in SortableSprite , keeping it external for now
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

// function isTile(sprite){
//   return sprite.type == "Tile";
// }

// function isToken(sprite){
//   return sprite.type == "Token";
// }

// function isTileFlipped (sprite){
//   let result = false;
//   if(sprite.tileMirrorHorizontal || sprite.tileFlipped){
//     result = true;
//   }
//   return result;
// }


// // compare cases where the placeable type is: 
// function comparePairings(sprite,sibling){
//   if(isToken(sprite) && isToken(sibling)){
//     return "Token-Token";
//   } else if(isTile(sprite) && isTile(sibling)){
//     return "Tile-Tile";
//   } else if(isTile(sprite) && isToken(sibling)){
//     if(isRegionMatching(sprite,sibling)){
//       return "Region-Sort";
//     } else {
//       return "Tile-Token";
//     }
//   } else if(isToken(sprite) && isTile(sibling)){
//     if(isRegionMatching(sprite,sibling)){
//       return "Region-Sort";
//     } else {
//       return "Token-Tile";
//     }
//   }
// }

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
// compare a sprite and its sibling and return the right sorting score based on:
// ... if both are tokens : sort by vertical depth
// ... if both are tiles : sort by facing but the order dosent matter.
// ... if one is a tile and the other a token sort by facing but the tile always go first
// ... if the token and the tiles share a region ID , region override the sortscore and always put the tiles behind the token.
// function getSortScore(sprite, sibling){
//   // const token = isToken(sprite)? sprite : sibling;
//   // const tile = isTile(sprite)? sprite : sibling;
//   if(isDifferentId(sprite,sibling)){ // never compare an object against itself
//     switch(comparePairings(sprite,sibling)){
//       case "Token-Token": // order dosent matter.
//       case "Tile-Tile": // order dosent matter, but the facing does.
//       case "Tile-Token":
//       case "Token-Tile":
//         return sortByFacing(sprite,sibling);
//         break;
//       // case "Tile-Token": // specific case requiring to pass the right type in the right order : Tile-Token
//       //   return sortByFacing(tile,token);
//       //   break;
//       // case "Token-Tile": // specific case requiring to pass the right type in the right order : Tile-Token
//       //   return sortByFacing(tile,token);
//       //   break;
//       case "Region-Sort": // regions override sorting on their linked itles
//         return isTile(sprite)? -100: 100; // need to change that to sort by region! 
//         break;
//       default:
//         return sortByFacing(sprite,sibling);
//         break;
//     }
//   }
// }

// token moving from front to behind its tile sibling will make perpendicularDepth go from - to +
// tile moving from front to behind its tile sibling will make perpendicularDepth go from - to + but only for the sibling

// function sortByFacing(sprite,sibling){
//   let depthScore = {
//     isoDepth:0,
//     perpendicularDepth:0,
//   };

//   switch(sprite.isFacing()){ // evaluates cases based on which way the tile is facing
//     case 'south west':
//     depthScore.perpendicularDepth = sprite.x - sibling.x;
//     depthScore.isoDepth =  Math.floor(( sprite.isoDepth - sibling.isoDepth ) * 0.5); // token moving from front to behind go from - to + but positive should mean in front while negative should mean behind
//     break;
//   case 'south east': 
//     depthScore.perpendicularDepth = sprite.y - sibling.y;
//     depthScore.isoDepth =  Math.floor(( sprite.isoDepth - sibling.isoDepth ) * 0.5); // token moving from front to behind go from - to + but positive should mean in front while negative should mean behind
//     break;
//   default:
//     depthScore.perpendicularDepth = 0;
//     depthScore.isoDepth = Math.floor(( sprite.isoDepth - sibling.isoDepth ) * 0.5);
//   }

//   return depthScore;
// }


// // cant figure out if this priority order is correct or not, the distribution of placeables is correct but their ordering is still incorrect
// function sortLayerByDepth(sprite,sibling){ 
//   return sprite.isoDepth - sibling.isoDepth;
// }
