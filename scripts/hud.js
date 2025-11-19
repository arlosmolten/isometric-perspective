import { MODULE_ID, isDebugEnabled, isWorldIsometricEnabled, logDebug } from './config.js';
import { ISOMETRIC_CONST, PROJECTION_TYPES, DEFAULT_PROJECTION } from './consts.js';

export function registerHUDConfig() {
  Hooks.on("renderTokenHUD", handleRenderTokenHUD);
  Hooks.on("renderTileHUD", handleRenderTileHUD);
}

function handleRenderTokenHUD(hud, html, data) {
  const scene = game.scenes.current;
  const isSceneIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const isometricWorldEnabled = isWorldIsometricEnabled();

  if (isometricWorldEnabled && isSceneIsometric) {
    requestAnimationFrame(() => adjustHUDPosition(hud, html));
  }
}

function handleRenderTileHUD(hud, html, data) {
  const scene = game.scenes.current;
  const isSceneIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const isometricWorldEnabled = isWorldIsometricEnabled();

  if (isometricWorldEnabled && isSceneIsometric) {
    requestAnimationFrame(() => adjustHUDPosition(hud, html));
  }
}


// Function to calculate the isometric position, it is like an isoToCartesian
export function calculateIsometricPosition(x, y) {
  // Get rotation values
  const rotation = ISOMETRIC_CONST.HudAngle; //ISOMETRIC_CONST.rotation;  // in rad

  // Apply rotation to the distorted coordinates
  const isoX =        (x + y) * Math.cos(rotation); // Aplique rotação ao eixo X
  const isoY = (-1) * (x - y) * Math.sin(rotation); // Aplique rotação ao eixo Y

  return { x: isoX, y: isoY };
}

export function adjustHUDPosition(hud, html) {
  const element = ensureHTMLElement(html);
  if (!element) return;

  const object = hud.object;
  const { x, y } = object.position;

  /*
  const currentProjection = canvas.scene.getFlag(MODULE_ID, 'projectionType') ?? DEFAULT_PROJECTION;
  const projection = PROJECTION_TYPES[currentProjection];
  let isotranslate;
  switch (projection) {
    case "True Isometric":
      isotranslate = 'translate(33%, -50%)';
      break;
    case "Dimetric":
      isotranslate = 'translate(0%, 0%)';
      break;
    case "Projection 3:2":
      isotranslate = 'translate(0%, 0%)';
      break;
    case "Diablo 1":
      isotranslate = 'translate(33%, -50%)';
      break;
    case "Planescape Torment Style":
      isotranslate = 'translate(33%, -50%)';
      break;
  }
  logDebug('projection', projection);
  */

  if (object instanceof Token) {
    const topCenter = calculateIsometricPosition(x, y);
    applyStyles(element, {
      left: `${topCenter.x}px`,
      top: `${topCenter.y}px`,
      transform: 'translate(33%, -50%)'
    });
  }

  else if (object instanceof Tile) {
    const topCenter = calculateIsometricPosition(x, y);

    applyStyles(element, {
      left: `${topCenter.x}px`,
      top: `${topCenter.y}px`
    });
  }
}








/*
// Função para calcular a posição isométrica
export function calculateIsometricPosition_not(x, y) {
  // Obter valores de rotação e skew
  const rotation = ISOMETRIC_CONST.HudAngle; //ISOMETRIC_CONST.rotation;  // em graus
  const skewX = 0;//ISOMETRIC_CONST.skewX;       // em graus
  const skewY = 0;//ISOMETRIC_CONST.skewY;       // em graus

  // Converter ângulos de graus para radianos
  const rotationRad = rotation * (Math.PI / 180);
  const skewXRad = skewX * (Math.PI / 180);
  const skewYRad = skewY * (Math.PI / 180);

  // 1. Aplicar distorções de skew
  const skewedX = x + y * Math.tan(skewXRad);  // Distorção no eixo X devido ao skewX
  const skewedY = y + x * Math.tan(skewYRad);  // Distorção no eixo Y devido ao skewY

  // 2. Aplicar rotação nas coordenadas distorcidas
  const isoX =        (skewedX + skewedY) * Math.cos(rotationRad);   // Aplique rotação ao eixo X
  const isoY = (-1) * (skewedX - skewedY) * Math.sin(rotationRad); // Aplique rotação ao eixo Y

  // Retornar a posição isométrica calculada
  return { x: isoX, y: isoY };
}

function isometricToCartesianGPT(x_iso, y_iso) {
  // Extrair os parâmetros de transformação
  const rotation = Math.abs(ISOMETRIC_CONST.rotation);
  const skewX = Math.abs(ISOMETRIC_CONST.skewX);
  const skewY = Math.abs(ISOMETRIC_CONST.skewY);
  
  // Cria uma matriz de transformação com base nas rotações e distorções fornecidas
  // Criando um objeto "dummy" para aplicar a transformação
  const obj = new PIXI.Graphics();
  logDebug("obj", obj);

  // Aplica a transformação com setTransform
  obj.setTransform(x_iso, y_iso, 0, 0, 1, 1, -rotation, skewX, skewY);

  // A matriz de transformação do objeto agora contém rotação e skew
  const matrix = obj.transform.worldTransform;

  // Inverter a matriz para reverter a transformação
  const invertedMatrix = matrix.invert();
  logDebug(matrix);
  logDebug(invertedMatrix);

  // Aplicar a inversa da matriz nas coordenadas isométricas
  const cartesian = invertedMatrix.apply({ x: x_iso, y: y_iso });

  return { x: cartesian.x, y: cartesian.y };
}

function isometricToCartesian(isoX, isoY) {
  // Definir parâmetros de transformação
  const rotation = ISOMETRIC_CONST.rotation;
  const skewX = -ISOMETRIC_CONST.skewX;
  const skewY = -ISOMETRIC_CONST.skewY;
  
  // Etapa 1: Reverter a rotação
  const unrotatedX = isoX * Math.cos(rotation) - isoY * Math.sin(rotation);
  const unrotatedY = isoX * Math.sin(rotation) + isoY * Math.cos(rotation);

  // Etapa 2: Reverter o skew em X
  const unskewedX = unrotatedX - unrotatedY * Math.tan(skewX);

  // Etapa 3: Reverter o skew em Y
  const cartesianY = unrotatedY - unskewedX * Math.tan(skewY);
  const cartesianX = unskewedX;

  return { x: cartesianX, y: cartesianY };
}

function isometricToCartesianGPT4o(x, y) {
  const angle = 30; //ISOMETRIC_CONST.rotation;
  const skewX = ISOMETRIC_CONST.skewX;
  const skewY = ISOMETRIC_CONST.skewY;
  const scale = 1; //-ISOMETRIC_CONST.ratio;
  
  // Ajuste de escala
  let adjustedX = x * scale;
  let adjustedY = y * scale;

  // Cálculo dos valores da matriz composta T (com rotação + skewX + skewY)
  const cosTheta = Math.cos(angle);
  const sinTheta = Math.sin(angle);

  // Componentes da matriz composta T
  const a = cosTheta + sinTheta * skewY;
  const b = cosTheta * skewX + sinTheta;
  const c = -sinTheta + cosTheta * skewY;
  const d = -sinTheta * skewX + cosTheta;

  // Determinante de T
  const detT = a * d - b * c;

  if (detT === 0) {
      throw new Error("A matriz de transformação não é invertível");
  }

  // Inversão da matriz T^-1
  const invDetT = 1 / detT;

  // Matrizes inversas
  const a_inv = d * invDetT;
  const b_inv = -b * invDetT;
  const c_inv = -c * invDetT;
  const d_inv = a * invDetT;

  // Aplicando a matriz inversa para encontrar as coordenadas cartesianas
  let cartesianX = a_inv * adjustedX + b_inv * adjustedY;
  let cartesianY = c_inv * adjustedX + d_inv * adjustedY;

  // Retornar as coordenadas cartesianas
  return { x: cartesianX, y: cartesianY };
}
*/

function ensureHTMLElement(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  if (Array.isArray(element)) {
    for (const entry of element) {
      if (entry instanceof HTMLElement) return entry;
    }
  }
  return null;
}

function applyStyles(element, styles) {
  Object.entries(styles).forEach(([key, value]) => {
    element.style[key] = value;
  });
}