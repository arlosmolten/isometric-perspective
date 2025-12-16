import { isometricModuleConfig, ISOMETRIC_CONST } from './consts.js';
import { applyIsometricTransformation, updateTokenVisuals } from './transform.js';
import { 
  cartesianToIso, 
  adjustInputWithMouseDrag,
  parseNum,
  isoToCartesian , 
  getFlagName 
} from './utils.js';

export async function createTokenIsometricTab(app, html, data) {

  const label = game.i18n.localize("isometric-perspective.tab_isometric_name");
  const tabGroup = "sheet";
  const tabId = "isometric";
  const icon = "fas fa-cube"
  const isoTemplatePath = 'modules/isometric-perspective/templates/token-config.hbs'

  // Token config data
  const FoundryTokenConfig = foundry.applications.sheets.TokenConfig;
  const DefaultTokenConfig = Object.values(CONFIG.Token.sheetClasses.base).find((d) => d.default)?.cls;
  const TokenConfig = DefaultTokenConfig?.prototype instanceof FoundryTokenConfig ? DefaultTokenConfig : FoundryTokenConfig;
  
  // Adding the isometric tab data to the scene config parts
  TokenConfig.TABS.sheet.tabs.push({ id: tabId, group: tabGroup, label , icon: icon }); 
  
  // Adding the part template
  TokenConfig.PARTS.isometric = {template: isoTemplatePath};

  const footerPart = TokenConfig.PARTS.footer;
  delete TokenConfig.PARTS.footer;
  TokenConfig.PARTS.footer = footerPart;

  // Override part context to include the isometric-perspective config data
  const defaultRenderPartContext = TokenConfig.prototype._preparePartContext;
  TokenConfig.prototype._preparePartContext = async function(partId, context, options) {
    if (partId === "isometric") {
      const flags = this.document.flags[isometricModuleConfig.MODULE_ID] ?? null;
      return {
        ...(flags ?? {}),
        document: this.document,
        tab: context.tabs[partId],
      }
    }
    return defaultRenderPartContext.call(this, partId, context, options);
  }  
    
}

export function initTokenForm (app, html, context, options) {

  const currentAnchorX = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'isoAnchorX');
  const currentAnchorY = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'isoAnchorY');
  const currentOffsetX = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'offsetX');
  const currentOffsetY = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'offsetY');
  const currentScale = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'scale');

  const inputTextureAnchorX = html.querySelector('input[name="texture.anchorX"]');
  const inputTextureAnchorY = html.querySelector('input[name="texture.anchorY"]');
  const inputIsoAnchorX = html.querySelector('input[name="flags.isometric-perspective.isoAnchorX"]');
  const inputIsoAnchorY = html.querySelector('input[name="flags.isometric-perspective.isoAnchorY"]');
  const inputOffsetX = html.querySelector('input[name="flags.isometric-perspective.offsetX"]');
  const inputOffsetY = html.querySelector('input[name="flags.isometric-perspective.offsetY"]');
  const inputScale = html.querySelector('range-picker[name="flags.isometric-perspective.scale"]');

  inputTextureAnchorX.value = currentAnchorX ?? 0.5;
  inputTextureAnchorY.value = currentAnchorY ?? 0.5;
  inputIsoAnchorX.value = currentAnchorX ?? 0.5;
  inputIsoAnchorY.value = currentAnchorY ?? 0.5;
  inputOffsetX.value = currentOffsetX ?? 0;
  inputOffsetY.value = currentOffsetY ?? 0;
  inputScale.value = currentScale ?? 1;

  const resetAlignementButton = html.querySelector('.toggle-alignment-lines');
  resetAlignementButton.addEventListener("click", async (event) => {
    event.preventDefault();
    inputTextureAnchorX.value = 0.5;
    inputTextureAnchorY.value = 0.5;
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

export function handleDeleteToken(token) {
  updateTokenVisuals(token);
}

export function addPrecisionTokenArtListener(app, html, context, options){

  const artOffsetConfig = {
    inputX : html.querySelector('input[name="flags.isometric-perspective.offsetX"]'),
    inputY : html.querySelector('input[name="flags.isometric-perspective.offsetY"]'),
    dragStartX: 0,
    dragStartY: 0,
    originalX: 0,
    originalY: 0,
    isDragging: false,
    adjustmentX: 1,
    adjustmentY: 1
  }

  const anchorOffsetConfig = {
    inputX : html.querySelector('input[name="flags.isometric-perspective.isoAnchorX"]'),
    inputY : html.querySelector('input[name="flags.isometric-perspective.isoAnchorY"]'),
    dragStartX: 0,
    dragStartY: 0,
    originalX: 0,
    originalY: 0,
    isDragging: false,
    showAlignmentLines: false,
    adjustmentX: 0.01,
    adjustmentY: 0.01
  }

  let alignmentLines; // used to be graphics but also the function create its own graphics object which is confusing
  let isAdjustingAnchor = false;

  const fineArtOffsetAdjustButton = html.querySelector('.fine-adjust');
  const fineAnchorOffsetAdjustButton = html.querySelector('.fine-adjust-anchor');
  const isoAnchorToggleCheckbox = html.querySelector('.anchor-toggle-checkbox');

  const offsetX = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'offsetX') ?? 0;
  const offsetY = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'offsetY') ?? 0;
  const isoAnchorY = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'isoAnchorY') ?? 0;
  const isoAnchorX = app.document.getFlag(isometricModuleConfig.MODULE_ID, 'isoAnchorX') ?? 0;

  //prevent form submission
  fineArtOffsetAdjustButton.addEventListener('click', (event) => {
    event.preventDefault();
  })

  fineAnchorOffsetAdjustButton.addEventListener('click', (event) => {
    event.preventDefault();
  })

  // start tracking mouse movements on mousedown on the fine adjust button
  fineArtOffsetAdjustButton.addEventListener('mousedown', (event) => {
    event.preventDefault();
    artOffsetConfig.isDragging = true;
    artOffsetConfig.dragStartX = event.clientX;
    artOffsetConfig.dragStartY = event.clientY;
    artOffsetConfig.originalX = parseNum(artOffsetConfig.inputX);
    artOffsetConfig.originalY = parseNum(artOffsetConfig.inputY);
  });
  
  // start tracking mouse movements on mousedown on the fine adjust button
  fineAnchorOffsetAdjustButton.addEventListener('mousedown', (event) => {
    event.preventDefault();
    anchorOffsetConfig.isDragging = true;
    anchorOffsetConfig.dragStartX = event.clientX;
    anchorOffsetConfig.dragStartY = event.clientY;
    anchorOffsetConfig.originalX = parseNum(anchorOffsetConfig.inputX);
    anchorOffsetConfig.originalY = parseNum(anchorOffsetConfig.inputY);
    alignmentLines = drawAlignmentLines(updateIsoAnchor(anchorOffsetConfig, anchorOffsetConfig, anchorOffsetConfig, anchorOffsetConfig));
  });

  // start tracking mouse movements when the mouse button is released anywhere in the entire window
  window.addEventListener('mouseup', (event) => {
    event.preventDefault();
    artOffsetConfig.isDragging = false;
    anchorOffsetConfig.isDragging = false;
  });
  
  window.addEventListener('mousemove', (event)=>{
    adjustInputWithMouseDrag(event,artOffsetConfig);
    if(isAdjustingAnchor){
      adjustInputWithMouseDrag(event,anchorOffsetConfig);
    }
  })

  isoAnchorToggleCheckbox.addEventListener('change', (event)=> {
    isAdjustingAnchor = !isAdjustingAnchor;

    if(isAdjustingAnchor){
      alignmentLines = drawAlignmentLines(updateIsoAnchor(isoAnchorX, isoAnchorY, offsetX, offsetY))
    } else {
      cleanup();
    }
    
  })

  //Update the lines when changing the inputs // bug here, its not following the art offset
  artOffsetConfig.inputX.addEventListener('change',updateOffset);
  artOffsetConfig.inputY.addEventListener('change',updateOffset);
  anchorOffsetConfig.inputX.addEventListener('change',updateOffset);
  anchorOffsetConfig.inputY.addEventListener('change',updateOffset);

  async function updateOffset(){
    if(isAdjustingAnchor){
      const currentOffsetX = artOffsetConfig.inputX.value;
      const currentOffsetY = artOffsetConfig.inputY.value;
      const currentIsoAnchorX  = anchorOffsetConfig.inputX.value;
      const currentIsoAnchorY = anchorOffsetConfig.inputY.value;
      alignmentLines = drawAlignmentLines(updateIsoAnchor(currentIsoAnchorX, currentIsoAnchorY, currentOffsetX, currentOffsetY));
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

  // Function to calculate the alignment point
  function updateIsoAnchor(isoAnchorX, isoAnchorY, offsetX, offsetY) {
    let tokenMesh = app.token.object.mesh;
    if (!tokenMesh) return { x: 0, y: 0 };
    
    // Defines the values ​​and transforms strings into numbers
    let textureValues = cartesianToIso(
      tokenMesh.height,
      tokenMesh.width
    );
    let isoAnchors = cartesianToIso(
      parseFloat(isoAnchorX) * tokenMesh.height,
      parseFloat(isoAnchorY) * tokenMesh.width
    );
    let isoOffsets = cartesianToIso(
      parseFloat(offsetX), 
      parseFloat(offsetY)
    );

    return {
      x: (tokenMesh.x - textureValues.x/2) + isoOffsets.x + isoAnchors.x,
      y: (tokenMesh.y - textureValues.y/2) + isoOffsets.y + isoAnchors.y
    };
  };

  // Function to remove the lines
  function cleanup() {
    const existingLines = canvas.stage.children.filter(child => child.name === 'tokenAlignmentLine');
    existingLines.forEach(line => line.destroy());
  };
}

//Removes all lines when clicking on update token
// html.querySelector('button[type="submit"]').on('click', () => {
//   if (!isoAnchorToggleCheckbox.prop("checked")) {
//     cleanup();
//   } else {
//     // Take updated values ​​directly from inputs
//     let currentIsoAnchorX = html.querySelector('input[name="flags.isometric-perspective.isoAnchorX"]').val();
//     let currentIsoAnchorY = html.querySelector('input[name="flags.isometric-perspective.isoAnchorY"]').val();
    
//     // Update the anchor basic values ​​in the token configuration
//     html.querySelector('input[name="texture.anchorX"]').val(currentIsoAnchorY);
//     html.querySelector('input[name="texture.anchorY"]').val(1-currentIsoAnchorX);
//   }
// });

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
