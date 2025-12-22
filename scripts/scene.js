import { applyIsometricPerspective, applyBackgroundTransformation } from './transform.js';
import { isometricModuleConfig, updateIsometricConstants, parseCustomProjection, updateCustomProjection, PROJECTION_TYPES, DEFAULT_PROJECTION, CUSTOM_PROJECTION } from './consts.js';
import { patchConfig} from './utils.js';

export function createSceneIsometricTab(){
  
  const sceneTabConfig = {
    moduleConfig: isometricModuleConfig,
    label: game.i18n.localize("isometric-perspective.tab_isometric_name"),
    tabGroup : "sheet",
    tabId : "isometric",
    icon: "fas fa-cube",
    templatePath: 'modules/isometric-perspective/templates/scene-config.hbs'
  }

  // Scene config data
  const FoundrySceneConfig = foundry.applications.sheets.SceneConfig;
  const DefaultSceneConfig = Object.values(CONFIG.Scene.sheetClasses.base).find((d) => d.default)?.cls;
  const SceneConfig = DefaultSceneConfig?.prototype instanceof FoundrySceneConfig ? DefaultSceneConfig : FoundrySceneConfig;

  const projectionTypes =  [...Object.keys(PROJECTION_TYPES)];
  const currentProjection = SceneConfig.object?.getFlag(isometricModuleConfig.MODULE_ID, 'projectionType') ?? DEFAULT_PROJECTION;
  
  const extraSceneConfig = {
    projectionTypes: projectionTypes,
    document: currentProjection
  }

  patchConfig(SceneConfig,sceneTabConfig, extraSceneConfig);

}

async function handleRenderSceneConfig(sceneConfig, html, data) {
  try {
    // Ensure html is a jQuery object - V13 compatibility fix
    if (!(html instanceof jQuery)) {
      html = $(html);
    }
    
    // Get the scene document - V13 compatibility
    const sceneDocument = sceneConfig.object || sceneConfig.document || sceneConfig;
    
    // Validate we have a valid scene document
    if (!sceneDocument || typeof sceneDocument.getFlag !== 'function') {
      console.warn('Isometric Perspective: Invalid scene document in handleRenderSceneConfig');
      return;
    }
    
    // Get current projection type or default
    const currentProjection = sceneDocument.getFlag(MODULE_ID, 'projectionType') ?? DEFAULT_PROJECTION;
    
    // Prepare data for the template
    const templateData = {
      projectionTypes: [...Object.keys(PROJECTION_TYPES)],
      currentProjection: currentProjection
    };
    
    // Render the template HTML
    const tabHtml = await renderTemplate("modules/isometric-perspective/templates/scene-config.html", templateData);

    // Find the navigation tabs container - try multiple selectors for V13 compatibility
    let navTabs = html.find('nav.sheet-tabs:not(.secondary-tabs)');
    if (navTabs.length === 0) {
      navTabs = html.find('nav.tabs');
    }
    if (navTabs.length === 0) {
      navTabs = html.find('.sheet-tabs');
    }
    
    // Find a suitable tab to insert after - try multiple fallbacks
    let insertAfter = html.find('div.tab[data-tab="ambience"]');
    if (insertAfter.length === 0) {
      insertAfter = html.find('div.tab[data-tab="environment"]');
    }
    if (insertAfter.length === 0) {
      insertAfter = html.find('div.tab[data-tab="lighting"]');
    }
    if (insertAfter.length === 0) {
      insertAfter = html.find('div.tab').last();
    }
    
    // Only proceed if we found the necessary elements
    if (navTabs.length > 0 && insertAfter.length > 0) {
      // Add the tab button
      navTabs.append(`<a class="item" data-tab="isometric"><i class="fas fa-cube"></i> ${game.i18n.localize('isometric-perspective.tab_isometric_name')}</a>`);
      
      // Add the tab content
      insertAfter.after(tabHtml);
      
      // Add direct click handler for the isometric tab - V13 compatibility
      const isometricTab = html.find('a[data-tab="isometric"]');
      isometricTab.on('click', function(event) {
        event.preventDefault();
        
        // Remove active class from all tabs and tab content
        html.find('nav.sheet-tabs a.item, nav.tabs a.item, .sheet-tabs a.item').removeClass('active');
        html.find('.tab').removeClass('active');
        
        // Add active class to clicked tab and corresponding content
        $(this).addClass('active');
        html.find('.tab[data-tab="isometric"]').addClass('active');
        
        console.log('Isometric Perspective: Tab activated successfully');
      });
      
      // Try to re-initialize tabs as fallback - V13 compatibility
      try {
        if (sceneConfig._tabs && sceneConfig._tabs.length > 0) {
          // For older versions of Foundry
          const tabs = sceneConfig._tabs[0];
          if (tabs && typeof tabs.bind === 'function') {
            tabs.bind(html[0]);
          }
        } else if (sceneConfig.tabs && typeof sceneConfig.tabs.bind === 'function') {
          // For newer versions of Foundry
          sceneConfig.tabs.bind(html[0]);
        }
      } catch (tabError) {
        console.warn('Isometric Perspective: Could not reinitialize tabs, using direct click handler:', tabError);
      }
    } else {
      console.warn('Isometric Perspective: Could not find scene config tabs container. Scene configuration tab will not be available.');
      ui.notifications.warn('Isometric Perspective: Scene configuration tab could not be added. Use the manual activation scripts in the bugfix folder.');
      return;
    }

  const projectionSelect = html.querySelector('select[name="flags.isometric-perspective.projectionType"]');
  const customProjectionInput = html.querySelector('input[name="flags.isometric-perspective.customProjection"]');
  const customProjectionContainer = html.querySelector('.custom-projection-container');
  
  // Set initial values
  isoCheckbox.prop("checked", sceneDocument.getFlag(MODULE_ID, "isometricEnabled"));
  bgCheckbox.prop("checked", sceneDocument.getFlag(MODULE_ID, "isometricBackground"));
  
  // Initialize slider value
  const currentScale = sceneDocument.getFlag(MODULE_ID, "isometricScale") ?? 1;
  scaleSlider.val(currentScale);
  scaleDisplay.text(currentScale);

  // Add slider value update listener
  scaleSlider.on('input', function() {
    scaleDisplay.text(this.value);
  });

  // Custom projection type handling
  projectionSelect.on('change', function() {
    const isCustom = $(this).val() === 'Custom Projection';
    customProjectionInput.prop('disabled', !isCustom);
    
    // Set initial custom projection input if available
    if (isCustom) {
      const currentCustom = sceneDocument.getFlag(MODULE_ID, "customProjection");
      customProjectionInput.val(currentCustom || '0, 0, 0, 0, 0, 0, 0, 0');
    }
  });

  // Trigger initial state
  projectionSelect.trigger('change');

  // Adiciona listener para atualizar o valor exibido do slider
  /*html.find('input[name="flags.isometric-perspective.isometricScale"]').on('input', function() {
    html.find('.range-value').text(this.value);
  });

  // Handler for the dropdown change event
  html.find('select[name="scene_dropdown"]').on('change', function() {
    updateIsometricConstants(this.value);
  });*/

  // Handler for the form submission
  html.find('form').on('submit', async (event) => {
    // Coleta os valores atuais dos controles
    let newIsometric = isoCheckbox.prop("checked");
    let newBackground = bgCheckbox.prop("checked");
    let newScale = parseFloat(scaleSlider.val());
    let newProjection = html.find('select[name="flags.isometric-perspective.projectionType"]').val();
    
    // If custom projection is selected, validate and set the custom values
    if (newProjection === 'Custom Projection') {
      try {
        let customInput = customProjectionInput.val();
        let parsedCustom = parseCustomProjection(customInput);
        
        // Set the custom projection values
        updateCustomProjection(parsedCustom);
        
        // Save the custom input string to scene flags
        await sceneDocument.setFlag(MODULE_ID, "customProjection", customInput);
      } catch (error) {
        ui.notifications.error(error.message);
        event.preventDefault();
        return;
      }
    }
    
    // Atualiza as flags com os novos valores
    await sceneDocument.setFlag(MODULE_ID, "isometricEnabled", newIsometric);
    await sceneDocument.setFlag(MODULE_ID, "isometricBackground", newBackground);
    await sceneDocument.setFlag(MODULE_ID, "isometricScale", newScale);
    await sceneDocument.setFlag(MODULE_ID, "projectionType", newProjection);

    // Se a cena sendo editada for a atual, aplica as transformações
    if (canvas.scene.id === sceneDocument.id) {
      requestAnimationFrame(() => {
        updateIsometricConstants(newProjection);
        applyIsometricPerspective(sceneDocument, newIsometric);
        applyBackgroundTransformation(sceneDocument, newIsometric, newBackground);
        canvas.draw(); // Redraw the scene
      });
    }

    //requestAnimationFrame(() => {
      //await canvas.draw();
      //console.log("teste");
      //await canvas.background.refresh();
    //});
  });

  /*// Re-inicializa as tabs
  sceneConfig.options.tabs[0].active = "isometric";
  const tabs = sceneConfig._tabs[0];
  tabs.bind(html[0]);
  */
  } catch (error) {
    console.error('Isometric Perspective: Error in handleRenderSceneConfig:', error);
    ui.notifications.error('Isometric Perspective: Failed to add scene configuration tab.');
  }
}

export function handleUpdateScene(scene, changes) {

  if (scene.id !== canvas.scene?.id) return;

  if (
    changes.img ||
    changes.background?.offsetX !== undefined ||
    changes.background?.offsetY !== undefined ||
    changes.flags?.[isometricModuleConfig.MODULE_ID]?.isometricEnabled !== undefined ||
    changes.flags?.[isometricModuleConfig.MODULE_ID]?.isometricBackground !== undefined ||
    changes.flags?.[isometricModuleConfig.MODULE_ID]?.projectionType !== undefined ||
    changes.grid !== undefined ||
    changes.gridType !== undefined ||
    changes.gridSize !== undefined
  ) {
    const isIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
    const shouldTransformBackground = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricBackground") ?? false;
    const projectionType = scene.getFlag(isometricModuleConfig.MODULE_ID, "projectionType") ?? DEFAULT_PROJECTION;

    // logic for custom projection
    if (projectionType === 'Custom Projection') {
      const customProjectionValue = scene.getFlag(isometricModuleConfig.MODULE_ID, "customProjection");
      if (customProjectionValue) {
        try {
          const parsedCustom = parseCustomProjection(customProjectionValue);
          updateCustomProjection(parsedCustom);
        } catch (error) {
          console.error("Error parsing custom projection:", error);
        }
      }
    }

    requestAnimationFrame(() => {
      updateIsometricConstants(projectionType);
      applyIsometricPerspective(scene, isIsometric);
      applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
    });
  }
}

export async function handleCanvasReady(canvas) {
  const scene = canvas.scene;
  if (!scene) return;

  const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricBackground") ?? false;
  let projectionType = scene.getFlag(isometricModuleConfig.MODULE_ID, "projectionType");
  
  // If no projection type is set, set the default
  if (!projectionType) {
    projectionType = DEFAULT_PROJECTION;
    await scene.setFlag(isometricModuleConfig.MODULE_ID, "projectionType", projectionType);
  }

  // logic to load and apply custom projection
  if (projectionType === 'Custom Projection') {
    const customProjectionValue = scene.getFlag(isometricModuleConfig.MODULE_ID, "customProjection");
    if (customProjectionValue) {
      try {
        const parsedCustom = parseCustomProjection(customProjectionValue);
        updateCustomProjection(parsedCustom);
      } catch (error) {
        console.error("Error parsing custom projection:", error);
      }
    }
  }
  
  updateIsometricConstants(projectionType);
  applyIsometricPerspective(scene, isSceneIsometric);
  applyBackgroundTransformation(scene, isSceneIsometric, shouldTransformBackground);
  
  // Force a camera update to synchronize the HUD layer transformations with the now-isometrically-transformed stage.
  // This ensures the #hud container correctly aligns with the stage immediately upon scene load.
  if (isSceneIsometric) {
    // We use a small delay to allow the PIXI stage transformations to settle before forcing the HTML sync.
    setTimeout(() => {
        if (!canvas.ready) return;
        
        // Trigger a dummy pan to force Foundry's internal camera-to-interface synchronization.
        // We use the current pivot and scale to ensure the camera does not actually move.
        canvas.pan({
            x: canvas.stage.pivot.x,
            y: canvas.stage.pivot.y,
            scale: canvas.stage.scale.x
        });
        
        if (isometricModuleConfig.DEBUG_PRINT) console.log("Forced HUD synchronization completed.");
    }, 250);
  }
  
  // debug print
  if (isometricModuleConfig.DEBUG_PRINT) console.log("handleCanvasReady");
}

export function handleCanvasResize(canvas) {
  const scene = canvas.scene;
  if (!scene) return;
  
  const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricBackground") ?? false;
  const projectionType = scene.getFlag(isometricModuleConfig.MODULE_ID, "projectionType") ?? DEFAULT_PROJECTION;

  updateIsometricConstants(projectionType);
  
  if (isSceneIsometric && shouldTransformBackground) {
    applyBackgroundTransformation(scene, isSceneIsometric, shouldTransformBackground);
  }
  
  // debug print
  if (isometricModuleConfig.DEBUG_PRINT) console.log("handleCanvasResize");
}


/*
Hooks.on("renderGridConfig", (app, html, data) => {
  const scene = app.object;
  if (!scene) return;
  
  const isIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricBackground") ?? false;
  
  // Re-apply transformations when grid config is rendered
  if (isIsometric) {
    requestAnimationFrame(() => {
      applyIsometricPerspective(scene, isIsometric);
      applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
    });
  }
  
  // Add listener for when grid config tool is being used
  html.querySelector('.grid-config').on('change', () => {
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
  
  const isIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricBackground") ?? false;
  
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
  
  const isIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
  const isometricWorldEnabled = game.settings.get(isometricModuleConfig.MODULE_ID, "worldIsometricFlag");
  const shouldTransformBackground = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricBackground") ?? false;
  
  if (isometricWorldEnabled && isIsometric) {
    requestAnimationFrame(() => {
      applyIsometricPerspective(scene, isIsometric);
      applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
    });
  }
});
*/
