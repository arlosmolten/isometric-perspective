import { isometricModuleConfig, ISOMETRIC_CONST } from './consts.js';
import { applyIsometricTransformation, updateTokenVisuals, removeTokenVisuals } from './transform.js';
import {
  cartesianToIso, 
  adjustInputWithMouseDrag,
  parseNum,
  patchConfig,
  isoToCartesian, 
  getFlagName,
  calculateTokenSortValue,
  createAdjustableButton
} from './utils.js';

/**
 * Patch Token.prototype._refreshSort to ensure isometric tokens always use
 * our custom depth sorting, even when selected.
 */
function patchTokenSorting() {
  const originalRefreshSort = foundry.canvas.placeables.Token.prototype._refreshSort;
  foundry.canvas.placeables.Token.prototype._refreshSort = function() {
    // If isometric is enabled for this scene, use our custom sort
    const isSceneIsometric = this.scene?.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
    const autoSortEnabled = game.settings.get(isometricModuleConfig.MODULE_ID, "enableAutoSorting");
    
    if (isSceneIsometric && autoSortEnabled) {
      this.mesh.zIndex = calculateTokenSortValue(this);
      if (this.controlled) this.mesh.zIndex += 0.1; // Minimal boost for selection visibility without breaking depth
    } else {
      return originalRefreshSort.apply(this);
    }
  };
}

// Execute patch
patchTokenSorting();

export async function createTokenIsometricTab(app, html, data) {

  const tokenTabConfig = {
    moduleConfig: isometricModuleConfig,
    label: game.i18n.localize("isometric-perspective.tab_isometric_name"),
    tabGroup : "sheet",
    tabId : "isometric",
    icon: "fas fa-cube",
    templatePath: 'modules/isometric-perspective/templates/token-config.hbs'
  }

  // Patch TokenConfig (for live tokens)
  const FoundryTokenConfig = foundry.applications.sheets.TokenConfig;
  const DefaultTokenConfig = Object.values(CONFIG.Token.sheetClasses.base).find((d) => d.default)?.cls;
  const TokenConfig = DefaultTokenConfig?.prototype instanceof FoundryTokenConfig ? DefaultTokenConfig : FoundryTokenConfig;
  patchConfig(TokenConfig,tokenTabConfig);

  // Patch PrototypeTokenConfig (for prototype tokens in actor sheets)
  const PrototypeTokenConfig = foundry.applications.sheets.PrototypeTokenConfig;
  if (PrototypeTokenConfig && PrototypeTokenConfig !== TokenConfig) {
    patchConfig(PrototypeTokenConfig,tokenTabConfig);
  }
    
}

export function initTokenForm (app, html, context, options) {

  const tokenDoc = app.token ?? app.document ?? app.object;
  if (!tokenDoc) return;

  const currentAnchorX = tokenDoc.getFlag(isometricModuleConfig.MODULE_ID, 'isoAnchorX');
  const currentAnchorY = tokenDoc.getFlag(isometricModuleConfig.MODULE_ID, 'isoAnchorY');
  const currentOffsetX = tokenDoc.getFlag(isometricModuleConfig.MODULE_ID, 'offsetX');
  const currentOffsetY = tokenDoc.getFlag(isometricModuleConfig.MODULE_ID, 'offsetY');
  const currentScale = tokenDoc.getFlag(isometricModuleConfig.MODULE_ID, 'scale');

  // const inputTextureAnchorX = html.querySelector('input[name="texture.anchorX"]');
  // const inputTextureAnchorY = html.querySelector('input[name="texture.anchorY"]');
  const inputIsoAnchorX = html.querySelector('input[name="flags.isometric-perspective.isoAnchorX"]');
  const inputIsoAnchorY = html.querySelector('input[name="flags.isometric-perspective.isoAnchorY"]');
  const inputOffsetX = html.querySelector('input[name="flags.isometric-perspective.offsetX"]');
  const inputOffsetY = html.querySelector('input[name="flags.isometric-perspective.offsetY"]');
  const inputScale = html.querySelector('range-picker[name="flags.isometric-perspective.scale"]');

  inputIsoAnchorX.value = currentAnchorX ?? 0.5;
  inputIsoAnchorY.value = currentAnchorY ?? 0.5;
  inputOffsetX.value = currentOffsetX ?? 0;
  inputOffsetY.value = currentOffsetY ?? 0;
  inputScale.value = currentScale ?? 1;

  const resetAlignementButton = html.querySelector('.toggle-alignment-lines');
  resetAlignementButton.addEventListener("click", async (event) => {
    event.preventDefault();
    inputIsoAnchorX.value = 0.5;
    inputIsoAnchorY.value = 0.5;
    inputOffsetX.value = 0;
    inputOffsetY.value = 0;
    inputScale.value = 1;
  });
}

export function handleCreateToken(tokenDocument) {
  const token = canvas.tokens.get(tokenDocument.id);
  if (!token) return;
  
  const isSceneIsometric = token.scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  applyIsometricTransformation(token, isSceneIsometric);
}

export function handleUpdateToken(tokenDocument, updateData, options, userId) {
  const token = canvas.tokens.get(tokenDocument.id);
  if (!token) return;
  
  const isSceneIsometric = token.scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  applyIsometricTransformation(token, isSceneIsometric);
  
  /*if (updateData.flags?.[isometricModuleConfig.MODULE_ID] ||
      updateData.x !== undefined ||
      updateData.y !== undefined ) {
        applyIsometricTransformation(token, isSceneIsometric);
  }*/

  if (isometricModuleConfig.DEBUG_PRINT) console.log("Hooks.on token.js updateToken");
}

export function handleRefreshToken(token) {
  const isSceneIsometric = token.scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  applyIsometricTransformation(token, isSceneIsometric);
  
  if (isometricModuleConfig.DEBUG_PRINT) console.log("Hooks.on token.js refreshToken");
}



export function addPrecisionTokenArtListener(app, html, context, options){

  // --- 1. Art Offset Configuration ---
  createAdjustableButton({
    buttonElement: html.querySelector('.fine-adjust'),
    inputs: [
      html.querySelector('input[name="flags.isometric-perspective.offsetX"]'),
      html.querySelector('input[name="flags.isometric-perspective.offsetY"]')
    ],
    adjustmentScale: [0.1, 0.1],
    roundingPrecision: 2,
    inputStep: 0.01
  });

  // --- 2. Anchor Offset Configuration ---
  const inputIsoAnchorX = html.querySelector('input[name="flags.isometric-perspective.isoAnchorX"]');
  const inputIsoAnchorY = html.querySelector('input[name="flags.isometric-perspective.isoAnchorY"]');
  const isoAnchorToggleCheckbox = html.querySelector('input[name="isoAnchorToggle"]');

  let alignmentLines; 

  // Helper to redraw lines
  function redrawLines(){
       cleanup();
       // Note: updateIsoAnchor logic remains same, it reads from inputs
       const newPos = updateIsoAnchor(inputIsoAnchorX.value, inputIsoAnchorY.value);
       alignmentLines = drawAlignmentLines(newPos);
  };

  createAdjustableButton({
    buttonElement: html.querySelector('.fine-adjust-anchor'),
    inputs: [inputIsoAnchorX, inputIsoAnchorY],
    // Dynamic scale function to handle flipped tokens
    adjustmentScale: () => {
      let tokenMesh = app.token?.object?.mesh;
      const signY = Math.sign(tokenMesh?.scale.y || 1);
      const signX = Math.sign(tokenMesh?.scale.x || 1);
      // Anchor X (index 0) uses Mesh Scale Y sign
      // Anchor Y (index 1) uses Mesh Scale X sign
      return [ 0.001 * signY, 0.001 * signX ];
    },
    roundingPrecision: 3, 
    valueConstraints: { min: 0, max: 1 },
    onInputCallback: redrawLines,
    onDragEnd: () => {
       if (!isoAnchorToggleCheckbox?.checked) cleanup();
    },
    inputStep: 0.001
  });

  const artOffsetConfig = {
      inputX : html.querySelector('input[name="flags.isometric-perspective.offsetX"]'),
      inputY : html.querySelector('input[name="flags.isometric-perspective.offsetY"]'), 
  };
  
  const anchorOffsetConfig = {
      inputX : inputIsoAnchorX,
      inputY : inputIsoAnchorY,
  };

  if(isoAnchorToggleCheckbox) {
      isoAnchorToggleCheckbox.addEventListener('change', (event)=> {
        updateOffset();
      })
  }

  // Update the lines when changing the inputs
  if(artOffsetConfig.inputX) artOffsetConfig.inputX.addEventListener('change',updateOffset);
  if(artOffsetConfig.inputY) artOffsetConfig.inputY.addEventListener('change',updateOffset);
  if(anchorOffsetConfig.inputX) anchorOffsetConfig.inputX.addEventListener('change',updateOffset);
  anchorOffsetConfig.inputX.addEventListener('change',updateOffset);
  anchorOffsetConfig.inputY.addEventListener('change',updateOffset);

  async function updateOffset(){ 
    if(isoAnchorToggleCheckbox.checked || artOffsetConfig.isDragging || anchorOffsetConfig.isDragging){
      const currentIsoAnchorX  = anchorOffsetConfig.inputX.value;
      const currentIsoAnchorY = anchorOffsetConfig.inputY.value;
      
      alignmentLines = drawAlignmentLines(updateIsoAnchor(currentIsoAnchorX, currentIsoAnchorY));
    } else {
      cleanup();
    }
  }

  // Function to draw alignment lines
  function drawAlignmentLines(isoAnchor) {
    // Removes existing lines
    cleanup();
    
    // Create container for the lines
    const graphics = new PIXI.Graphics();
    graphics.name = 'tokenAlignmentLine';
    graphics.lineStyle(1, 0xFF0000, 0.75); // Largura, Cor, Opacidade

    // Calculate diagonal length
    const canvasWidth = canvas.dimensions.width;
    const canvasHeight = canvas.dimensions.height;
    const diagonalLength = Math.sqrt(Math.pow(canvasWidth, 2) + Math.pow(canvasHeight, 2));

    // Draw lines
    graphics.moveTo(isoAnchor.x - diagonalLength / 2, isoAnchor.y - diagonalLength / 2);
    graphics.lineTo(isoAnchor.x + diagonalLength / 2, isoAnchor.y + diagonalLength / 2);
    
    graphics.moveTo(isoAnchor.x - diagonalLength / 2, isoAnchor.y + diagonalLength / 2);
    graphics.lineTo(isoAnchor.x + diagonalLength / 2, isoAnchor.y - diagonalLength / 2);

    // Add on canvas
    canvas.stage.addChild(graphics);
    return graphics;
  };

  // Removes all lines when clicking on update token
  html.querySelector('button[type="submit"]').addEventListener('click', () => {
    if (!isoAnchorToggleCheckbox.checked) {
      cleanup();
    } else {
      // Take updated values directly from inputs
      let currentIsoAnchorX = anchorOffsetConfig.inputX.value;
      let currentIsoAnchorY = anchorOffsetConfig.inputY.value;
      
      // Update the anchor basic values in the token configuration
      // Note: V12 logic used weird rotation mapping: texture.anchorX = isoY, texture.anchorY = 1-isoX
      const textureAnchorX = html.querySelector('input[name="texture.anchorX"]');
      const textureAnchorY = html.querySelector('input[name="texture.anchorY"]');
      
      if (textureAnchorX) textureAnchorX.value = currentIsoAnchorY;
      if (textureAnchorY) textureAnchorY.value = (1 - currentIsoAnchorX);
    }
  });

  //Changes the Close method to delete the lines, IF avoids changing the method more than once
  if (!app._isCloseModified) {
    const originalClose = app.close;
    app.close = async function (options) {
      cleanup();
      await originalClose.apply(this, [options]);
    };

    // Mark that the close method has already been
    app._isCloseModified = true;
  }

  function updateIsoAnchor(isoAnchorX, isoAnchorY) {
    let tokenMesh = app.token.object.mesh;
    if (!tokenMesh) return { x: 0, y: 0 };

    // 1. Determine the "Current Real" Iso Coordinates based on the actual mesh anchor
    // Invert the logic used in the submit handler: 
    // texture.anchorX = isoY  =>  isoY = texture.anchorX
    // texture.anchorY = 1-isoX => isoX = 1 - texture.anchorY
    const currentRealIsoAnchorX = 1 - tokenMesh.anchor.y;
    const currentRealIsoAnchorY = tokenMesh.anchor.x;

    // 2. Calculate Deltas (Target - Real)
    // Note inputs are strings, parse them
    const dIsoAnchorX = parseFloat(isoAnchorX) - currentRealIsoAnchorX;
    const dIsoAnchorY = parseFloat(isoAnchorY) - currentRealIsoAnchorY;
    
    // 3. Convert Deltas to Screen Coordinates
    // Anchor deltas are multiplied by texture size AND Scale to match visual space
    const screenDeltaAnchors = cartesianToIso(
      dIsoAnchorX * tokenMesh.texture.height * tokenMesh.scale.y,
      dIsoAnchorY * tokenMesh.texture.width * tokenMesh.scale.x
    );
    
    // 4. Apply to current Mesh Position
    return {
      x: tokenMesh.x + screenDeltaAnchors.x,
      y: tokenMesh.y + screenDeltaAnchors.y
    };
  }

  // remove the alignment lines
  function cleanup() {
    const existingLines = canvas.stage.children.filter(child => child.name === 'tokenAlignmentLine');
    existingLines.forEach(line => line.destroy());
  };
}

/*
// ----------------- Enhanced Token Configuration -----------------
// --- TokenPrecisionConfig adjust the scale (ratio) to has step of 0.01 instead of 0.1,
// --- and EnhancedAnchorInput adjust the anchor X and Y to has steps of 0.01 instead of 1

// Ajusta a precisão de configurações de token no Foundry VTT
export class TokenPrecisionConfig {
  // Ajusta o incremento de Scale (Ratio) para 0.01
  static adjustScaleRatio() {
    const scaleInput = document.querySelector('input[name="scale"]');
    if (scaleInput) {
      scaleInput.step = '0.01';
      scaleInput.min = '0.1';
      //console.log('Scale input adjusted', scaleInput);
    } else {
      console.warn('Scale input not found');
    }
  }

  // Ajusta o incremento de Anchor para 0.01
  static adjustAnchorIncrement() {
    // Seletores específicos para os inputs de anchor na aba Appearance
    const anchorInputSelectors = ['input[name="texture.anchorX"]', 'input[name="texture.anchorY"]'];

    let foundInputs = false;

    anchorInputSelectors.forEach(selector => {
      const inputs = document.querySelectorAll(selector);
      
      if (inputs.length > 0) {
        //console.log(`Found inputs for selector: ${selector}`, inputs);
        inputs.forEach(input => {
          input.step = '0.01';
          input.min = '0';
          input.max = '1';
        });
        foundInputs = true;
      }
    });

    if (!foundInputs) {
      console.warn('No texture anchor inputs found. Token configuration might have different selectors.');
      
      // Log all inputs in the token config for debugging
      //const allInputs = document.querySelectorAll('input');
      //console.log('All inputs in the document:', allInputs);
    }
  }

  // Método principal para inicializar todas as configurações de precisão
  static initialize() {
    // Aguarda um breve momento para garantir que o DOM esteja carregado
    Hooks.on('renderTokenConfig', (tokenConfig, html, data) => {
      //console.log('Token Config Rendered', {tokenConfig, html, data});
      
      // Pequeno delay para garantir que todos os elementos estejam prontos
      setTimeout(() => {
        this.adjustScaleRatio();
        this.adjustAnchorIncrement();
      }, 100);
    });
  }
}

// Inicializa as configurações de precisão ao carregar o módulo
TokenPrecisionConfig.initialize();
*/

/*
export class EnhancedAnchorInput {
  // Cria botões de controle e configura listeners para ajuste refinado
  static enhanceAnchorInputs(inputs) {
    // Verifica se o wrapper já existe
    let wrapper = inputs[0].parentNode;
    if (wrapper.classList.contains('enhanced-anchor-wrapper')) {
      // Se existir, remove o wrapper e seus filhos
      wrapper.parentNode.replaceChild(inputs[0], wrapper);
      wrapper.parentNode.replaceChild(inputs[1], wrapper.lastElementChild);
    }
    
    // Contêiner principal para envolver os inputs e botão
    wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '5px';

    // Adiciona os inputs e botão
    let anchorXInput = inputs[0].cloneNode(true);
    let anchorYInput = inputs[1].cloneNode(true);

    // Configura inputs clonados
    anchorXInput.style.flexGrow = '1';
    anchorYInput.style.flexGrow = '1';
    anchorXInput.removeAttribute('min');
    anchorXInput.removeAttribute('max');
    anchorYInput.removeAttribute('min');
    anchorYInput.removeAttribute('max');

    // Criar botão de ajuste fino com ícone de 4 direções
    const adjustButton = document.createElement('button');
    adjustButton.innerHTML = '✥'; // Ícone de movimento 4 direções
    adjustButton.type = 'button';
    adjustButton.style.cursor = 'pointer';
    adjustButton.style.padding = '2px 5px';
    adjustButton.style.border = '1px solid #888';
    adjustButton.style.borderRadius = '3px';
    adjustButton.title = 'Hold and drag to fine-tune X and Y';

    // Estado do ajuste
    let isAdjusting = false;
    let startX = 0;
    let startY = 0;
    let originalValueX = 0;
    let originalValueY = 0;

    // Função para aplicar ajuste
    const applyAdjustment = (e) => {
      if (!isAdjusting) return;

      // Calcula a diferença de movimento nos eixos X e Y
      const deltaX = startX - e.clientX;
      const deltaY = startY - e.clientY;
      
      // Ajuste fino: cada 10px de movimento = 0.01 de valor
      const adjustmentX = deltaX * 0.001;
      const adjustmentY = deltaY * 0.001;
      
      // Calcula novos valores
      let newValueX = originalValueX + adjustmentX;
      let newValueY = originalValueY + adjustmentY;
      
      // Arredonda para 2 casas decimais
      newValueX = Math.round(newValueX * 100) / 100;
      newValueY = Math.round(newValueY * 100) / 100;
      
      // Atualiza os inputs de anchor
      const actualXInput = document.querySelector('input[name="texture.anchorX"]');
      const actualYInput = document.querySelector('input[name="texture.anchorY"]');

      if (actualXInput) {
        actualXInput.value = newValueX.toFixed(2);
        actualXInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (actualYInput) {
        actualYInput.value = newValueY.toFixed(2);
        actualYInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    // Listeners para ajuste
    adjustButton.addEventListener('mousedown', (e) => {
      isAdjusting = true;
      startX = e.clientX;
      startY = e.clientY;
      
      // Obtém os valores originais dos inputs de anchor
      const actualXInput = document.querySelector('input[name="texture.anchorX"]');
      const actualYInput = document.querySelector('input[name="texture.anchorY"]');
      
      originalValueX = actualXInput ? parseFloat(actualXInput.value) : 0;
      originalValueY = actualYInput ? parseFloat(actualYInput.value) : 0;
      
      // Adiciona listeners globais
      document.addEventListener('mousemove', applyAdjustment);
      document.addEventListener('mouseup', () => {
        isAdjusting = false;
        document.removeEventListener('mousemove', applyAdjustment);
      });
      
      e.preventDefault();
    });

    // Adiciona os elementos ao wrapper na ordem: X input, botão, Y input
    wrapper.appendChild(anchorXInput);
    wrapper.appendChild(adjustButton);
    wrapper.appendChild(anchorYInput);

    // Substitui os inputs originais
    const parentContainer = inputs[0].parentNode;
    parentContainer.replaceChild(wrapper, inputs[0]);
    parentContainer.removeChild(inputs[1]);
  }

  // Inicializa a melhoria dos inputs de anchor
  static initialize() {
    Hooks.on('renderTokenConfig', () => {
      setTimeout(() => {
        const anchorXInput = document.querySelector('input[name="texture.anchorX"]');
        const anchorYInput = document.querySelector('input[name="texture.anchorY"]');

        if (anchorXInput && anchorYInput) {
          this.enhanceAnchorInputs([anchorXInput, anchorYInput]);
        }
      }, 100);
    });
  }
}

// Inicializa o módulo de melhoria de inputs
EnhancedAnchorInput.initialize();
*/
