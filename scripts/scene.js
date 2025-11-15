import { isometricModuleConfig } from './consts.js';
import { applyIsometricPerspective, applyBackgroundTransformation } from './transform.js';
import { updateIsometricConstants, parseCustomProjection, updateCustomProjection, PROJECTION_TYPES, DEFAULT_PROJECTION, CUSTOM_PROJECTION } from './consts.js';

export function configureIsometricTab(app, html, context, options){
  
  const label = game.i18n.localize("isometric-perspective.tab_isometric_name");
  const tabGroup = "sheet";
  const tabId = "isometric";
  const icon = "fas fa-cube"
  const isoTemplatePath = 'modules/isometric-perspective/templates/isometric-tab.hbs'

  // Scene config data
  const FoundrySceneConfig = foundry.applications.sheets.SceneConfig;
  const DefaultSceneConfig = Object.values(CONFIG.Scene.sheetClasses.base).find((d) => d.default)?.cls;
  const SceneConfig = DefaultSceneConfig?.prototype instanceof FoundrySceneConfig ? DefaultSceneConfig : FoundrySceneConfig;
  const projectionTypes =  [...Object.keys(PROJECTION_TYPES)];
  const currentProjection = SceneConfig.object?.getFlag(isometricModuleConfig.MODULE_ID, 'projectionType') ?? DEFAULT_PROJECTION;
  
  // Adding the isometric tab data to the scene config parts
  SceneConfig.TABS.sheet.tabs.push({ id: tabId, group: tabGroup, label , icon: icon }); 
  
  // Adding the part template
  SceneConfig.PARTS.isometric = {template: isoTemplatePath};

  //Adding the form actions
  SceneConfig.DEFAULT_OPTIONS.tag = "form"; //TODO: not sure if its the right way to do this but i cant find an equivalent example in world-explorer i think they didnt needed to modify that.
  SceneConfig.DEFAULT_OPTIONS.form = {
    // handler:
    submitOnChange: false,
    closeOnSubmit: true
  }
  
  const footerPart = SceneConfig.PARTS.footer;
  delete SceneConfig.PARTS.footer;
  SceneConfig.PARTS.footer = footerPart;

  console.log("projectionTypes", projectionTypes); //TODO: need to figure out where to properly place the projection types flag

  // Override part context to include the isometric-perspective config data
  const defaultRenderPartContext = SceneConfig.prototype._preparePartContext;
  SceneConfig.prototype._preparePartContext = async function(partId, context, options) {
    if (partId === "isometric") {
      const flags = this.document.flags[isometricModuleConfig.MODULE_ID] ?? null;
      return {
        ...(flags ?? {}),
        projectionTypes: projectionTypes,
        document: this.document,
        tab: context.tabs[partId],
      },
      currentProjection
    }
    return defaultRenderPartContext.call(this, partId, context, options);
  }

  //TODO: need to also adjust the tempalte so they can read and get their values from the right flags in the .hbs template
  
  // Override onChangeForm to include isometric-perspective //TODO: need toalso figure out how that works 
  const default_onChangeForm = SceneConfig.prototype._onChangeForm;
  SceneConfig.prototype._onChangeForm = function(formConfig, event) {
    const formElements = this.form.elements;
    const isometricEnabled = formElements['flags.isometric-perspective.isometricEnabled'];
    const isometricBackgroundTransform = formElements['flags.isometric-perspective.isometricBackground'];
    const isometricScale = formElements['flags.isometric-perspective.isometricScale'];
    const isometricProjectionType = formElements['flags.isometric-perspective.projectionType'];
    const isometricCustomProjection = formElements['flags.isometric-perspective.customProjection'];
    //todo: isometric enabled
    //todo: isometric background
    //todo: isometric scale
    //todo: isometric projection
    //todo: isometric customValues

    console.log("HERE BUT ISOMETRIC!",this.form.elements);
    return default_onChangeForm.call(this, formConfig, event);
  }
 
}

export function insertIsometricTab(app, html, context, options) {

  // Initialize slider value
  // const currentScale = sceneConfig.object.getFlag(isometricModuleConfig.MODULE_ID, "isometricScale") ?? 1;
  // scaleSlider.val(currentScale);
  // scaleDisplay.text(currentScale);

  // Add slider value update listener
  // scaleSlider.on('input', function() {
  //   scaleDisplay.text(this.value);
  // });

  // Custom projection type handling
  // projectionSelect.on('change', function() {
  //   const isCustom = $(this).val() === 'Custom Projection';
  //   customProjectionInput.prop('disabled', !isCustom);
    
  //   // Set initial custom projection input if available
  //   if (isCustom) {
  //     const currentCustom = sceneConfig.object.getFlag(isometricModuleConfig.MODULE_ID, "customProjection");
  //     customProjectionInput.val(currentCustom || '0, 0, 0, 0, 0, 0, 0, 0');
  //   }
  // });

  // Trigger initial state
  // projectionSelect.trigger('change');

  // // Adiciona listener para atualizar o valor exibido do slider
  // html.querySelector('input[name="flags.isometric-perspective.isometricScale"]').on('input', function() {
  //   html.querySelector('.range-value').text(this.value);
  // });

  // // Handler for the dropdown change event
  // html.querySelector('select[name="scene_dropdown"]').on('change', function() {
  //   updateIsometricConstants(this.value);
  // });

  // html.querySelector('form').on('submit', async (event) => {
  //   // Coleta os valores atuais dos controles
  //   let newIsometric = isoCheckbox.prop("checked");
  //   let newBackground = bgCheckbox.prop("checked");
  //   let newScale = parseFloat(scaleSlider.val());
  //   let newProjection = html.querySelector('select[name="flags.isometric-perspective.projectionType"]').val();

  //   // If custom projection is selected, validate and set the custom values
  //   if (newProjection === 'Custom Projection') {
  //     try {
  //       let customInput = customProjectionInput.val();
  //       let parsedCustom = parseCustomProjection(customInput);
        
  //       // Set the custom projection values
  //       updateCustomProjection(parsedCustom);
        
  //       // Save the custom input string to scene flags
  //       await sceneConfig.object.setFlag(isometricModuleConfig.MODULE_ID, "customProjection", customInput);
  //     } catch (error) {
  //       ui.notifications.error(error.message);
  //       event.preventDefault();
  //       return;
  //     }
  //   }

  //   // Atualiza as flags com os novos valores
  //   await sceneConfig.object.setFlag(isometricModuleConfig.ODULE_ID, "isometricEnabled", newIsometric);
  //   await sceneConfig.object.setFlag(isometricModuleConfig.MODULE_ID, "isometricBackground", newBackground);
  //   await sceneConfig.object.setFlag(isometricModuleConfig.MODULE_ID, "isometricScale", newScale);
  //   await sceneConfig.object.setFlag(isometricModuleConfig.MODULE_ID, "projectionType", newProjection);

  //   // Se a cena sendo editada for a atual, aplica as transformações
  //   //If the scene being edited is the current one, apply the transformations.
  //   if (canvas.scene.id === sceneConfig.object.id) {
  //     requestAnimationFrame(() => {
  //       updateIsometricConstants(newProjection);
  //       applyIsometricPerspective(sceneConfig.object, newIsometric);
  //       applyBackgroundTransformation(sceneConfig.object, newIsometric, newBackground);
  //       canvas.draw(); // Redraw the scene
  //     });
  //   }

  // });

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
  
  // debug print
  // if (isometricModuleConfig.DEBUG_PRINT) console.log("Hooks.on canvasReady");
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
  if (isometricModuleConfig.DEBUG_PRINT) console.log("Hooks.on canvasResize");
}

// Hooks.on("updateScene")
// function handleUpdateScene(scene, changes) {
//   if (scene.id !== canvas.scene?.id) return;

//   if (
//     changes.img ||
//     changes.background?.offsetX !== undefined ||
//     changes.background?.offsetY !== undefined ||
//     changes.flags?.[isometricModuleConfig.MODULE_ID]?.isometricEnabled !== undefined ||
//     changes.flags?.[isometricModuleConfig.MODULE_ID]?.isometricBackground !== undefined ||
//     changes.flags?.[isometricModuleConfig.MODULE_ID]?.projectionType !== undefined ||
//     changes.grid !== undefined ||
//     changes.gridType !== undefined ||
//     changes.gridSize !== undefined
//   ) {
//     const isIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
//     const shouldTransformBackground = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricBackground") ?? false;
//     const projectionType = scene.getFlag(isometricModuleConfig.MODULE_ID, "projectionType") ?? DEFAULT_PROJECTION;

//     // logic for custom projection
//     if (projectionType === 'Custom Projection') {
//       const customProjectionValue = scene.getFlag(isometricModuleConfig.MODULE_ID, "customProjection");
//       if (customProjectionValue) {
//         try {
//           const parsedCustom = parseCustomProjection(customProjectionValue);
//           updateCustomProjection(parsedCustom);
//         } catch (error) {
//           console.error("Error parsing custom projection:", error);
//         }
//       }
//     }

//     requestAnimationFrame(() => {
//       updateIsometricConstants(projectionType);
//       applyIsometricPerspective(scene, isIsometric);
//       applyBackgroundTransformation(scene, isIsometric, shouldTransformBackground);
//     });
//   }
// }


// async function handleCanvasReady(canvas) {
//   const scene = canvas.scene;
//   if (!scene) return;

//   const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
//   const shouldTransformBackground = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricBackground") ?? false;
//   let projectionType = scene.getFlag(isometricModuleConfig.MODULE_ID, "projectionType");
  
//   // If no projection type is set, set the default
//   if (!projectionType) {
//     projectionType = DEFAULT_PROJECTION;
//     await scene.setFlag(isometricModuleConfig.MODULE_ID, "projectionType", projectionType);
//   }

//   // logic to load and apply custom projection
//   if (projectionType === 'Custom Projection') {
//     const customProjectionValue = scene.getFlag(isometricModuleConfig.MODULE_ID, "customProjection");
//     if (customProjectionValue) {
//       try {
//         const parsedCustom = parseCustomProjection(customProjectionValue);
//         updateCustomProjection(parsedCustom);
//       } catch (error) {
//         console.error("Error parsing custom projection:", error);
//       }
//     }
//   }
  
//   updateIsometricConstants(projectionType);
//   applyIsometricPerspective(scene, isSceneIsometric);
//   applyBackgroundTransformation(scene, isSceneIsometric, shouldTransformBackground);
  
//   // debug print
//   if (isometricModuleConfig.) console.log("Hooks.on canvasReady");
// }


// function handleCanvasResize(canvas) {
//   const scene = canvas.scene;
//   if (!scene) return;
  
//   const isSceneIsometric = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricEnabled");
//   const shouldTransformBackground = scene.getFlag(isometricModuleConfig.MODULE_ID, "isometricBackground") ?? false;
//   const projectionType = scene.getFlag(isometricModuleConfig.MODULE_ID, "projectionType") ?? DEFAULT_PROJECTION;

//   updateIsometricConstants(projectionType);
  
//   if (isSceneIsometric && shouldTransformBackground) {
//     applyBackgroundTransformation(scene, isSceneIsometric, shouldTransformBackground);
//   }
  
//   // debug print
//   if (isometricModuleConfig.DEBUG_PRINT) console.log("Hooks.on canvasResize");
// }

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
