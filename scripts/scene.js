import { MODULE_ID, DEBUG_PRINT, WORLD_ISO_FLAG } from './main.js';
import { applyIsometricPerspective, applyBackgroundTransformation } from './transform.js';
import { updateIsometricConstants, parseCustomProjection, updateCustomProjection, PROJECTION_TYPES, DEFAULT_PROJECTION, CUSTOM_PROJECTION } from './consts.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export function registerSceneConfig() {
  Hooks.on("renderSceneConfig", handleRenderSceneConfig);
  Hooks.on("updateScene", handleUpdateScene);
  Hooks.on("canvasReady", handleCanvasReady);
  Hooks.on("canvasResize", handleCanvasResize);
  Hooks.on("ready", registerSceneConfigIsometricTab);
}

class isoTab extends HandlebarsApplicationMixin(ApplicationV2){
  static TABS = {
    sheet: {
      tabs: [
        { id: 'isometric', group: 'isometric', label: 'isometric-perspective.tab_isometric_name' },
      ],
      initial: 'isometric'
    }
  }

  static PARTS = {
    tabs: {
      template: ''
    },
  }
}

function handleRenderSceneConfig(sceneConfig, html, data) {
  // Get current projection type or default
  const currentProjection = sceneConfig.object?.getFlag(MODULE_ID, 'projectionType') ?? DEFAULT_PROJECTION;
  
  // Prepare data for the template
  // const templateData = {
    //   projectionTypes: [...Object.keys(PROJECTION_TYPES)],
    //   currentProjection: currentProjection
    // };

  const FoundrySceneConfig = foundry.applications.sheets.SceneConfig;
  const DefaultSceneConfig = Object.values(CONFIG.Scene.sheetClasses.base).find((d) => d.default).cls;
  const SceneConfig = DefaultSceneConfig?.prototype instanceof FoundrySceneConfig ? DefaultSceneConfig : FoundrySceneConfig;
  
  const label = game.i18n.localize("isometric-perspective.tab_isometric_name");
  SceneConfig.TABS.sheet.tabs.push({ id: "isometric", label, icon: "fas fa-cube" });

  const footerPart = SceneConfig.PARTS.footer;
  delete SceneConfig.PARTS.footer;

  SceneConfig.PARTS.isometric = {
      template: "modules/isometric-perspective/templates/isometric-tab.hbs"
  };
  SceneConfig.PARTS.footer = footerPart;

  const defaultRenderPartContext = SceneConfig.prototype._preparePartContext;

  SceneConfig.prototype._preparePartContext = async function(partId, context, options) {
      if (partId === "isometric") {
          const flags = this.document.flags[MODULE] ?? null;
          const currentProjection = sceneConfig.object?.getFlag(MODULE_ID, 'projectionType') ?? DEFAULT_PROJECTION;
          return {
              ...DEFAULT_SETTINGS,
              ...(flags ?? {}),
              POSITION_OPTIONS,
              units: this.document.grid.units,
              document: this.document,
              tab: context.tabs[partId],
              currentProjection
          };
      }

      return defaultRenderPartContext.call(this, partId, context, options);
  }

  // Render the template HTML
  // const tabHtml = await renderTemplate("modules/isometric-perspective/templates/scene-config.html", templateData);

  // Add the button and tab content after the last tab
  // const isoTabButton = html.querySelector('nav.sheet-tabs:not(.secondary-tabs)');
  // const tabTemplate = `<a class="item" data-tab="isometric"><i class="fas fa-cube"></i> ${game.i18n.localize('isometric-perspective.tab_isometric_name')}</a>`;
  // isoTabButton.insertAdjacentHTML('beforeend', tabTemplate);

  // const isoTabContent = html.querySelector('div.tab[data-tab="ambience"]')
  // isoTabContent.insertAdjacentHTML('afterend',tabHtml);
  

  /*

  // Initialize control values
  const isoCheckbox = html.querySelector('input[name="flags.isometric-perspective.isometricEnabled"]');
  const bgCheckbox = html.querySelector('input[name="flags.isometric-perspective.isometricBackground"]');
  const scaleSlider = html.querySelector('input[name="flags.isometric-perspective.isometricScale"]');
  const scaleDisplay = html.querySelector('.range-value');
  let projectionSelect = html.querySelector('select[name="flags.isometric-perspective.projectionType"]');
  let customProjectionInput = html.querySelector('input[name="flags.isometric-perspective.customProjection"]');
  
  
  
  // Set initial values
  isoCheckbox.prop("checked", sceneConfig.object.getFlag(MODULE_ID, "isometricEnabled"));
  bgCheckbox.prop("checked", sceneConfig.object.getFlag(MODULE_ID, "isometricBackground"));
  
  // Initialize slider value
  const currentScale = sceneConfig.object.getFlag(MODULE_ID, "isometricScale") ?? 1;
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
      const currentCustom = sceneConfig.object.getFlag(MODULE_ID, "customProjection");
      customProjectionInput.val(currentCustom || '0, 0, 0, 0, 0, 0, 0, 0');
    }
  });

  // Trigger initial state
  projectionSelect.trigger('change');

  // Adiciona listener para atualizar o valor exibido do slider
  /*html.querySelector('input[name="flags.isometric-perspective.isometricScale"]').on('input', function() {
    html.querySelector('.range-value').text(this.value);
  });

  // Handler for the dropdown change event
  html.querySelector('select[name="scene_dropdown"]').on('change', function() {
    updateIsometricConstants(this.value);
  });*/

  /*
  // Handler for the form submission
  html.querySelector('form').on('submit', async (event) => {
    // Coleta os valores atuais dos controles
    let newIsometric = isoCheckbox.prop("checked");
    let newBackground = bgCheckbox.prop("checked");
    let newScale = parseFloat(scaleSlider.val());
    let newProjection = html.querySelector('select[name="flags.isometric-perspective.projectionType"]').val();
    
    // If custom projection is selected, validate and set the custom values
    if (newProjection === 'Custom Projection') {
      try {
        let customInput = customProjectionInput.val();
        let parsedCustom = parseCustomProjection(customInput);
        
        // Set the custom projection values
        updateCustomProjection(parsedCustom);
        
        // Save the custom input string to scene flags
        await sceneConfig.object.setFlag(MODULE_ID, "customProjection", customInput);
      } catch (error) {
        ui.notifications.error(error.message);
        event.preventDefault();
        return;
      }
    }
    
    // Atualiza as flags com os novos valores
    await sceneConfig.object.setFlag(MODULE_ID, "isometricEnabled", newIsometric);
    await sceneConfig.object.setFlag(MODULE_ID, "isometricBackground", newBackground);
    await sceneConfig.object.setFlag(MODULE_ID, "isometricScale", newScale);
    await sceneConfig.object.setFlag(MODULE_ID, "projectionType", newProjection);

    // Se a cena sendo editada for a atual, aplica as transformações
    if (canvas.scene.id === sceneConfig.object.id) {
      requestAnimationFrame(() => {
        updateIsometricConstants(newProjection);
        applyIsometricPerspective(sceneConfig.object, newIsometric);
        applyBackgroundTransformation(sceneConfig.object, newIsometric, newBackground);
        canvas.draw(); // Redraw the scene
      });
    }

    //requestAnimationFrame(() => {
      //await canvas.draw();
      //console.log("teste");
      //await canvas.background.refresh();
    //});
  });
  */
  /*// Re-inicializa as tabs
  sceneConfig.options.tabs[0].active = "isometric";
  const tabs = sceneConfig._tabs[0];
  tabs.bind(html[0]);
  */
}



// Hooks.on("updateScene")
function handleUpdateScene(scene, changes) {
  if (scene.id !== canvas.scene?.id) return;

  if (
    changes.img ||
    changes.background?.offsetX !== undefined ||
    changes.background?.offsetY !== undefined ||
    changes.flags?.[MODULE_ID]?.isometricEnabled !== undefined ||
    changes.flags?.[MODULE_ID]?.isometricBackground !== undefined ||
    changes.flags?.[MODULE_ID]?.projectionType !== undefined ||
    changes.grid !== undefined ||
    changes.gridType !== undefined ||
    changes.gridSize !== undefined
  ) {
    const isIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
    const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
    const projectionType = scene.getFlag(MODULE_ID, "projectionType") ?? DEFAULT_PROJECTION;

    // logic for custom projection
    if (projectionType === 'Custom Projection') {
      const customProjectionValue = scene.getFlag(MODULE_ID, "customProjection");
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


async function handleCanvasReady(canvas) {
  const scene = canvas.scene;
  if (!scene) return;

  const isSceneIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  let projectionType = scene.getFlag(MODULE_ID, "projectionType");
  
  // If no projection type is set, set the default
  if (!projectionType) {
    projectionType = DEFAULT_PROJECTION;
    await scene.setFlag(MODULE_ID, "projectionType", projectionType);
  }

  // logic to load and apply custom projection
  if (projectionType === 'Custom Projection') {
    const customProjectionValue = scene.getFlag(MODULE_ID, "customProjection");
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
  
  // debug print
  if (DEBUG_PRINT) console.log("Hooks.on canvasReady");
}


function handleCanvasResize(canvas) {
  const scene = canvas.scene;
  if (!scene) return;
  
  const isSceneIsometric = scene.getFlag(MODULE_ID, "isometricEnabled");
  const shouldTransformBackground = scene.getFlag(MODULE_ID, "isometricBackground") ?? false;
  const projectionType = scene.getFlag(MODULE_ID, "projectionType") ?? DEFAULT_PROJECTION;

  updateIsometricConstants(projectionType);
  
  if (isSceneIsometric && shouldTransformBackground) {
    applyBackgroundTransformation(scene, isSceneIsometric, shouldTransformBackground);
  }
  
  // debug print
  if (DEBUG_PRINT) console.log("Hooks.on canvasResize");
}

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
