import { MODULE_ID } from './main.js';
import { updateIsometricConstants, PROJECTION_TYPES, DEFAULT_PROJECTION } from './consts.js';
import { applyIsometricPerspective, applyBackgroundTransformation } from './transform.js';

/**
 * Macro Integration for Isometric Perspective Module
 * Provides alternative configuration methods when scene config tab is not available
 */

export function registerMacroIntegration() {
  // Register global functions for macro use
  window.IsometricPerspective = {
    toggle: toggleIsometric,
    configure: configureIsometric,
    setProjection: setProjectionType,
    openTokenDialog: openTokenOffsetDialog
  };
  
  // Add context menu option to scene navigation
  Hooks.on("getSceneNavigationContext", addSceneContextMenu);
}

/**
 * Toggle isometric mode on/off for current scene
 */
async function toggleIsometric() {
  if (!canvas.scene) {
    ui.notifications.warn("No active scene to configure.");
    return;
  }
  
  const current = canvas.scene.getFlag(MODULE_ID, "isometricEnabled") ?? false;
  const enable = !current;
  
  await canvas.scene.update({
    flags: {
      [MODULE_ID]: {
        isometricEnabled: enable,
        isometricBackground: enable,
        isometricScale: canvas.scene.getFlag(MODULE_ID, "isometricScale") ?? 1,
        projectionType: canvas.scene.getFlag(MODULE_ID, "projectionType") ?? DEFAULT_PROJECTION
      }
    }
  });
  
  ui.notifications.info(`Isometric mode is ${enable ? "ON" : "OFF"}.`);
}

/**
 * Open configuration dialog for isometric settings
 */
function configureIsometric() {
  if (!canvas.scene) {
    ui.notifications.warn("No active scene to configure.");
    return;
  }
  
  const currentFlags = {
    isometricEnabled: canvas.scene.getFlag(MODULE_ID, "isometricEnabled") ?? false,
    isometricBackground: canvas.scene.getFlag(MODULE_ID, "isometricBackground") ?? false,
    isometricScale: canvas.scene.getFlag(MODULE_ID, "isometricScale") ?? 1,
    projectionType: canvas.scene.getFlag(MODULE_ID, "projectionType") ?? DEFAULT_PROJECTION
  };
  
  new Dialog({
    title: "Isometric Perspective Configuration",
    content: `
      <form>
        <div class="form-group">
          <label>Enable Isometric Mode:</label>
          <input type="checkbox" name="isometricEnabled" ${currentFlags.isometricEnabled ? 'checked' : ''}/>
        </div>
        <div class="form-group">
          <label>Transform Background:</label>
          <input type="checkbox" name="isometricBackground" ${currentFlags.isometricBackground ? 'checked' : ''}/>
        </div>
        <div class="form-group">
          <label>Scale (0.5 - 3.0):</label>
          <input type="range" name="isometricScale" min="0.5" max="3" step="0.1" value="${currentFlags.isometricScale}"/>
          <span class="range-value">${currentFlags.isometricScale}</span>
        </div>
        <div class="form-group">
          <label>Projection Type:</label>
          <select name="projectionType">
            ${Object.keys(PROJECTION_TYPES).map(type => 
              `<option value="${type}" ${type === currentFlags.projectionType ? 'selected' : ''}>${type}</option>`
            ).join('')}
          </select>
        </div>
      </form>
    `,
    buttons: {
      apply: {
        label: "Apply",
        callback: async (html) => {
          const formData = new FormData(html.find('form')[0]);
          const newFlags = {
            isometricEnabled: formData.get('isometricEnabled') === 'on',
            isometricBackground: formData.get('isometricBackground') === 'on',
            isometricScale: parseFloat(formData.get('isometricScale')),
            projectionType: formData.get('projectionType')
          };
          
          await canvas.scene.update({
            flags: {
              [MODULE_ID]: newFlags
            }
          });
          
          ui.notifications.info("Isometric perspective settings updated.");
        }
      },
      cancel: {
        label: "Cancel"
      }
    },
    default: "apply",
    render: (html) => {
      // Update range display
      html.find('input[type="range"]').on('input', function() {
        html.find('.range-value').text(this.value);
      });
    }
  }).render(true);
}

/**
 * Set projection type for current scene
 */
async function setProjectionType(projectionType) {
  if (!Object.keys(PROJECTION_TYPES).includes(projectionType)) {
    ui.notifications.error(`Invalid projection type: ${projectionType}`);
    return;
  }
  
  await canvas.scene.update({
    flags: {
      [MODULE_ID]: {
        projectionType: projectionType
      }
    }
  });
  
  updateIsometricConstants(projectionType);
  ui.notifications.info(`Projection type set to: ${projectionType}`);
}

/**
 * Open token offset configuration dialog
 */
function openTokenOffsetDialog() {
  const token = canvas.tokens.controlled[0];
  if (!token) {
    ui.notifications.warn("Please select a token first.");
    return;
  }
  
  const currentOffsetX = token.document.getFlag(MODULE_ID, "offsetX") ?? 0;
  const currentOffsetY = token.document.getFlag(MODULE_ID, "offsetY") ?? 0;
  
  new Dialog({
    title: "Adjust Isometric Token Offset",
    content: `
      <form>
        <div class="form-group">
          <label>Offset X:</label>
          <input type="number" name="offsetX" value="${currentOffsetX}" step="1"/>
        </div>
        <div class="form-group">
          <label>Offset Y:</label>
          <input type="number" name="offsetY" value="${currentOffsetY}" step="1"/>
        </div>
        <p class="notes">Adjust these values to fine-tune token positioning in isometric view.</p>
      </form>
    `,
    buttons: {
      apply: {
        label: "Apply",
        callback: async (html) => {
          const offsetX = Number(html.find('[name="offsetX"]').val());
          const offsetY = Number(html.find('[name="offsetY"]').val());
          
          await token.document.update({
            [`flags.${MODULE_ID}.offsetX`]: offsetX,
            [`flags.${MODULE_ID}.offsetY`]: offsetY
          });
          
          ui.notifications.info(`Offset applied: X=${offsetX}, Y=${offsetY}`);
        }
      },
      reset: {
        label: "Reset",
        callback: async (html) => {
          await token.document.update({
            [`flags.${MODULE_ID}.offsetX`]: 0,
            [`flags.${MODULE_ID}.offsetY`]: 0
          });
          
          ui.notifications.info("Token offset reset to default.");
        }
      },
      cancel: {
        label: "Cancel"
      }
    },
    default: "apply"
  }).render(true);
}

/**
 * Add context menu options to scene navigation
 */
function addSceneContextMenu(html, contextOptions) {
  contextOptions.push({
    name: "Configure Isometric",
    icon: '<i class="fas fa-cube"></i>',
    condition: li => {
      const scene = game.scenes.get(li.data("sceneId"));
      return scene && game.user.isGM;
    },
    callback: li => {
      const scene = game.scenes.get(li.data("sceneId"));
      if (scene) {
        // Temporarily set the scene as current for configuration
        const originalScene = canvas.scene;
        canvas.scene = scene;
        configureIsometric();
        canvas.scene = originalScene;
      }
    }
  });
}
