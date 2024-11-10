import { MODULE_ID } from './main.js';
import { 
  applyIsometricPerspective,
  applyBackgroundTransformation, 
} from './transform.js';
import { transformationService } from './services/transformationService.js';
import { transformationCache } from './services/transformationCache.js';


export function registerSceneConfig() {

  // Hook para adicionar a nova aba de configurações à cena
  Hooks.on("renderSceneConfig", async (sceneConfig, html, data) => {
    // Renderiza o template HTML
    const tabHtml = await renderTemplate("modules/isometric-perspective/templates/scene-config.html");
    
    // Adiciona o botão e o conteúdo da aba logo após a última aba
    html.find('nav.sheet-tabs:not(.secondary-tabs)').append('<a class="item" data-tab="isometric"><i class="fas fa-cube"></i> Isometric</a>');
    html.find('div.tab[data-tab="ambience"]').after(tabHtml);

    // Inicializa os valores dos controles
    const isoCheckbox = html.find('input[name="flags.isometric-perspective.isometricEnabled"]');
    const bgCheckbox = html.find('input[name="flags.isometric-perspective.isometricBackground"]');
    const scaleSlider = html.find('input[name="flags.isometric-perspective.isometricScale"]');
    const scaleDisplay = html.find('.range-value');
    
    // Define os valores iniciais
    isoCheckbox.prop("checked", sceneConfig.object.getFlag(MODULE_ID, "isometricEnabled"));
    bgCheckbox.prop("checked", sceneConfig.object.getFlag(MODULE_ID, "isometricBackground"));
    
    // Inicializa o valor do slider
    const currentScale = sceneConfig.object.getFlag(MODULE_ID, "isometricScale") ?? 1;
    scaleSlider.val(currentScale);
    scaleDisplay.text(currentScale);

    // Atualiza apenas o display do valor quando o slider é movido
    scaleSlider.on('input', function() {
      scaleDisplay.text(this.value);
    });
    
    // Handler para o formulário de submit
    html.find('form').on('submit', async (event) => {
      // Coleta os valores atuais dos controles
      const newIsometric = isoCheckbox.prop("checked");
      const newBackground = bgCheckbox.prop("checked");
      const newScale = parseFloat(scaleSlider.val());
      
      // Atualiza as flags com os novos valores
      if (newIsometric) {
        await sceneConfig.object.setFlag(MODULE_ID, "isometricEnabled", true);
      } else {
        await sceneConfig.object.unsetFlag(MODULE_ID, "isometricEnabled");
      }

      if (newBackground) {
        await sceneConfig.object.setFlag(MODULE_ID, "isometricBackground", true);
      } else {
        await sceneConfig.object.unsetFlag(MODULE_ID, "isometricBackground");
      }

      await sceneConfig.object.setFlag(MODULE_ID, "isometricScale", newScale);

      // Se a cena sendo editada for a atual, aplica as transformações
      if (canvas.scene.id === sceneConfig.object.id) {
        transformationCache.clear(); // Limpa todo o cache quando as configurações da cena mudam
        transformationService.updateWorldSettings(); // Atualiza as configurações globais

        requestAnimationFrame(() => {
          applyIsometricPerspective(sceneConfig.object, newIsometric);
          applyBackgroundTransformation(sceneConfig.object, newIsometric, newBackground);
        });
      }
    });
  });



  // Adicione um hook para atualizar background, tokens e tiles quando a cena for modificada
  Hooks.on("updateScene", (scene, changes) => {
    // Verifica se a cena sendo atualizada é a cena atual
    if (scene.id !== canvas.scene?.id) return;
    
    // Verifica se houve mudanças relevantes
    const relevantChanges = changes.img || 
      changes.background?.offsetX !== undefined || 
      changes.background?.offsetY !== undefined ||
      changes.flags?.[MODULE_ID]?.isometricEnabled !== undefined ||
      changes.flags?.[MODULE_ID]?.isometricBackground !== undefined ||
      changes.grid !== undefined ||
      changes.gridType !== undefined ||
      changes.gridSize !== undefined;
    
    if (relevantChanges) {
      // Invalida o cache da cena
      transformationService.invalidateSceneCache(scene.id);
      
      const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
      const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
      
      // Atualiza as configurações do serviço
      transformationService.updateWorldSettings();
      
      requestAnimationFrame(() => {
        applyIsometricPerspective(scene, isIsometric);
        applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
      });
    }
  });






  /*
  Hooks.on("renderGridConfig", (app, html, data) => {
    const scene = app.object;
    if (!scene) return;
    
    const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
    const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
    
    // Re-apply transformations when grid config is rendered
    if (isIsometric) {
      requestAnimationFrame(() => {
        applyIsometricPerspective(scene, isIsometric);
        applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
      });
    }
    
    // Add listener for when grid config tool is being used
    html.find('.grid-config').on('change', () => {
      if (isIsometric) {
        requestAnimationFrame(() => {
          applyIsometricPerspective(scene, isIsometric);
          applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
        });
      }
    });
  });


  // Aplica a perspectiva isométrica quando a cena termina de ser renderizada
  Hooks.on("gridConfigUpdate", (event) => {
    const scene = canvas.scene;
    if (!scene) return;
    
    const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
    const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
    
    // Re-apply isometric transformations after grid update
    if (isIsometric) {
      requestAnimationFrame(() => {
        applyIsometricPerspective(scene, isIsometric);
        applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
      });
    }
  });



  Hooks.on("closeGridConfig", (app) => {
    const scene = app.object;
    if (!scene) return;
    
    const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
    const isometricWorldEnabled = game.settings.get(MODULE_ID, "worldIsometricFlag");
    const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
    
    if (isometricWorldEnabled && isIsometric) {
      requestAnimationFrame(() => {
        applyIsometricPerspective(scene, isIsometric);
        applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
      });
    }
  });
  */
}