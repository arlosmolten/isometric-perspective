import { MODULE_ID } from './main.js';
import { applyIsometricPerspective,
  adjustAllTokensAndTilesForIsometric, 
  applyTokenTransformation, 
  applyIsometricTransformation, 
  applyBackgroundTransformation, 
  updateTokenVisuals, 
  removeTokenVisuals 
} from './transform.js';

import { isoToCartesian,
  cartesianToIso2,
  calculateIsometricVerticalDistance
} from './utils.js';
import { transformationService } from './services/transformationService.js';

export function registerTileConfig() {


  Hooks.on("renderTileConfig", async (app, html, data) => {
    // Carrega o template HTML para a nova aba
    const tabHtml = await renderTemplate("modules/isometric-perspective/templates/tile-config.html", {
      scale: app.object.getFlag(MODULE_ID, 'scale') ?? 1
    });
    
    // Adiciona a nova aba ao menu
    const tabs = html.find('.tabs:not(.secondary-tabs)');
    tabs.append('<a class="item" data-tab="isometric"><i class="fas fa-cube"></i> Isometric</a>');
    
    // Adiciona o conteúdo da aba após a última aba existente
    const lastTab = html.find('.tab').last();
    lastTab.after(tabHtml);

    // Adiciona listener para atualizar o valor exibido do slider
    html.find('.scale-slider').on('input', function() {
      html.find('.range-value').text(this.value);
    });

    // Corrige a inicialização das tabs
    if (!app._tabs || app._tabs.length === 0) {
      app._tabs = [new Tabs({
        navSelector: ".tabs",
        contentSelector: ".sheet-body",
        initial: "image",
        callback: () => {}
      })];
      app._tabs[0].bind(html[0]);
    }
  });




  // Hook para definir flags padrão antes da criação do Tile
  Hooks.on("preCreateTile", (tileDocument, createData, options, userId) => {
    
    // Define a flag 'scale' com valor padrão 1
    setProperty(createData, `flags.${MODULE_ID}.scale`, 1);

    //errado também
    //tileDocument.setFlag(MODULE_ID, "scale", 1);
  });
  /* versão nova mas errada
  Hooks.on("preCreateTile", (tileDocument, createData, options, userId) => {
    // Define a flag 'scale' com valor padrão 1
    createData.flags[MODULE_ID] = createData.flags[MODULE_ID] || {};
    createData.flags[MODULE_ID].scale = 1;
  });
  */



  Hooks.on("createTile", (tileDocument) => {
    const tile = canvas.tiles.get(tileDocument.id);
    if (!tile) return;
    
    const scene = tile.scene;
    const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
    
    // Força recálculo para novo tile
    transformationService.invalidateObjectCache(tile);
    requestAnimationFrame(() => applyIsometricTransformation(tile, isIsometric));
  });



  Hooks.on("updateTile", (tileDocument, updateData, options, userId) => {
    const tile = canvas.tiles.get(tileDocument.id);
    if (!tile) return;
    
    const scene = tile.scene;
    const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
    
    if (updateData.x !== undefined ||
        updateData.y !== undefined ||
        updateData.width !== undefined ||
        updateData.height !== undefined ||
        updateData.texture !== undefined ||
        updateData.flags?.[MODULE_ID]){

        transformationService.invalidateObjectCache(tile);
        requestAnimationFrame(() => applyIsometricTransformation(tile, isIsometric));
      }
  });



  Hooks.on("refreshTile", (tile) => {
    const scene = tile.scene;
    const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
    
    // Invalida o cache e reaplica transformação
    transformationService.invalidateObjectCache(tile);
    applyIsometricTransformation(tile, isIsometric);
  });

}