import { isometricModuleConfig } from './consts.js';
import { applyIsometricTransformation } from './transform.js';

export function registerTileConfig() {
  Hooks.on("renderTileConfig", handleRenderTileConfig);

  Hooks.on("createTile", handleCreateTile);
  Hooks.on("updateTile", handleUpdateTile);
  Hooks.on("refreshTile", handleRefreshTile);
}

async function handleRenderTileConfig(app, html, data) {
  const linkedWallIds = app.object.getFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds') || [];
  const wallIdsString = Array.isArray(linkedWallIds) ? linkedWallIds.join(', ') : linkedWallIds;

  // Carrega o template HTML para a nova aba
  const tabHtml = await renderTemplate("modules/isometric-perspective/templates/tile-config.html", {
    isoDisabled: app.object.getFlag(isometricModuleConfig.MODULE_ID, 'isoTileDisabled') ?? 1,
    scale: app.object.getFlag(isometricModuleConfig.MODULE_ID, 'scale') ?? 1,
    isFlipped: app.object.getFlag(isometricModuleConfig.MODULE_ID, 'tokenFlipped') ?? false,
    offsetX: app.object.getFlag(isometricModuleConfig.MODULE_ID, 'offsetX') ?? 0,
    offsetY: app.object.getFlag(isometricModuleConfig.MODULE_ID, 'offsetY') ?? 0,
    linkedWallIds: wallIdsString,
    isOccluding: app.object.getFlag(isometricModuleConfig.MODULE_ID, 'OccludingTile') ?? false
  });

  // Adiciona a nova aba ao menu
  const tabs = html.querySelector('.tabs:not(.secondary-tabs)');
  tabs.append(`<a class="item" data-tab="isometric"><i class="fas fa-cube"></i> ${game.i18n.localize('isometric-perspective.tab_isometric_name')}</a>`);

  // Adiciona o conteúdo da aba após a última aba existente
  const lastTab = html.querySelector('.tab').last();
  lastTab.after(tabHtml);

  // Update the offset fine adjustment button
  updateAdjustOffsetButton(html);

  // keeps the window height on auto
  /*
  const sheet = html.closest('.sheet');
  if (sheet.length) {
    sheet.css({ 'height': 'auto', 'min-height': '0' });
    const windowContent = sheet.find('.window-content');
    if (windowContent.length) {
      windowContent.css({ 'height': 'auto', 'overflow': 'visible' });
    }
  }
  */

  // Inicializa os valores dos controles
  const isoTileCheckbox = html.querySelector('input[name="flags.isometric-perspective.isoTileDisabled"]');
  const flipCheckbox = html.querySelector('input[name="flags.isometric-perspective.tokenFlipped"]');
  const linkedWallInput = html.querySelector('input[name="flags.isometric-perspective.linkedWallIds"]');
  const occludingCheckbox = html.querySelector('input[name="flags.isometric-perspective.OccludingTile"]');
  
  isoTileCheckbox.prop("checked", app.object.getFlag(isometricModuleConfig.MODULE_ID, "isoTileDisabled"));
  flipCheckbox.prop("checked", app.object.getFlag(isometricModuleConfig.MODULE_ID, "tokenFlipped"));
  linkedWallInput.val(wallIdsString);
  occludingCheckbox.prop("checked", app.object.getFlag(isometricModuleConfig.MODULE_ID, "OccludingTile"));
  
  // Adiciona listener para atualizar o valor exibido do slider
  html.querySelector('.scale-slider').on('input', function() {
    html.querySelector('.range-value').text(this.value);
  });

  
  // Handler para o formulário de submit
  html.querySelector('form').on('submit', async (event) => {
    // Se o valor do checkbox é true, atualiza as flags com os novos valores
    if (html.querySelector('input[name="flags.isometric-perspective.isoTileDisabled"]').prop("checked")) {
      await app.object.setFlag(isometricModuleConfig.MODULE_ID, "isoTileDisabled", true);
    } else {
      await app.object.unsetFlag(isometricModuleConfig.MODULE_ID, "isoTileDisabled");
    }

    if (html.querySelector('input[name="flags.isometric-perspective.tokenFlipped"]').prop("checked")) {
      await app.object.setFlag(isometricModuleConfig.MODULE_ID, "tokenFlipped", true);
    } else {
      await app.object.unsetFlag(isometricModuleConfig.MODULE_ID, "tokenFlipped");
    }

    if (html.querySelector('input[name="flags.isometric-perspective.OccludingTile"]').prop("checked")) {
      await app.object.setFlag(isometricModuleConfig.MODULE_ID, "OccludingTile", true);
    } else {
      await app.object.unsetFlag(isometricModuleConfig.MODULE_ID, "OccludingTile");
    }

    // dynamictile.js linked wall logic
    const wallIdsValue = linkedWallInput.val();
    if (wallIdsValue) {
      // Convertemos a string em array antes de salvar
      const wallIdsArray = wallIdsValue.split(',').map(id => id.trim()).filter(id => id);
      await app.object.setFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds', wallIdsArray);
    } else {
      await app.object.setFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds', []);
    }
  });

  
  // dynamictile.js event listeners for the buttons
  html.querySelector('button.select-wall').click(() => {
    // Minimiza a janela e muda a camada selecionada para a WallLayer
    Object.values(ui.windows).filter(w => w instanceof TileConfig).forEach(j => j.minimize());
    canvas.walls.activate();

    Hooks.once('controlWall', async (wall) => {
      const selectedWallId = wall.id.toString();
      const currentWallIds = app.object.getFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds') || [];
      
      // Adiciona o novo ID apenas se ele ainda não estiver na lista
      if (!currentWallIds.includes(selectedWallId)) {
        const newWallIds = [...currentWallIds, selectedWallId];
        await app.object.setFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds', newWallIds);
        html.querySelector('input[name="flags.isometric-perspective.linkedWallIds"]').val(newWallIds.join(', '));
      }

      // Retorna a janela a posição original e ativa a camada TileLayer
      Object.values(ui.windows).filter(w => w instanceof TileConfig).forEach(j => j.maximize());
      canvas.tiles.activate();

      // Keep the tab selected
      requestAnimationFrame(() => {
        const tabs = app._tabs[0];
        if (tabs) tabs.activate("isometric");
      });
      
    });
  });

  html.querySelector('button.clear-wall').click(async () => {
    await app.object.setFlag(isometricModuleConfig.MODULE_ID, 'linkedWallIds', []);
    html.querySelector('input[name="flags.isometric-perspective.linkedWallIds"]').val('');

    // Keep the tab selected
    requestAnimationFrame(() => {
      const tabs = app._tabs[0];
      if (tabs) tabs.activate("isometric");
    });
  });

}




// Hooks.on("createTile")
function handleCreateTile(tileDocument) {
  const tile = canvas.tiles.get(tileDocument.id);
  if (!tile) return;
  
  const scene = tile.scene;
  const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  requestAnimationFrame(() => applyIsometricTransformation(tile, isSceneIsometric));
}

// Hooks.on("updateTile")
function handleUpdateTile(tileDocument, updateData, options, userId) {
  const tile = canvas.tiles.get(tileDocument.id);
  if (!tile) return;
  
  const scene = tile.scene;
  const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  
  if (updateData.x !== undefined ||
      updateData.y !== undefined ||
      updateData.width !== undefined ||
      updateData.height !== undefined ||
      updateData.texture !== undefined) {
    requestAnimationFrame(() => applyIsometricTransformation(tile, isSceneIsometric));
  }
}

// Hooks.on("refreshTile")
function handleRefreshTile(tile) {
  const scene = tile.scene;
  const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  applyIsometricTransformation(tile, isSceneIsometric);
}


function updateAdjustOffsetButton(html) {
  const offsetPointContainer = html.querySelector('.offset-point')[0];

  // Finds the fine adjustment button on the original HTML
  const adjustButton = offsetPointContainer.querySelector('button.fine-adjust');

  // Configures the fine adjustment button
  adjustButton.style.width = '30px';
  adjustButton.style.cursor = 'pointer';
  adjustButton.style.padding = '1px 5px';
  adjustButton.style.border = '1px solid #888';
  adjustButton.style.borderRadius = '3px';
  adjustButton.title = game.i18n.localize('isometric-perspective.tile_artOffset_mouseover'); //Hold and drag to fine-tune X and Y

  // Adds the fine adjustment logic
  let isAdjusting = false;
  let startX = 0;
  let startY = 0;
  let originalValueX = 0;
  let originalValueY = 0;

  let offsetXInput = html.querySelector('input[name="flags.isometric-perspective.offsetX"]')[0];
  let offsetYInput = html.querySelector('input[name="flags.isometric-perspective.offsetY"]')[0];

  // Function to apply adjustment
  const applyAdjustment = (e) => {
    if (!isAdjusting) return;

    // Calculates the difference on x and y axes
    const deltaY = e.clientX - startX;
    const deltaX = startY - e.clientY;
    
    // Fine tuning: every 10px of motion = 0.1 value 
    const adjustmentX = deltaX * 0.1;
    const adjustmentY = deltaY * 0.1;
    
    // Calculates new values
    let newValueX = Math.round(originalValueX + adjustmentX);
    let newValueY = Math.round(originalValueY + adjustmentY);
    
    // Rounding for 2 decimal places
    newValueX = Math.round(newValueX * 100) / 100;
    newValueY = Math.round(newValueY * 100) / 100;
    
    // Updates anchor inputs
    offsetXInput.value = newValueX.toFixed(0);
    offsetYInput.value = newValueY.toFixed(0);
    offsetXInput.dispatchEvent(new Event('change', { bubbles: true }));
    offsetYInput.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Listeners for Adjustment
  adjustButton.addEventListener('mousedown', (e) => {
    isAdjusting = true;
    startX = e.clientX;
    startY = e.clientY;
    
    // Obtains the original values ​​of offset inputs
    originalValueX = parseFloat(offsetXInput.value);
    originalValueY = parseFloat(offsetYInput.value);
    
    // Add global listeners
    document.addEventListener('mousemove', applyAdjustment);
    document.addEventListener('mouseup', () => {
      isAdjusting = false;
      document.removeEventListener('mousemove', applyAdjustment);
    });
    
    e.preventDefault();
  });
}
