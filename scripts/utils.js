import {
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
  cleanupNamedLines("anchorLine");
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
  cleanupNamedLines("anchorLine");

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

// remove pixi.drawings lines by name
function cleanupNamedLines(name) {
  const existingLines = canvas.stage.children.filter(
    (child) => child.name === name,
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

  // wall tiles generally take the shape of a skewed rectangle, or parallelogram to be exact semantically ... the footprint of a wall 
  // take its center line from the bottom of that wall's bottom edge length and extend in both direction on its width equal to that wall's height
  const parallelogram = {};
  for (const [name, pointInImage] of Object.entries(verticesInImage)) {
    const offsetFromAnchor = meshMatrix.apply({
      x: pointInImage.x - anchorInImage.x,
      y: pointInImage.y - anchorInImage.y,
    });
    parallelogram[name] = {
      x: mesh.position.x + offsetFromAnchor.x,
      y: mesh.position.y + offsetFromAnchor.y,
    };
  }
  parallelogram.points = [
    parallelogram.topPoint,
    parallelogram.rightPoint,
    parallelogram.bottomPoint,
    parallelogram.leftPoint,
  ];
  return parallelogram;
}

// utility function for a tile that is wall shaped.
export function getWallDimensions(mesh, facing) {
  const geometry = getMeshGeometry(mesh);

  let smallestX = geometry.topPoint.x;
  let largestX = geometry.topPoint.x;
  let smallestY = geometry.topPoint.y;
  let largestY = geometry.topPoint.y;
  for (const point of geometry.points) {
    if (point.x < smallestX) smallestX = point.x;
    if (point.x > largestX) largestX = point.x;
    if (point.y < smallestY) smallestY = point.y;
    if (point.y > largestY) largestY = point.y;
  }

  // center of the footprint and used to compare depth, 
  const anchorPoint = geometry.centerPoint;

  // a baseline is the middle line that cut the footprint half along the length and going through the anchor point.
  const baselineStartPoint = geometry.bottomPoint;
  let baselineEndPoint;
  if (facing === "south east") {
    baselineEndPoint =
      Math.abs(geometry.rightPoint.x - geometry.bottomPoint.x) >=
      Math.abs(geometry.leftPoint.x - geometry.bottomPoint.x)
        ? geometry.rightPoint
        : geometry.leftPoint;
  } else if (facing === "south west") {
    baselineEndPoint =
      Math.abs(geometry.rightPoint.y - geometry.bottomPoint.y) >=
      Math.abs(geometry.leftPoint.y - geometry.bottomPoint.y)
        ? geometry.rightPoint
        : geometry.leftPoint;
  } else {
    return undefined;
  }

  // the back edge is the parallelogram edge opposite the baseline: it starts
  // at the bottom vertex's other neighbour and ends at the top vertex
  const backStartPoint =
    baselineEndPoint === geometry.rightPoint
      ? geometry.leftPoint
      : geometry.rightPoint;
  const backEndPoint = geometry.topPoint;

  // the vector from the baseline to the back edge carries the parallelogram's
  // height, slant included
  const backShift = {
    x: backStartPoint.x - baselineStartPoint.x,
    y: backStartPoint.y - baselineStartPoint.y,
  };

  const length = Math.hypot(
    baselineEndPoint.x - baselineStartPoint.x,
    baselineEndPoint.y - baselineStartPoint.y
  );
  const baselineUnit = {
    x: (baselineEndPoint.x - baselineStartPoint.x) / length,
    y: (baselineEndPoint.y - baselineStartPoint.y) / length,
  };

  const depth = Math.abs(
    backShift.x * baselineUnit.y - backShift.y * baselineUnit.x
  );

  const runExtension = {
    x: baselineUnit.x * (depth / 2),
    y: baselineUnit.y * (depth / 2),
  };

  // the det  ection area serves as a boundary to limit where depth sorting happens to avoid sorting placeables nowhere close to each others when its not required
  const detectionArea = [
    { // top right 
      x: backStartPoint.x - runExtension.x,
      y: backStartPoint.y - runExtension.y,
    },
    { // top left 
      x: backEndPoint.x + runExtension.x,
      y: backEndPoint.y + runExtension.y,
    },
    { // bottom left 
      x: baselineEndPoint.x + runExtension.x,
      y: baselineEndPoint.y + runExtension.y,
    },
    { // bottom right
      x: baselineStartPoint.x - runExtension.x,
      y: baselineStartPoint.y - runExtension.y,
    },
  ];

  // top point 
  const detectionMidlineStartPoint = {
    x: (detectionArea[0].x + detectionArea[3].x) / 2,
    y: (detectionArea[0].y + detectionArea[3].y) / 2,
  };

  // bottom point
  const detectionMidlineEndPoint = {
    x: (detectionArea[1].x + detectionArea[2].x) / 2,
    y: (detectionArea[1].y + detectionArea[2].y) / 2,
  };

  // show which direction the tile is facing away from its anchor point
  const facingIndicator = {
    x: anchorPoint.x - backShift.x * 0.5,
    y: anchorPoint.y - backShift.y * 0.5,
  };

  let normal;
  let startPoint;
  let endPoint;
  if (facing === "south east") {
    normal = { x: 0, y: 1 };
    startPoint = { x: smallestX, y: anchorPoint.y };
    endPoint = { x: largestX, y: anchorPoint.y };
  } else {
    normal = { x: -1, y: 0 };
    startPoint = { x: anchorPoint.x, y: smallestY };
    endPoint = { x: anchorPoint.x, y: largestY };
  }

  return {
    length,
    depth,
    anchorPoint,
    startPoint,
    endPoint,
    normal,
    baselineStartPoint,
    baselineEndPoint,
    backStartPoint,
    backEndPoint,
    detectionArea,
    detectionMidlineStartPoint,
    detectionMidlineEndPoint,
    facingIndicator,
  };
}

// return the approximative visual anchor point of a placeable mesh , different from the document anchor point.
export function getSpriteAnchorPoint(mesh) {
  const footprint = getMeshGeometry(mesh);
  return footprint.bottomPoint;
}

// draw mesh height axis line
function getMeshRiseVector(mesh) {
  const meshMatrix = new PIXI.Matrix();
  meshMatrix.setTransform(0, 0, 0, 0,
    mesh.scale.x, mesh.scale.y, mesh.rotation, mesh.skew.x, mesh.skew.y);
  return meshMatrix.apply({ x: 0, y: -mesh.texture.height });
}

//draw a box containing a sprite mesh with variable height ( tokens or block shaped tiles )
export function drawBlockBoundaries(object) {
  cleanupNamedLines("blockBoundaryLine");
  cleanupNamedLines("boundaryLine");
  if (!object?.mesh?.texture) return;
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

// draw an iso box footprint 
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

// draw anchor dot
function drawAnchorPoint(boundaries, anchorPoint) {
  boundaries.lineStyle(2, 0xff69b4, 1);
  boundaries.beginFill(0xff69b4);
  boundaries.drawCircle(anchorPoint.x, anchorPoint.y, 7);
  boundaries.endFill();
}

// return an array of objects containing instructions that can be iterated over for drawPlaceableGeometry() , used together to draw 
// debug boxes around placeables , or visual UI elements to help users configure depth sortable placeables on the canvas.
export function getPlaceableGeometry(mesh, shape, facing) {
  const GREEN = 0x00ff00;

  // action models: each returns one drawing step for drawPlaceableGeometry()
  const lineStyle = (width, alpha) => ({ action: "lineStyle", width, color: GREEN, alpha });
  const beginFill = (alpha) => ({ action: "beginFill", color: GREEN, alpha });
  const endFill = () => ({ action: "endFill" });
  const moveTo = (point) => ({ action: "moveTo", point });
  const lineTo = (point) => ({ action: "lineTo", point });
  const closePath = () => ({ action: "closePath" });
  const drawCircle = (point, radius) => ({ action: "drawCircle", point, radius });

  // small composers built from the action models
  const tracePath = (points, width, alpha) => {
    const steps = [lineStyle(width, alpha), moveTo(points[0])];
    for (const point of points.slice(1)) steps.push(lineTo(point));
    steps.push(closePath());
    return steps;
  };
  const drawLine = (fromPoint, toPoint, width, alpha) => [
    lineStyle(width, alpha),
    moveTo(fromPoint),
    lineTo(toPoint),
  ];
  const drawAnchorDot = (point) => [
    lineStyle(2, 1),
    beginFill(1),
    drawCircle(point, 7),
    endFill(),
  ];

  const parallelogram = getMeshGeometry(mesh);
  const parallelogramPoints = parallelogram.points;

  // for placables with a facing value , a tile that represent a wall in game
  if (shape === "wall") {
    const dimensions = getWallDimensions(mesh, facing);
    if (dimensions) {
      return [
        lineStyle(2, 0.9),
        beginFill(0.08),
        moveTo(dimensions.detectionArea[0]), // top right corner
        lineTo(dimensions.detectionArea[1]), // top left corner
        lineTo(dimensions.detectionArea[2]), // bottom left corner
        lineTo(dimensions.detectionArea[3]), // bottom right corner
        closePath(),
        endFill(),
        ...drawLine(dimensions.detectionMidlineStartPoint, dimensions.detectionMidlineEndPoint, 2, 0.4),
        ...drawLine(dimensions.anchorPoint, dimensions.facingIndicator, 2, 0.4),
        ...drawAnchorDot(dimensions.anchorPoint),
      ];
    }
  }

  // for for everything else, its simply a box 
  const riseVector = getMeshRiseVector(mesh);
  const risenPoints = parallelogramPoints.map((point) => ({
    x: point.x + riseVector.x,
    y: point.y + riseVector.y,
  }));

  const steps = [...tracePath(parallelogramPoints, 2, 0.9)];
  for (let i = 0; i < parallelogramPoints.length; i++) {
    steps.push(...drawLine(parallelogramPoints[i], risenPoints[i], 2, 0.9));
  }
  steps.push(...tracePath(risenPoints, 2, 0.45));
  steps.push(...drawAnchorDot(parallelogram.bottomPoint));
  return steps;
}

// iterate over the an array of istructuctions provided by getPlaceableGeometry() , create a shape and return it to be used by renderPlaceableGeometry()
export function drawPlaceableGeometry(steps) {
  const shape = new PIXI.Graphics();
  for (const step of steps) {
    switch (step.action) {
      case "lineStyle":
        shape.lineStyle(step.width, step.color, step.alpha);
        break;
      case "beginFill":
        shape.beginFill(step.color, step.alpha);
        break;
      case "endFill":
        shape.endFill();
        break;
      case "moveTo":
        shape.moveTo(step.point.x, step.point.y);
        break;
      case "lineTo":
        shape.lineTo(step.point.x, step.point.y);
        break;
      case "closePath":
        shape.closePath();
        break;
      case "drawCircle":
        shape.drawCircle(step.point.x, step.point.y, step.radius);
        break;
      default:
        console.warn(`drawPlaceableGeometry: unknown action "${step.action}"`);
    }
  }
  return shape;
}

let placeableShapeList = [];

// take an array of sortableSprites, and render boxes or walls footprints if the sortableSprites have a facing value , otherwise draw a box around them
export function renderPlaceableGeometry(sortableSprites) {
  clearPlaceableGeometry();
  for (const sprite of sortableSprites) {
    if (!sprite?.mesh?.texture) continue;
    const facing = sprite.isFacing();
    const shape =
      facing === "south west" || facing === "south east" ? "wall" : "box";
    const steps = getPlaceableGeometry(sprite.mesh, shape, facing);
    const drawnShape = drawPlaceableGeometry(steps);
    drawnShape.name = sprite.id;
    canvas.stage.addChild(drawnShape);
    placeableShapeList.push(drawnShape);
  }
}

// clear all the pixi drawings in placeableShapeList
export function clearPlaceableGeometry() {
  for (const shape of placeableShapeList) {
    if (!shape.destroyed) shape.destroy();
  }
  placeableShapeList = [];
}

// window.getWallDimensions = getWallDimensions;
// window.getMeshGeometry = getMeshGeometry;