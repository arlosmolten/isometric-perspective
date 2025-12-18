import { isometricModuleConfig } from './consts.js';
import { ISOMETRIC_CONST, PROJECTION_TYPES, DEFAULT_PROJECTION } from './consts.js';

export function registerHUDConfig() {

}

export function handleRenderTokenHUD(hud, html, data) {
  const scene = game.scenes.current;
  const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  const isometricWorldEnabled = game.settings.get(isometricModuleConfig.MODULE_ID, "worldIsometricFlag");

  if (isometricWorldEnabled && isSceneIsometric) {
    requestAnimationFrame(() => adjustHUDPosition(hud, html));
  }
}

export function handleRenderTileHUD(hud, html, data) {
  const scene = game.scenes.current;
  const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  const isometricWorldEnabled = game.settings.get(isometricModuleConfig.MODULE_ID, "worldIsometricFlag");

  if (isometricWorldEnabled && isSceneIsometric) {
    requestAnimationFrame(() => adjustHUDPosition(hud, html));
  }
}




// Function to calculate the isometric position relative to the grid
// Best for Tokens which should stay anchored to their grid location despite art offsets.
export function calculateIsometricPosition(x, y) {
  const rotation = ISOMETRIC_CONST.HudAngle;
  const isoX =        (x + y) * Math.cos(rotation);
  const isoY = (-1) * (x - y) * Math.sin(rotation);
  return { x: isoX, y: isoY };
}

// Final HUD adjustment logic using a hybrid approach
export function adjustHUDPosition(hud, html) {
  const object = hud.object;
  if (!object) return;

  const documentName = object.document.documentName;

  if (documentName === "Token") {
    // Restore the proven trig-based calculation for tokens
    const targetPos = calculateIsometricPosition(object.document.x, object.document.y);

    Object.assign(html.style, {
      left: `${targetPos.x}px`,
      top:  `${targetPos.y}px`,
      transform: 'translate(33%, -50%)' 
    });

    if (isometricModuleConfig.DEBUG_PRINT) {
      console.log("Token HUD (Trig):", targetPos);
    }
  }
  
  else if (documentName === "Tile") {
    const mesh = object.mesh;
    if (!mesh) return;

    // Keep the scale-aware mesh-based projection for tiles as it was confirmed working
    const meshGlobal = mesh.toGlobal({x: 0, y: 0});
    const parent = html.parentElement || document.body;
    const parentRect = parent.getBoundingClientRect();
    const zoom = canvas.stage.scale.x;

    const targetPos = {
      x: (meshGlobal.x - parentRect.left) / zoom,
      y: (meshGlobal.y - parentRect.top) / zoom
    };

    Object.assign(html.style, {
      left: `${targetPos.x}px`,
      top: `${targetPos.y}px`,
      transform: 'translate(-50%, -50%)' 
    });

    if (isometricModuleConfig.DEBUG_PRINT) {
      console.log("Tile HUD (Mesh):", targetPos);
    }
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
  console.log("obj", obj);

  // Aplica a transformação com setTransform
  obj.setTransform(x_iso, y_iso, 0, 0, 1, 1, -rotation, skewX, skewY);

  // A matriz de transformação do objeto agora contém rotação e skew
  const matrix = obj.transform.worldTransform;

  // Inverter a matriz para reverter a transformação
  const invertedMatrix = matrix.invert();
  console.log(matrix);
  console.log(invertedMatrix);

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