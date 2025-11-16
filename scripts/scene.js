import { MODULE_ID, logDebug, logError } from './config.js';
import { applyIsometricPerspective, applyBackgroundTransformation } from './transform.js';
import { updateIsometricConstants, parseCustomProjection, updateCustomProjection, DEFAULT_PROJECTION } from './consts.js';
import { SceneIsoSettings } from './apps/scene-iso-app.js';

export function registerSceneConfig() {
  Hooks.on('renderSceneConfig', addSceneIsoButton);
  Hooks.on("updateScene", handleUpdateScene);
  Hooks.on("canvasReady", handleCanvasReady);
  Hooks.on("canvasResize", handleCanvasResize); 
}

function addSceneIsoButton(sceneConfig, html) {
  const $html = html.jquery ? html : $(html);
  if ($html.find('button.iso-scene-config-open').length) return;

  const titleSelectors = [
    '.window-header .window-title',
    '.window-header .app-title',
    '.window-header h1'
  ];

  let titleArea = $();
  for (const selector of titleSelectors) {
    const match = $html.find(selector);
    if (match.length) {
      titleArea = match.last();
      break;
    }
  }

  const header = $html.find('.window-header');
  if (!header.length) return;

  const label = game.i18n.localize('isometric-perspective.tab_isometric_name');
  const button = $(`<button type="button" class="iso-scene-config-open header-control" title="${label}"><span>${label}</span></button>`);
  if (titleArea.length) {
    titleArea.after(button);
  } else {
    const firstControl = header.find('.header-control').first();
    if (firstControl.length) {
      button.insertBefore(firstControl);
    } else {
      header.append(button);
    }
  }

  button.on('click', () => {
    const isoApp = new SceneIsoSettings(sceneConfig.object);
    isoApp.render(true);
  });
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
  changes.flags?.[MODULE_ID]?.customProjection !== undefined ||
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
          logError("Error parsing custom projection:", error);
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
        logError("Error parsing custom projection:", error);
      }
    }
  }
  
  updateIsometricConstants(projectionType);
  applyIsometricPerspective(scene, isSceneIsometric);
  applyBackgroundTransformation(scene, isSceneIsometric, shouldTransformBackground);
  
  // debug print
  logDebug("Hooks.on canvasReady");
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
  logDebug("Hooks.on canvasResize");
}
