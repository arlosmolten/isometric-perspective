import { isometricModuleConfig } from './consts.js';
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

//to avoid duplicate security checkers all over the place
export function isIsometricAutosortingEnabledForPlaceable(placeable,scene) {
  if (game.version.startsWith("11")) return false; //There isn't a sort method on v11. Needs another way to sort.
  if (!scene) return false;
  if (scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled")) {return true}
}

/**
 * change placeables sort values based on its y value on the grid compared to its siblings.
 * @param {Placeable|PlaceableDocument} token - The token or token document to calculate for.
 */
export function sortPlaceableByPosition(placeable) {
  if(placeable.mesh.sortLayer === foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS ){
    const placeableMeshLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
    const canvasLayer = canvas.primary.children;
    const currentSortLayer = placeable.mesh.parent

    const displayList = canvasLayer.filter( sprite => sprite.sortLayer === placeableMeshLayer);

    displayList.sort((sprite,sibling)=> compareSpriteByPosition(sprite.object.document,sibling.object.document));
    // so when entering the 2nd region, the token is sorted back to 0 , there is a problem with the sorting logic , need to be investigated!
    // displayList.map( sprite => console.log(sprite.name,sprite.object.document.id, sprite.sort))
    
    for (let i = 0; i < displayList.length; i++) {
      const currentSprite = displayList[i];
      currentSprite.object.document.sort = i;
      currentSprite.sort = i;
    }
    placeable.mesh.parent.sortDirty = true;
  }
}

export function sortPlaceableByRegion(placeable) {
  if(placeable.mesh.sortLayer === foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS ){
    const placeableMeshLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
    const canvasLayer = canvas.primary.children;
    const currentSortLayer = placeable.mesh.parent

    const displayList = canvasLayer.filter( sprite => sprite.sortLayer === placeableMeshLayer);

    displayList.sort((sprite,sibling)=> {
      let compare = 0;
      if( sprite.object.document.documentName === "Token" || sibling.object.document.documentName === "Token" ) {
        if(sprite.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion')){
          compare = compareSpriteByRegion(sprite.object.document,sibling.object.document);
        } else if (sibling.object.document.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion')) {
          compare = compareSpriteByRegion(sprite.object.document,sibling.object.document);
        }
        return compare;
      }
    });

    for (let i = 0; i < displayList.length; i++) {
      const currentSprite = displayList[i];
      currentSprite.object.document.sort = i;
      currentSprite.sort = i;
    }

    placeable.mesh.parent.sortDirty = true;
  }
}


// possible cases: 
/** 
 * - region detection is not working properly
 * - sorting logic is erroneous -- on this
 * - x/y sorting might require more complex logic taking the x in account , in fact it seems right now quite unreliable
 * - token sorting is broken again, currently very supicious of how the +1 - 1 case is often resolved as 0 , 
 *   like it seems that there is a case where all 4 conditions are ignored
*/

function compareSpriteByRegion(sprite,sibling) {
  let sortChange = 0; // positive value = sorted above, negative value = sorted below
  const currentSprite = sortableSprite(sprite);
  const currentSibling = sortableSprite(sibling);

    if(currentSprite.id !== currentSibling.id){
    if (currentSprite.type === "Token" && currentSibling.type === "Tile"){
      if(currentSprite.occupiedRegion && currentSibling.linkedRegion){
        if( currentSprite.occupiedRegion === currentSibling.linkedRegion){
          console.log("TOKEN > TILE!", currentSprite.occupiedRegion, currentSibling.linkedRegion )
          currentSprite.forceSortAbove = true
          currentSibling.forceSortBelow = true
        }
      }

    } else if (currentSprite.type === "Tile" && currentSibling.type === "Token"){
      if(currentSprite.linkedRegion && currentSibling.occupiedRegion){
        if(currentSprite.linkedRegion === currentSibling.occupiedRegion){
          console.log("TILE > TOKEN!", currentSprite.occupiedRegion, currentSibling.linkedRegion )
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

function compareSpriteByPosition(sprite,sibling){    
  let sortChange = 0; // positive value = sorted above, negative value = sorted below
  const currentSprite = sortableSprite(sprite);
  const currentSibling = sortableSprite(sibling);

  if (currentSprite.y > currentSibling.y) {
    // console.log("Y ABOVE?", "DOC Y", currentSprite.y, "ISO Y", currentSprite.isoCords.y)
    sortChange = 1;
  } else if (currentSprite.y < currentSibling.y) {
    // console.log("Y BELOW?")
    sortChange = -1;
  }

  return sortChange;
}

function sortableSprite(sprite){
  return {
    id:sprite.id,
    type:sprite.documentName,
    x: sprite.documentName === "TILE"? sprite.x - (sprite.width * 0.5) : sprite.x,
    y: sprite.documentName === "TILE"? sprite.y - (sprite.height * 0.5) : sprite.y,
    isoCords: cartesianToIso(sprite.x,sprite.y),
    height:sprite.height,
    width:sprite.width,
    forceSortBelow: false,
    forceSortAbove: false,
    linkedRegion:sprite.getFlag(isometricModuleConfig.MODULE_ID, 'regionLink'),
    occupiedRegion: sprite.getFlag(isometricModuleConfig.MODULE_ID, 'currentRegion')
  }
  return sortableSprite;
}

/**
 * Calculates the sort value for a placeable based on its y value on the grid compared to its siblings.
 * @param {Token|TokenDocument} token - The token or token document to calculate for.
 * @returns {number} The calculated sort value.
 */
export function comparePlaceablePosition(placeable) {
  const placeableMeshLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
  const canvasLayer = canvas.primary.children;
  let currentPlaceableY = placeable.document.y;
  let newSort = placeable.mesh.sort ?? 0;

  canvasLayer.map( sprite => {
    if(sprite.sortLayer === placeableMeshLayer){

      const placeableId = placeable.document.id
      const placeableType = placeable.document.documentName
      const siblingId = sprite.object.document._id
      const siblingType = sprite.object.document.documentName

      if(placeableId !== siblingId){
        let currentCompareY = sprite.object.document.y;
        // in v14 tiles point of origin is their visual center so their y coordinate isn't at their bottom edge , a small adjustment is required
          if (game.release.generation >= 14) {
            if(siblingType === "Tile"){currentSpriteY = sprite.object.document.y + (sprite.object.document.height * 0.5);}
            if(placeableType === "Tile"){ currentPlaceableY = placeable.document.y + (placeable.document.height * 0.5);}
          }
        // compare Y coordinates and adjust the sort order in consequence
        if (currentPlaceableY > currentCompareY) {             
          if (placeable.mesh.sort <= sprite.sort) { newSort = sprite.sort + 1;}
        }
        else if (currentPlaceableY < currentCompareY) {
          if (placeable.mesh.sort >= sprite.sort) { newSort = Math.max(0, sprite.sort - 1); }
        }
      }
    }
  });
  return newSort;
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

export function graphicDebugTool(x,y,container){
  const dot = new PIXI.Graphics();
  dot.drawRect(2000,2000,200,200);
  // dot.drawRect(x,y,200,200);
  dot.visible = true;
  dot.beginFill(0xff0000)
  dot.endFill();
  container.addChild(dot);
}