import { isometricModuleConfig } from './consts.js';
import { applyIsometricPerspective, applyBackgroundTransformation } from './transform.js';
import { updateIsometricConstants, parseCustomProjection, updateCustomProjection, PROJECTION_TYPES, DEFAULT_PROJECTION, CUSTOM_PROJECTION } from './consts.js';

export function configureIsometricTab(){
  
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

  const footerPart = SceneConfig.PARTS.footer;
  delete SceneConfig.PARTS.footer;
  SceneConfig.PARTS.footer = footerPart;

  // Override part context to include the isometric-perspective config data
  const defaultRenderPartContext = SceneConfig.prototype._preparePartContext;

  SceneConfig.prototype._preparePartContext = async function(partId, context, options) {
    if (partId === "isometric") {
      const flags = this.document.flags[isometricModuleConfig.MODULE_ID] ?? null;
      return {
        ...(flags ?? {}),
        projectionTypes: projectionTypes,
        currentProjection:currentProjection,
        document: this.document,
        tab: context.tabs[partId],
      }
    }
    return defaultRenderPartContext.call(this, partId, context, options);
  }
}

export function addSelectListener (app, html, context, options){
  const projectionSelect = html.querySelector('select[name="flags.isometric-perspective.projectionType"]')
  projectionSelect.addEventListener('change', onSelectProjection);
}

export function onSelectProjection (event){
  console.log("TEST!", event);
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
