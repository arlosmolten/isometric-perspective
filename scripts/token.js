import { MODULE_ID, DEBUG_PRINT, WORLD_ISO_FLAG } from './main.js';
import { applyIsometricTransformation, updateTokenVisuals } from './transform.js';
import { cartesianToIso, isoToCartesian } from './utils.js';
import { ISOMETRIC_CONST } from './consts.js';

export function registerTokenConfig() {
  Hooks.on("renderTokenConfig", handleRenderTokenConfig);
  // Also handle Prototype Token configuration (e.g., from Actor sheet)
  Hooks.on("renderPrototypeTokenConfig", handleRenderTokenConfig);

  Hooks.on("createToken", handleCreateToken);
  Hooks.on("updateToken", handleUpdateToken);
  Hooks.on("refreshToken", handleRefreshToken);
  Hooks.on("deleteToken", handleDeleteToken);
}


async function handleRenderTokenConfig(app, html, data) {
  // Resolve TokenDocument across FVTT versions
  const doc = (
    app.object ??
    app.document ??
    app.token?.document ??
    app.token ??
    app.actor?.prototypeToken ??
    data?.document ??
    data?.object ??
    null
  );
  // Minimal debug to confirm hook execution and tab selectors
  try { console.debug('[isometric-perspective] renderTokenConfig hook fired'); } catch (e) { /* noop */ }
  // If no document, still proceed to inject the tab with default values

  // Ensure jQuery wrapper for html
  const $html = (html && html.jquery) ? html : $(html);

  // Safe getter for flags when doc is missing
  const getFlag = (key, fallback) => (doc && typeof doc.getFlag === 'function' ? doc.getFlag(MODULE_ID, key) : undefined) ?? fallback;

  // Load the HTML template
  const tabHtml = await renderTemplate("modules/isometric-perspective/templates/token-config.html", {
    isoTokenDisabled: getFlag('isoTokenDisabled', 0),
    offsetX: getFlag('offsetX', 0),
    offsetY: getFlag('offsetY', 0),
    isoAnchorY: getFlag('isoAnchorY', 0),
    isoAnchorX: getFlag('isoAnchorX', 0),
    isoAnchorToggle: getFlag('isoAnchorToggle', 0),
    scale: getFlag('scale', 1),
    isoImageSrc: getFlag('isoImageSrc', ''),
    topdownImageSrc: getFlag('topdownImageSrc', '')
  });
  
  // Prefer TokenConfig primary tabs nav
  let tabs = $html.find('nav.sheet-tabs.tabs, nav.sheet-tabs[data-application-part="tabs"]');
  if (!tabs.length) tabs = $html.find('.tabs:not(.secondary-tabs)');
  if (!tabs.length) tabs = $html.find('nav.tabs');
  if (!tabs.length) tabs = $html.find('.tabs');
  const makeLink = () => `<a class="item" data-action="tab" data-group="sheet" data-tab="isometric"><i class="fas fa-cube"></i> ${game.i18n.localize('isometric-perspective.tab_isometric_name')}</a>`;
  const appendLink = ($tabs) => {
    if (!$tabs.length) return;
    if ($tabs.find('a.item[data-tab="isometric"]').length) return; // avoid duplicates
    $tabs.append(makeLink());
  };
  appendLink(tabs);

  // Retry once shortly after render in case other modules re-rendered the sheet
  const doBind = () => {
    if (app._tabs && app._tabs.length) {
      for (const t of app._tabs) {
        try { t.bind($html[0]); } catch (e) { /* noop */ }
      }
    }
  };

  setTimeout(() => {
    let tabs2 = $html.find('nav.sheet-tabs.tabs, .tabs:not(.secondary-tabs), nav.tabs, .tabs');
    appendLink(tabs2);
    if (!$html.find('.tab[data-tab="isometric"]').length) {
      let lastTab2 = $html.find('.tab').last();
      if (lastTab2.length) lastTab2.after(tabHtml);
    }
    doBind();
  }, 0);

  // Second retry to catch late DOM changes from other modules/systems
  setTimeout(() => {
    let tabs3 = $html.find('nav.sheet-tabs.tabs, nav.sheet-tabs[data-application-part="tabs"], .tabs:not(.secondary-tabs), nav.tabs, .tabs');
    appendLink(tabs3);
    if (!$html.find('.tab[data-tab="isometric"]').length) {
      let lastTab3 = $html.find('.tab').last();
      if (lastTab3.length) lastTab3.after(tabHtml);
    }
    doBind();
  }, 100);

  // Insert tab contents after the last .tab panel; fallback to append to .sheet-body
  let lastTab = $html.find('.tab').last();
  if (!$html.find('.tab[data-tab="isometric"]').length) {
    if (lastTab.length) lastTab.after(tabHtml);
    else $html.find('.sheet-body').append(tabHtml);
  }

  // Rebind existing tabs so the new one is recognized; avoid creating new Tabs which can break sheet behavior
  if (app._tabs && app._tabs.length) {
    for (const t of app._tabs) {
      try { t.bind($html[0]); } catch (e) { /* noop */ }
    }
  }

  // Update the offset fine adjustment button
  updateAdjustOffsetButton($html);
  updateAdjustAnchorButton($html);

  // Initializes control values
  const isoTokenCheckbox = $html.find('input[name="flags.isometric-perspective.isoTokenDisabled"]');
  isoTokenCheckbox.prop("checked", !!getFlag('isoTokenDisabled', false));
  const isoScaleDisabled = $html.find('input[name="flags.isometric-perspective.isoScaleDisabled"]');
  isoScaleDisabled.prop("checked", !!getFlag('isoScaleDisabled', false));

  // Add listener to update the shown value from Slider
  $html.find('.scale-slider').on('input', function() {
    $html.find('.range-value').text(this.value);
  });

  // File pickers for alternate art
  const bindPicker = (buttonSelector, inputSelector, flagKey) => {
    const $btn = $html.find(buttonSelector);
    const $inp = $html.find(inputSelector);
    if (!$btn.length || !$inp.length) return;
    $btn.on('click', async (ev) => {
      ev.preventDefault();
      const fp = new FilePicker({
        type: 'image',
        current: $inp.val() || '',
        callback: async (path) => {
          $inp.val(path).trigger('change');
          if (doc?.setFlag && flagKey) {
            try { await doc.setFlag(MODULE_ID, flagKey, String(path)); } catch (e) { /* noop */ }
          }
        },
        top: Math.min(window.innerHeight - 350, (window.screenY || 100) + 150),
        left: Math.min(window.innerWidth - 720, (window.screenX || 100) + 150)
      });
      fp.render(true);
    });
  };
  bindPicker('.file-picker-iso', 'input[name="flags.isometric-perspective.isoImageSrc"]', 'isoImageSrc');
  bindPicker('.file-picker-top', 'input[name="flags.isometric-perspective.topdownImageSrc"]', 'topdownImageSrc');

  // Persist when typing manually into inputs
  const bindImmediatePersist = (inputSelector, flagKey) => {
    const $inp = $html.find(inputSelector);
    if (!$inp.length || !flagKey) return;
    let to;
    $inp.on('input change', () => {
      if (!doc?.setFlag) return;
      clearTimeout(to);
      to = setTimeout(async () => {
        const v = String($inp.val() || '').trim();
        try {
          if (v) await doc.setFlag(MODULE_ID, flagKey, v);
          else await doc.unsetFlag(MODULE_ID, flagKey);
        } catch (e) { /* noop */ }
      }, 150);
    });
  };
  bindImmediatePersist('input[name="flags.isometric-perspective.isoImageSrc"]', 'isoImageSrc');
  bindImmediatePersist('input[name="flags.isometric-perspective.topdownImageSrc"]', 'topdownImageSrc');

  // Numeric persist helper
  const bindImmediatePersistNumber = (inputSelector, flagKey) => {
    const $inp = $html.find(inputSelector);
    if (!$inp.length || !flagKey) return;
    let to;
    $inp.on('input change', () => {
      if (!doc?.setFlag) return;
      clearTimeout(to);
      to = setTimeout(async () => {
        const raw = String($inp.val() ?? '').trim();
        const num = Number(raw);
        try {
          if (raw === '' || !Number.isFinite(num)) await doc.unsetFlag(MODULE_ID, flagKey);
          else await doc.setFlag(MODULE_ID, flagKey, num);
        } catch (e) { /* noop */ }
      }, 150);
    });
  };
  bindImmediatePersistNumber('input[name="flags.isometric-perspective.isoAnchorX"]', 'isoAnchorX');
  bindImmediatePersistNumber('input[name="flags.isometric-perspective.isoAnchorY"]', 'isoAnchorY');
  bindImmediatePersistNumber('input[name="flags.isometric-perspective.offsetX"]', 'offsetX');
  bindImmediatePersistNumber('input[name="flags.isometric-perspective.offsetY"]', 'offsetY');
  bindImmediatePersistNumber('input[name="flags.isometric-perspective.scale"]', 'scale');

  // Handler for the submit form
  $html.find('form').on('submit', async (event) => {
    // If the value of checkbox is true, updates the flags with the new values
    if (doc?.setFlag) {
      if (isoTokenCheckbox.prop("checked")) await doc.setFlag(MODULE_ID, "isoTokenDisabled", true);
      else await doc.unsetFlag(MODULE_ID, "isoTokenDisabled");
    }

    if (doc?.setFlag) {
      if (isoScaleDisabled.prop("checked")) await doc.setFlag(MODULE_ID, "isoScaleDisabled", true);
      else await doc.unsetFlag(MODULE_ID, "isoScaleDisabled");
    }

    // Persist alternate image sources when editing a concrete TokenDocument
    if (doc?.setFlag) {
      const isoSrc = String($html.find('input[name="flags.isometric-perspective.isoImageSrc"]').val() || '').trim();
      const topSrc = String($html.find('input[name="flags.isometric-perspective.topdownImageSrc"]').val() || '').trim();
      if (isoSrc) await doc.setFlag(MODULE_ID, 'isoImageSrc', isoSrc); else await doc.unsetFlag(MODULE_ID, 'isoImageSrc');
      if (topSrc) await doc.setFlag(MODULE_ID, 'topdownImageSrc', topSrc); else await doc.unsetFlag(MODULE_ID, 'topdownImageSrc');
    }

    // Persist numeric isometric positioning flags
    if (doc?.setFlag) {
      const numOrUnset = async (key, valStr) => {
        const raw = String(valStr ?? '').trim();
        const num = Number(raw);
        if (raw === '' || !Number.isFinite(num)) await doc.unsetFlag(MODULE_ID, key);
        else await doc.setFlag(MODULE_ID, key, num);
      };
      await numOrUnset('isoAnchorX', $html.find('input[name="flags.isometric-perspective.isoAnchorX"]').val());
      await numOrUnset('isoAnchorY', $html.find('input[name="flags.isometric-perspective.isoAnchorY"]').val());
      await numOrUnset('offsetX', $html.find('input[name="flags.isometric-perspective.offsetX"]').val());
      await numOrUnset('offsetY', $html.find('input[name="flags.isometric-perspective.offsetY"]').val());
      await numOrUnset('scale', $html.find('input[name="flags.isometric-perspective.scale"]').val());
    }
  });

  // Do not create a new Tabs instance here; the hosting sheet controls tabs. Our injection relies on its existing binding.






  
  
  
  
  
  
  
  
  
  
  
  // Initializes control values
  const isoAnchorToggleCheckbox = $html.find('input[name="isoAnchorToggle"]');
  isoAnchorToggleCheckbox.prop("unchecked", !!getFlag('isoAnchorToggle', false));

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

  // Function to calculate the alignment point
  function updateIsoAnchor(isoAnchorX, isoAnchorY, offsetX, offsetY) {
    let tokenMesh = app.token?.object?.mesh ?? app.token?.mesh ?? null;
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

  
  // Initialize the lines with the current values
  let isoAnchorX = doc?.getFlag(MODULE_ID, 'isoAnchorX') ?? 0;
  let isoAnchorY = doc?.getFlag(MODULE_ID, 'isoAnchorY') ?? 0;
  let offsetX = doc?.getFlag(MODULE_ID, 'offsetX') ?? 0;
  let offsetY = doc?.getFlag(MODULE_ID, 'offsetY') ?? 0;
  
  // Add the button to reset the token settings (avoid duplicates on re-render)
  $html.find('.toggle-alignment-lines').remove();
  const toggleButton = document.createElement("button");
  toggleButton.classList.add("toggle-alignment-lines");
  toggleButton.textContent = game.i18n.localize('isometric-perspective.token_resetAlignmentButton_name'); //Reset Token Alignment Configuration
  toggleButton.title = game.i18n.localize('isometric-perspective.token_resetAlignmentButton_mouseover'); //Click to toggle the alignment lines
  $html.find(".anchor-point").append(toggleButton);

  // Variables to control state
  let graphics;
  let showAlignmentLines = true;
  
  // Add the click event to the button
  toggleButton.addEventListener("click", async (event) => {
    event.preventDefault(); // Evita que o clique feche a janela

    // Reset all alignment settings
    $html.find('input[name="texture.anchorX"]').val(0.5);
    $html.find('input[name="texture.anchorY"]').val(0.5);
    $html.find('input[name="flags.isometric-perspective.isoAnchorX"]').val(0.5);
    $html.find('input[name="flags.isometric-perspective.isoAnchorY"]').val(0.5);
    $html.find('input[name="flags.isometric-perspective.offsetX"]').val(0);
    $html.find('input[name="flags.isometric-perspective.offsetY"]').val(0);
    $html.find('input[name="flags.isometric-perspective.scale"]').val(1);

    graphics = drawAlignmentLines(updateIsoAnchor(isoAnchorX, isoAnchorY, offsetX, offsetY));
  });
  

  // Add a listener to the "Save?" Checkbox, If it is marked, draw the lines
  isoAnchorToggleCheckbox.on('change', async () => {
    const isChecked = isoAnchorToggleCheckbox.prop("checked");
    if (isChecked) graphics = drawAlignmentLines(updateIsoAnchor(isoAnchorX, isoAnchorY, offsetX, offsetY));
    
    // Invert the state of the selector
    showAlignmentLines = !showAlignmentLines;
  });
  
  // Update the lines when changing the inputs
  $html.find('input[name="flags.isometric-perspective.isoAnchorX"], input[name="flags.isometric-perspective.isoAnchorY"], input[name="flags.isometric-perspective.offsetX"], input[name="flags.isometric-perspective.offsetY"]').on('change', () => {
    // Take updated values ​​directly from inputs
    let currentIsoAnchorX = $html.find('input[name="flags.isometric-perspective.isoAnchorX"]').val();
    let currentIsoAnchorY = $html.find('input[name="flags.isometric-perspective.isoAnchorY"]').val();
    let currentOffsetX = $html.find('input[name="flags.isometric-perspective.offsetX"]').val();
    let currentOffsetY = $html.find('input[name="flags.isometric-perspective.offsetY"]').val();
    
    // Recalculate the position and creates the lines again
    const newAnchor = updateIsoAnchor(currentIsoAnchorX, currentIsoAnchorY, currentOffsetX, currentOffsetY);
    graphics = drawAlignmentLines(newAnchor); // Adicionar novas
  });

  
  
  


  // Removes all lines when clicking on update token
  $html.find('button[type="submit"]').on('click', () => {
    if (!isoAnchorToggleCheckbox.prop("checked")) {
      cleanup();
    } else {
      // Take updated values ​​directly from inputs
      let currentIsoAnchorX = $html.find('input[name="flags.isometric-perspective.isoAnchorX"]').val();
      let currentIsoAnchorY = $html.find('input[name="flags.isometric-perspective.isoAnchorY"]').val();
      
      // Update the anchor basic values ​​in the token configuration
      $html.find('input[name="texture.anchorX"]').val(currentIsoAnchorY);
      $html.find('input[name="texture.anchorY"]').val(1-currentIsoAnchorX);
    }
  });

  // Changes the Close method to delete the lines, IF avoids changing the method more than once
  if (!app._isCloseModified) {
    const originalClose = app.close;
    app.close = async function (options) {
      cleanup();
      await originalClose.apply(this, [options]);
    };

    // Mark that the close method has already been
    app._isCloseModified = true;
  }
}




















// Hooks.on("createToken")
function handleCreateToken(tokenDocument) {
  const token = canvas.tokens.get(tokenDocument.id);
  if (!token) return;
  
  const isSceneIsometric = token.scene.getFlag(MODULE_ID, "isometricEnabled");
  applyIsometricTransformation(token, isSceneIsometric);
}


// Hooks.on("updateToken")
function handleUpdateToken(tokenDocument, updateData, options, userId) {
  const token = canvas.tokens.get(tokenDocument.id);
  if (!token) return;
  
  const isSceneIsometric = token.scene.getFlag(MODULE_ID, "isometricEnabled");
  applyIsometricTransformation(token, isSceneIsometric);
  
  /*if (updateData.flags?.[MODULE_ID] ||
      updateData.x !== undefined ||
      updateData.y !== undefined ) {
        applyIsometricTransformation(token, isSceneIsometric);
  }*/

  if (DEBUG_PRINT) console.log("Hooks.on token.js updateToken");
}


// Hooks.on("refreshToken")
function handleRefreshToken(token) {
  const isSceneIsometric = token.scene.getFlag(MODULE_ID, "isometricEnabled");
  applyIsometricTransformation(token, isSceneIsometric);
  
  if (DEBUG_PRINT) console.log("Hooks.on token.js refreshToken");
}


// Hooks.on("deleteToken")
function handleDeleteToken(token) {
  updateTokenVisuals(token);
}












// Generic function to create adjustable buttons with drag functionality
function createAdjustableButton(options) {
  // Destructure configuration options with default values
  const {
    container,                // Parent container element
    buttonSelector,           // CSS selector for the button
    inputs,                   // Array of input elements to update
    adjustmentScale = 0.2,    // How much the value changes per pixel moved
    valueConstraints = null,  // Optional min/max constraints for values
    roundingPrecision = 0     // Number of decimal places to round to
  } = options;

  // Find and configure the adjustment button
  const adjustButton = container.querySelector(buttonSelector);
  
  // Apply consistent button styling
  Object.assign(adjustButton.style, {
    width: '30px',
    cursor: 'pointer',
    padding: '1px 5px',
    border: '1px solid #888',
    borderRadius: '3px'
  });
  adjustButton.title = game.i18n.localize('isometric-perspective.token_artOffset_mouseover'); //Hold and drag to fine-tune X and Y

  // State variables for tracking drag operations
  let isAdjusting = false;
  let startX = 0;
  let startY = 0;
  let originalValues = [0, 0];

  // Function to handle mouse movement and value adjustments
  const applyAdjustment = (e) => {
    if (!isAdjusting) return;

    // Calculate mouse movement deltas
    const deltaY = e.clientX - startX;
    const deltaX = startY - e.clientY;
    
    // Calculate value adjustments based on mouse movement
    const adjustments = [
      deltaX * adjustmentScale,
      deltaY * adjustmentScale
    ];

    // Update each input with new values
    inputs.forEach((input, index) => {
      let newValue = originalValues[index] + adjustments[index];
      
      // Apply min/max constraints if provided
      if (valueConstraints) {
        newValue = Math.max(valueConstraints.min, Math.min(valueConstraints.max, newValue));
      }
      
      // Round to specified precision
      newValue = Math.round(newValue * Math.pow(10, roundingPrecision)) / Math.pow(10, roundingPrecision);
      
      // Update input value and trigger change event
      input.value = newValue.toFixed(roundingPrecision);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  // Set up mouse event listeners for drag functionality
  adjustButton.addEventListener('mousedown', (e) => {
    isAdjusting = true;
    startX = e.clientX;
    startY = e.clientY;
    // Store initial input values
    originalValues = inputs.map(input => parseFloat(input.value));
    
    // Add global mouse event listeners
    document.addEventListener('mousemove', applyAdjustment);
    document.addEventListener('mouseup', () => {
      isAdjusting = false;
      document.removeEventListener('mousemove', applyAdjustment);
    });
    
    e.preventDefault();
  });
}

// Handler for offset adjustment button
function updateAdjustOffsetButton(html) {
  const container = html.find('.offset-point')[0];
  createAdjustableButton({
    container,
    buttonSelector: 'button.fine-adjust',
    inputs: [
      html.find('input[name="flags.isometric-perspective.offsetX"]')[0],
      html.find('input[name="flags.isometric-perspective.offsetY"]')[0]
    ],
    adjustmentScale: 0.2,    // Larger scale for offset adjustments
    roundingPrecision: 0     // Whole numbers for offset values
  });
}

// Handler for anchor adjustment button
function updateAdjustAnchorButton(html) {
  const container = html.find('.anchor-point')[0];
  createAdjustableButton({
    container,
    buttonSelector: 'button.fine-adjust-anchor',
    inputs: [
      html.find('input[name="flags.isometric-perspective.isoAnchorX"]')[0],
      html.find('input[name="flags.isometric-perspective.isoAnchorY"]')[0]
    ],
    adjustmentScale: 0.005,  // Smaller scale for precise anchor adjustments
    valueConstraints: { min: 0, max: 1 },  // Anchor values must be between 0 and 1
    roundingPrecision: 2     // Two decimal places for anchor values
  });
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
