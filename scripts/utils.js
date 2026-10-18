import {
  isometricModuleConfig,
  fastFlipCompatiility,
  TILE_FACINGS,
  DEFAULT_TILE_FACING,
  ISOMETRIC_CONST
} from "./consts.js";
// Função auxiliar para converter coordenadas isométricas para cartesianas
export function isoToCartesian(isoX, isoY) {
  const angle = Math.PI / 4; // 45 graus em radianos
  return {
    x: isoX * Math.cos(angle) - isoY * Math.sin(angle),
    y: isoX * Math.sin(angle) + isoY * Math.cos(angle),
  };
}

// Função auxiliar para converter coordenadas cartesianas para isométricas
export function cartesianToIso(isoX, isoY) {
  const angle = Math.PI / 4; // 45 graus em radianos
  return {
    x: isoX * Math.cos(-angle) - isoY * Math.sin(-angle),
    y: isoX * Math.sin(-angle) + isoY * Math.cos(-angle),
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
  const parts = str.split(".");
  return parts.pop();
}

// adjust the input values in real time when the mosue is moving
export function adjustInputWithMouseDrag(event, config) {
  if (config.isDragging) {
    event.preventDefault();
    const deltaX = event.clientX - config.dragStartX;
    const deltaY = event.clientY - config.dragStartY;
    const finalValueX = roundToPrecision(
      config.originalX - deltaY * config.adjustmentX,
      getDecimalPrecision(config.adjustmentX),
    );
    const finalValueY = roundToPrecision(
      config.originalY + deltaX * config.adjustmentY,
      getDecimalPrecision(config.adjustmentY),
    );
    config.inputX.value = finalValueX;
    config.inputY.value = finalValueY;
    config.inputX.dispatchEvent(new Event("change", { bubbles: true }));
    config.inputY.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function parseNum(input) {
  return parseFloat(input.value) || 0;
}

export function roundToPrecision(num, precision) {
  if (precision <= 0) {
    return Math.round(num);
  }
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

function getDecimalPrecision(step) {
  if (step === 0 || step === 1) return 0;
  const stepStr = step.toString();
  if (stepStr.includes(".")) {
    return stepStr.split(".")[1].length;
  }
  return 0;
}

export function patchConfig(documentSheet, config, args) {
  if (!documentSheet) return;
  // Check if already patched
  if (documentSheet.TABS?.sheet?.tabs?.some((tab) => tab.id === config.tabId))
    return;
  // Adding the isometric tab data to the config parts
  if (documentSheet.TABS?.sheet?.tabs) {
    documentSheet.TABS.sheet.tabs.push({
      id: config.tabId,
      group: config.tabGroup,
      label: config.label,
      icon: config.icon,
    });
  }
  // Adding the part template
  if (documentSheet.PARTS) {
    documentSheet.PARTS.isometric = { template: config.templatePath };
    // Re-order footer to be last
    if (documentSheet.PARTS.footer) {
      const footerPart = documentSheet.PARTS.footer;
      delete documentSheet.PARTS.footer;
      documentSheet.PARTS.footer = footerPart;
    }
  }

  // Override part context to include the config data
  const defaultRenderPartContext = documentSheet.prototype._preparePartContext;
  documentSheet.prototype._preparePartContext = async function (
    partId,
    context,
    options,
  ) {
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
      };
    }
    return defaultRenderPartContext?.call(this, partId, context, options) || {};
  };
}

// filter the sort layer into a new array of sortables, copy that array , sort the copy and return the result.
export function sortPlaceableByPosition() {
  const placeableMeshLayer =
    foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
  const canvasLayer = canvas.primary.children;

  const filteredLayer = canvasLayer.filter((sprite) => {
    return sprite.sortLayer === placeableMeshLayer;
  }); // only need DepthSortPlaceables
  
  let layerToSort = filteredLayer.map((sprite) => Object.assign({}, sprite));

  layerToSort.sort((sprite, sibling) => {
    const currentSprite = new SortableSprite(sprite);
    const currentSibling = new SortableSprite(sibling);
    return currentSprite.sortByDepth(currentSibling);
  });

  layerToSort.sort((sprite, sibling) => {
    const currentSprite = new SortableSprite(sprite);
    const currentSibling = new SortableSprite(sibling);
    return currentSprite.getSortByFacing(currentSibling);
  });

  // keep for debugging later
  // console.clear();
  // layerToSort.map((sprite) => {
  //   const currentSprite = new SortableSprite(sprite);
  //   currentSprite.getDebugData(["name", "sort"]);
  // });

  return layerToSort;
}

// SortableSprite is a data class with some utility methods to avoid long chains of sprite.object.document.someValue in the code and overall make the
// sorting code a bit more readable. Also help isolate cases and avoid endless nesting comparaison, the utility methods always check for validiy as well.
// isFacing() if its a tile, return the right facing state, taking in account if its flipped for SW and SE facings.
// isTile() return true if its a tile, a bit shorter than doing a full comparaison everytime its needed.
// isToken() return true if its a token, a bit shorter than doing a full comparaison everytime its needed.
// isFlipped() return true if the tile is either flipped via the tileFlipped flag or if fast flip is installed , based on tileMirrorHorizontal in that case.
// isNotNull() in case an invalid object is passed in the constructor, dosent break but marked as null , used when during the token sort correction when traversing the
// layerToSort if the token is at index 0 or at index layerToSort.length , again, used to make code a bit more readable and to rely less on "===" checks clutters everywhere.
// getDebugData([args,...]) display SortableSprite props in a nice table for debugging purpose
// getSortByFacing(sibling) take another adjacent SortableSprite and compare their x , y or iso depth based on facing rules and return a positive or negative value to determine sort order:
// a negative value indicate that the sibling should be sorted below
// a positive value indicate that the sibling should be sorted above
// zero or NaN indicate a tie , no changes need to happen.
//
export class SortableSprite {
  constructor(placeable) {
    if (placeable) {
      this.mesh = placeable.object.mesh;
      this.id = placeable.object.document.id;
      this.type = placeable.object.document.documentName;
      this.name = placeable.object.document.name
        ? placeable.object.document.name
        : "no name";

      this.width = placeable.object.mesh.width ?? 0;
      this.height = placeable.object.mesh.height ?? 0;
      this.x = placeable.object.document.x;
      this.y = placeable.object.document.y;

      this.isoDepth = (this.y - this.x) * 0.5;
      this.facingConfig =
        placeable.object.document.getFlag(
          isometricModuleConfig.MODULE_ID,
          "tileFacing",
        ) ?? DEFAULT_TILE_FACING;
      this.sort = placeable.object.document.sort;

      // console.log("FLAG",
      //   placeable.object.document.documentName,
      //   placeable.object.document.id,
      //   placeable.object.document.getFlag(isometricModuleConfig.MODULE_ID, "tileFacing"));

      this.preview = placeable.object.previewType;
      if (game.modules.get(fastFlipCompatiility.MODULE_ID)?.active) {
        this.tileMirrorHorizontal = placeable.object.document.getFlag(
          fastFlipCompatiility.MODULE_ID,
          fastFlipCompatiility.TILE_MIRROR_HORIZONTAL,
        );
      }
      this.geometry = getSpriteAnchorPoint(this.mesh);
      if(this.type === "Tile"){
        this.geometry = getWallDimensions(this.mesh,this.isFacing());
      }

    } else {
      this.isNull = true;
    }
  }
  // status checks
  isFacing() {
    let currentFacing = null;
    if (this.type !== "Tile") return null;
    switch (this.facingConfig) {
      case "south west":
        currentFacing = this.isFlipped() ? "south east" : "south west";
        break;
      case "south east":
        currentFacing = this.isFlipped() ? "south west" : "south east";
        break;
      case "south":
        currentFacing = "south";
        break;
      case "side":
        currentFacing = "side";
        break;
      default:
        currentFacing = null;
    }
    return currentFacing;
  }

  isTile() {
    return this.type === "Tile";
  }
  isToken() {
    return this.type === "Token";
  }
  isNotNull() {
    return !this.isNull;
  }
  isPreview() {
    return this.preview !== null;
  }

  isFlipped() {
    let result = false;
    if (this.mesh) {
      const scaleFlipped = this.mesh.scale.x < 0;
      const textureFlipped = this.mesh.texture.rotate >= 8;
      if (scaleFlipped !== textureFlipped) {
        result = true;
      }
    }
    return result;
  }

  isWithinYBounds(sibling) {
    
    const boundaryOffset = this.geometry.depth;
    // const boundaryOffset = this.height * 0.5;
    // console.log("SORT BY SW;", this.isFacing(),"|", sibling.y,"|", this.geometry.anchorPoint.y ,"|",sibling.y >= this.geometry.anchorPoint.y);
    // console.log("SORT BY SW;", this.isFacing(),"|", sibling.y,"|", this.geometry.anchorPoint.y ,"|",sibling.y >= this.geometry.anchorPoint.y);
    // console.log( sibling.name,":", sibling.geometry , this.name,":", this.geometry)
    // console.log( "TEST ANCHOR COMPARE :",sibling.name,":", sibling.geometry.y , this.name,":", this.geometry.anchorPoint.y)

    // console.log("Y",sibling.name, ":",sibling.geometry.y,":",this.geometry.anchorPoint.y,"|", this.geometry.anchorPoint.y - boundaryOffset,"|", this.geometry.anchorPoint.y + boundaryOffset )

    const isWithinYBounds =
      sibling.geometry.y >= this.geometry.anchorPoint.y - boundaryOffset &&
      sibling.geometry.y <= this.geometry.anchorPoint.y + boundaryOffset;
      // sibling.y >= this.y; - boundaryOffset &&
      // sibling.y <= this.y + boundaryOffset;
    return isWithinYBounds;
  }
  isWithinXBounds(sibling) {
    
    const boundaryOffset = this.geometry.depth;
    // const boundaryOffset = this.height * 0.5;

    // console.log("X",sibling.geometry.x,":",this.geometry.anchorPoint.x, this.geometry.anchorPoint.x - boundaryOffset, this.geometry.anchorPoint.x + boundaryOffset )

    const isWithinXBounds =
      sibling.geometry.x >= this.geometry.anchorPoint.x - boundaryOffset &&
      sibling.geometry.x <= this.geometry.anchorPoint.x + boundaryOffset;
      // sibling.x >= this.x - boundaryOffset &&
      // sibling.x <= this.x + boundaryOffset;
    return isWithinXBounds;
  }

  // sorting
  sortByDepth(sibling) {
    return Math.floor(sibling.isoDepth - this.isoDepth);
  }

  getSortByFacing(sibling) {
    let depthScore = 0;
    if (this.isTile() && sibling.isToken()) {
      
      drawWallBoundaries(this)
      drawBlockBoundaries(sibling)

      const anchorPoint = this.geometry.anchorPoint;
      switch (this.isFacing()) {
        case "south west":
          if (sibling.geometry.y >= this.geometry.startPoint.y &&
              sibling.geometry.y <= this.geometry.endPoint.y &&
              this.isWithinXBounds(sibling)) {
            depthScore = anchorPoint.x - sibling.geometry.x;
          }
          break;
        case "south east":
          if (sibling.geometry.x >= this.geometry.startPoint.x &&
              sibling.geometry.x <= this.geometry.endPoint.x &&
              this.isWithinYBounds(sibling)) {
            depthScore = sibling.geometry.y - anchorPoint.y;
          }
          break;
        default: break;
      }
    } else if (this.isToken() && sibling.isTile()) {
      depthScore = -sibling.getSortByFacing(this);
    }
    return depthScore;
  }

  getDebugData(data) {
    const debugData = {};
    for (const [key, value] of Object.entries(this)) {
      data.map((entry) => {
        if (entry === key) {
          debugData[key] = value;
        }
      });
    }
    console.table(debugData);
  }
}
///*** SortableSprite end *///

// if needed can be moved in SortableSprite
function switchPlaceablePositions(filteredLayer, sortScore) {
  const sprite = filteredLayer[sortScore.spriteIndex];
  const sibling = filteredLayer[sortScore.siblingIndex];
  filteredLayer[sortScore.spriteIndex] = sibling;
  filteredLayer[sortScore.siblingIndex] = sprite;
}

// could be moved in SortableSprite if needed
function isDifferentId(spriteA, spriteB) {
  return !(spriteA.id === spriteB.id);
}

// Generic function to create adjustable buttons with drag functionality
export function createAdjustableButton(options) {
  // Destructure configuration options with default values
  const {
    buttonElement, // Button element to attach listener to
    inputs, // Array of input elements to update [InputX, InputY]
    adjustmentScale = 0.1, // Scale factor or Function returning [scaleX, scaleY]
    valueConstraints = null, // Optional min/max constraints {min, max}
    roundingPrecision = 0, // Number of decimal places
    onInputCallback = null, // Optional callback after input update
    onDragStart = null, // Optional callback on drag start
    onDragEnd = null, // Optional callback on drag end
  } = options;

  if (!buttonElement) return;

  // Apply basic styling if needed
  buttonElement.style.cursor = "pointer";

  // Apply derived step attribute
  const step = Math.pow(10, -roundingPrecision);
  inputs.forEach((input) => {
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
    if (typeof adjustmentScale === "function") {
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

    const adjustments = [-deltaScreenY * scales[0], deltaScreenX * scales[1]];

    // Update inputs
    inputs.forEach((input, index) => {
      if (!input) return;

      let newValue = originalValues[index] + adjustments[index];

      // Constraints
      if (valueConstraints) {
        newValue = Math.max(
          valueConstraints.min,
          Math.min(valueConstraints.max, newValue),
        );
      }

      // Rounding
      const factor = Math.pow(10, roundingPrecision);
      newValue = Math.round(newValue * factor) / factor;

      input.value = newValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    if (onInputCallback) onInputCallback();
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    isAdjusting = true;
    startX = e.clientX;
    startY = e.clientY;

    // Capture original values
    originalValues = inputs.map((input) =>
      input ? parseFloat(input.value) || 0 : 0,
    );

    if (onDragStart) onDragStart();

    window.addEventListener("mousemove", applyAdjustment);
    window.addEventListener("mouseup", onMouseUp);
  };

  const onMouseUp = (e) => {
    isAdjusting = false;
    window.removeEventListener("mousemove", applyAdjustment);
    window.removeEventListener("mouseup", onMouseUp);

    if (onDragEnd) onDragEnd();
  };

  buttonElement.addEventListener("mousedown", onMouseDown);

  // Prevent form submission on click
  buttonElement.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
}

export function toggleAnchorAxis(object, toggle) {
  cleanupTileAnchorLines();
  if (toggle) {
    drawTileAnchorLines(object);
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
  xAxisLine.name = "anchorLine";
  xAxisLine.lineStyle(2, 0x0000ff, 0.75); // line width, color, opacity

  const yAxisLine = new PIXI.Graphics();
  yAxisLine.name = "anchorLine";
  yAxisLine.lineStyle(2, 0xff0000, 0.75); // line width, color, opacity

  const zAxisLine = new PIXI.Graphics();
  zAxisLine.name = "anchorLine";
  zAxisLine.lineStyle(2, 0x00ff00, 0.75); // line width, color, opacity

  // Calculate diagonal length
  const canvasWidth = canvas.dimensions.width;
  const canvasHeight = canvas.dimensions.height;
  const diagonalLength = Math.sqrt(
    Math.pow(canvasWidth, 2) + Math.pow(canvasHeight, 2),
  );

  //horizontal lines
  xAxisLine.moveTo(objectAnchor.x, objectAnchor.y - diagonalLength / 2);
  xAxisLine.lineTo(objectAnchor.x, objectAnchor.y + diagonalLength / 2);
  yAxisLine.moveTo(objectAnchor.x - diagonalLength / 2, objectAnchor.y);
  yAxisLine.lineTo(objectAnchor.x + diagonalLength / 2, objectAnchor.y);

  // vertical line
  zAxisLine.moveTo(objectAnchor.x, objectAnchor.y);
  zAxisLine.lineTo(
    objectAnchor.x + diagonalLength / 2,
    objectAnchor.y - diagonalLength / 2,
  );

  // Add on canvas
  canvas.stage.addChild(xAxisLine);
  canvas.stage.addChild(yAxisLine);
  canvas.stage.addChild(zAxisLine);
}

function cleanupTileAnchorLines() {
  const existingLines = canvas.stage.children.filter(
    (child) => child.name === "anchorLine",
  );
  existingLines.forEach((line) => line.destroy());
}


export function getTileGeometry(tileDocument) {
  const width = tileDocument.width;
  const height = tileDocument.height;

  let anchorPoint; // the canvas point that document.x/y refers to
  let anchor;      // anchor fractions, 0..1 (0.5/0.5 = middle)

  if (tileDocument.shape) {
    // v14: foundry added a shape property to the tileDocument model, if that property exist then the world at least exist on v14+
    anchorPoint = { x: tileDocument.shape.x, y: tileDocument.shape.y };
    anchor = { x: tileDocument.shape.anchorX ?? 0.5, y: tileDocument.shape.anchorY ?? 0.5 };
  } else {
    // v13: x/y is the top-left corner. The anchor point is that corner plus the anchor fraction of the tile's size.
    anchor = { x: tileDocument.texture?.anchorX ?? 0.5, y: tileDocument.texture?.anchorY ?? 0.5 };
    anchorPoint = { x: tileDocument.x + anchor.x * width, y: tileDocument.y + anchor.y * height };
  }

  const topLeft = { x: anchorPoint.x - anchor.x * width, y: anchorPoint.y - anchor.y * height };
  const center  = { x: topLeft.x + width / 2, y: topLeft.y + height / 2 };
  return { anchorPoint, anchor, width, height, topLeft, center, rotation: tileDocument.rotation ?? 0 };
}

// used to auto adjust a tile offset to its anchor point, this is very approximative
export function alignWallTileBottomAnchor(object, anchorPoint, isoOffsets) {
  
  const texture = object.texture;
  const mesh = object.mesh;
  const slopeDrop = texture.width / ISOMETRIC_CONST.ratio;

  // find the approximative bottom middle point of a tile 
  const basePointInImage = {
    x: texture.width / 2,
    y: texture.height - slopeDrop / 2
  };

  const basePointFromAnchor = new PIXI.Point(
    basePointInImage.x - mesh.anchor.x * texture.width,
    basePointInImage.y - mesh.anchor.y * texture.height
  );

  // weird PIXI magic happens here ... mostly used to avoid rewriting math functions again ( and apparently its faster! )
  // see more at : https://pixijs.download/v7.x/docs/PIXI.Matrix.html#setTransform
  const meshMatrix = new PIXI.Matrix();
  meshMatrix.setTransform(
    0, 0, 0, 0,
    mesh.scale.x, mesh.scale.y,
    mesh.rotation, mesh.skew.x, mesh.skew.y
  );

  // see more at : https://pixijs.download/v7.x/docs/PIXI.Matrix.html#apply
  const baseOffsetFromMeshPosition = meshMatrix.apply(basePointFromAnchor);

  object.mesh.position.set(
    anchorPoint.x - baseOffsetFromMeshPosition.x,
    anchorPoint.y - baseOffsetFromMeshPosition.y
  );

  // preview the changes but does not save them
  object.mesh.position.x += isoOffsets.x;
  object.mesh.position.y += isoOffsets.y;

  return {
    offsetX: isoOffsets.x - baseOffsetFromMeshPosition.x,
    offsetY: isoOffsets.y - baseOffsetFromMeshPosition.y
  };

}

// a bit more pixi magic to get more accurate measurements for depth sorting.
export function getMeshGeometry(mesh) {
  const textureWidth = mesh.texture.width;
  const textureHeight = mesh.texture.height;
  const rhombusHeight = textureWidth / ISOMETRIC_CONST.ratio;

  const centerInImage = {
    x: textureWidth / 2,
    y: textureHeight - rhombusHeight / 2,
  };
  const verticesInImage = {
    topPoint:    { x: textureWidth / 2, y: textureHeight - rhombusHeight },
    rightPoint:  { x: textureWidth,     y: centerInImage.y },
    bottomPoint: { x: textureWidth / 2, y: textureHeight },
    leftPoint:   { x: 0,                y: centerInImage.y },
    centerPoint: centerInImage,
  };

  const meshMatrix = new PIXI.Matrix();
  meshMatrix.setTransform(0, 0, 0, 0,
    mesh.scale.x, mesh.scale.y, mesh.rotation, mesh.skew.x, mesh.skew.y);
  // the image point that sits exactly on mesh.position
  const anchorInImage = {
    x: mesh.anchor.x * textureWidth,
    y: mesh.anchor.y * textureHeight,
  };

  const rhombus = {};
  for (const [name, pointInImage] of Object.entries(verticesInImage)) {
    const offsetFromAnchor = meshMatrix.apply({
      x: pointInImage.x - anchorInImage.x,
      y: pointInImage.y - anchorInImage.y,
    });
    rhombus[name] = {
      x: mesh.position.x + offsetFromAnchor.x,
      y: mesh.position.y + offsetFromAnchor.y,
    };
  }
  return rhombus;
}

// utility function for a tile that is wall shaped.
function getWallDimensions(mesh, facing) {
  const geometry = getMeshGeometry(mesh);

  let smallestX = geometry.topPoint.x;
  let largestX = geometry.topPoint.x;
  let smallestY = geometry.topPoint.y;
  let largestY = geometry.topPoint.y;
  const rhombusPoints = [
    geometry.topPoint,
    geometry.rightPoint,
    geometry.bottomPoint,
    geometry.leftPoint,
  ];
  for (const point of rhombusPoints) {
    if (point.x < smallestX) smallestX = point.x;
    if (point.x > largestX) largestX = point.x;
    if (point.y < smallestY) smallestY = point.y;
    if (point.y > largestY) largestY = point.y;
  }

  const anchorPoint = geometry.centerPoint;

  if (facing === "south east") {
    const length = largestX - smallestX;
    const depth = largestY - smallestY;
    const normal = { x: 0, y: 1 };
    const startPoint = { x: smallestX, y: anchorPoint.y };
    const endPoint = { x: largestX, y: anchorPoint.y };

    // calculate the baseline of a wall
    const baselineStartPoint = geometry.leftPoint;
    const baselineEndPoint = geometry.bottomPoint;
    return {
      length,
      depth,
      anchorPoint,
      startPoint,
      endPoint,
      normal,
      baselineStartPoint,
      baselineEndPoint,
    };
  }

  if (facing === "south west") {
    const length = largestY - smallestY;
    const depth = largestX - smallestX;
    const normal = { x: -1, y: 0 };
    const startPoint = { x: anchorPoint.x, y: smallestY };
    const endPoint = { x: anchorPoint.x, y: largestY };
    const baselineStartPoint = geometry.bottomPoint;
    const baselineEndPoint = geometry.rightPoint;
    return {
      length,
      depth,
      anchorPoint,
      startPoint,
      endPoint,
      normal,
      baselineStartPoint,
      baselineEndPoint,
    };
  }

  return undefined;
}

export function getSpriteAnchorPoint(mesh) {
  const rhombus = getMeshGeometry(mesh);
  return rhombus.bottomPoint;
}

function cleanupNamedLines(name) {
  const existingLines = canvas.stage.children.filter(
    (child) => child.name === name,
  );
  existingLines.forEach((line) => line.destroy());
}

// draw mesh height axis line
function getMeshRiseVector(mesh) {
  const meshMatrix = new PIXI.Matrix();
  meshMatrix.setTransform(0, 0, 0, 0,
    mesh.scale.x, mesh.scale.y, mesh.rotation, mesh.skew.x, mesh.skew.y);
  return meshMatrix.apply({ x: 0, y: -mesh.texture.height });
}

// draw an iso box 
function drawRhombusEdges(boundaries, rhombus, riseVector, alpha) {
  const topPoint = { x: rhombus.topPoint.x + riseVector.x, y: rhombus.topPoint.y + riseVector.y };
  const rightPoint = { x: rhombus.rightPoint.x + riseVector.x, y: rhombus.rightPoint.y + riseVector.y };
  const bottomPoint = { x: rhombus.bottomPoint.x + riseVector.x, y: rhombus.bottomPoint.y + riseVector.y };
  const leftPoint = { x: rhombus.leftPoint.x + riseVector.x, y: rhombus.leftPoint.y + riseVector.y };
  boundaries.lineStyle(2, 0xff0000, alpha);
  boundaries.moveTo(rightPoint.x, rightPoint.y);
  boundaries.lineTo(bottomPoint.x, bottomPoint.y);
  boundaries.moveTo(topPoint.x, topPoint.y);
  boundaries.lineTo(leftPoint.x, leftPoint.y);
  boundaries.lineStyle(2, 0x0000ff, alpha);
  boundaries.moveTo(topPoint.x, topPoint.y);
  boundaries.lineTo(rightPoint.x, rightPoint.y);
  boundaries.moveTo(leftPoint.x, leftPoint.y);
  boundaries.lineTo(bottomPoint.x, bottomPoint.y);
}

// draw anchor
function drawAnchorPoint(boundaries, anchorPoint) {
  boundaries.lineStyle(2, 0xff69b4, 1);
  boundaries.beginFill(0xff69b4);
  boundaries.drawCircle(anchorPoint.x, anchorPoint.y, 7);
  boundaries.endFill();
}

//traw a box containing a sprite mesh with variable height ( tokens or block shaped tiles )
export function drawBlockBoundaries(object) {
  if (!object?.mesh?.texture) return;
  cleanupNamedLines("blockBoundaryLine");
  const rhombus = getMeshGeometry(object.mesh);
  const riseVector = getMeshRiseVector(object.mesh);

  const boundaries = new PIXI.Graphics();
  boundaries.name = "blockBoundaryLine";

  drawRhombusEdges(boundaries, rhombus, { x: 0, y: 0 }, 0.9);

  boundaries.lineStyle(2, 0x00ff00, 0.9);
  for (const point of [rhombus.topPoint, rhombus.rightPoint, rhombus.bottomPoint, rhombus.leftPoint]) {
    boundaries.moveTo(point.x, point.y);
    boundaries.lineTo(point.x + riseVector.x, point.y + riseVector.y);
  }

  drawRhombusEdges(boundaries, rhombus, riseVector, 0.45);
  drawAnchorPoint(boundaries, rhombus.bottomPoint);

  canvas.stage.addChild(boundaries);
}

// draw the boundaries of a wall 
function drawWallBoundaries(object) {
  if (!object?.mesh?.texture) return;
  const sprite = object instanceof SortableSprite ? object : new SortableSprite({ object });
  const dimensions = sprite.geometry;
  if (!dimensions?.baselineStartPoint) return;

  cleanupNamedLines("wallBoundaryLine");
  const boundaries = new PIXI.Graphics();
  boundaries.name = "wallBoundaryLine";
  canvas.stage.addChild(boundaries);

  const rhombus = getMeshGeometry(sprite.mesh);
  const anchorPoint = dimensions.anchorPoint;
  const normal = dimensions.normal;
  const reach = dimensions.depth;

  let areaPoints;
  if (sprite.isFacing() === "south east") {
    areaPoints = [
      { x: dimensions.startPoint.x, y: anchorPoint.y - reach },
      { x: dimensions.endPoint.x, y: anchorPoint.y - reach },
      { x: dimensions.endPoint.x, y: anchorPoint.y + reach },
      { x: dimensions.startPoint.x, y: anchorPoint.y + reach },
    ];
  } else {
    areaPoints = [
      { x: anchorPoint.x - reach, y: dimensions.startPoint.y },
      { x: anchorPoint.x - reach, y: dimensions.endPoint.y },
      { x: anchorPoint.x + reach, y: dimensions.endPoint.y },
      { x: anchorPoint.x + reach, y: dimensions.startPoint.y },
    ];
  }
  boundaries.lineStyle(2, 0xff66cc, 0.9);
  boundaries.beginFill(0xff66cc, 0.08);
  boundaries.moveTo(areaPoints[0].x, areaPoints[0].y);
  boundaries.lineTo(areaPoints[1].x, areaPoints[1].y);
  boundaries.lineTo(areaPoints[2].x, areaPoints[2].y);
  boundaries.lineTo(areaPoints[3].x, areaPoints[3].y);
  boundaries.closePath();
  boundaries.endFill();

  // footprint box
  boundaries.lineStyle(2, 0xff66cc, 0.35);
  boundaries.moveTo(rhombus.topPoint.x, rhombus.topPoint.y);
  boundaries.lineTo(rhombus.rightPoint.x, rhombus.rightPoint.y);
  boundaries.lineTo(rhombus.bottomPoint.x, rhombus.bottomPoint.y);
  boundaries.lineTo(rhombus.leftPoint.x, rhombus.leftPoint.y);
  boundaries.closePath();

  // anchor point reference
  boundaries.lineStyle(2, 0xff66cc, 0.4);
  boundaries.moveTo(dimensions.startPoint.x, dimensions.startPoint.y);
  boundaries.lineTo(dimensions.endPoint.x, dimensions.endPoint.y);

  // baseline
  boundaries.lineStyle(3, 0xff66cc, 0.9);
  boundaries.moveTo(dimensions.baselineStartPoint.x, dimensions.baselineStartPoint.y);
  boundaries.lineTo(dimensions.baselineEndPoint.x, dimensions.baselineEndPoint.y);

  // facing direction arrow
  const baselineCenter = {
    x: (dimensions.baselineStartPoint.x + dimensions.baselineEndPoint.x) * 0.5,
    y: (dimensions.baselineStartPoint.y + dimensions.baselineEndPoint.y) * 0.5,
  };
  const arrowLength = canvas.grid.size;
  const arrowTip = {
    x: baselineCenter.x + normal.x * arrowLength,
    y: baselineCenter.y + normal.y * arrowLength,
  };
  const headSize = canvas.grid.size * 0.25;
  const headBack = {
    x: arrowTip.x - normal.x * headSize,
    y: arrowTip.y - normal.y * headSize,
  };
  const headSide = { x: -normal.y, y: normal.x };
  boundaries.moveTo(baselineCenter.x, baselineCenter.y);
  boundaries.lineTo(arrowTip.x, arrowTip.y);
  boundaries.moveTo(arrowTip.x, arrowTip.y);
  boundaries.lineTo(
    headBack.x + headSide.x * headSize * 0.5,
    headBack.y + headSide.y * headSize * 0.5,
  );
  boundaries.moveTo(arrowTip.x, arrowTip.y);
  boundaries.lineTo(
    headBack.x - headSide.x * headSize * 0.5,
    headBack.y - headSide.y * headSize * 0.5,
  );

  drawAnchorPoint(boundaries, anchorPoint);
}