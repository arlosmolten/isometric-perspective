/**
 * Foundry VTT V13 Configuration Helper for Isometric Perspective
 * This script provides alternative configuration methods when the scene config tab is not available
 */

import { MODULE_ID } from './main.js';
import { updateIsometricConstants, PROJECTION_TYPES, DEFAULT_PROJECTION } from './consts.js';
import { applyIsometricPerspective, applyBackgroundTransformation } from './transform.js';

export function registerV13ConfigHelper() {
  // Add console commands for easy access
  window.IsoConfig = {
    toggle: toggleIsometricMode,
    configure: openConfigDialog,
    setProjection: setProjectionType,
    tokenOffset: openTokenOffsetDialog,
    help: showHelp
  };
  
  // Add to macro bar if possible
  if (game.user.isGM) {
    addMacroBarIntegration();
  }
  
  console.log("Changes working!");
  console.log("Isometric Perspective V13 Helper loaded. Use IsoConfig.help() for commands.");
}

/**
 * Toggle isometric mode on/off for current scene
 */
async function toggleIsometricMode() {
  if (!canvas.scene) {
    ui.notifications.warn("Nenhuma cena ativa para configurar.");
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
  
  ui.notifications.info(`Modo isométrico está ${enable ? "ATIVADO" : "DESATIVADO"}.`);
  return enable;
}

/**
 * Open comprehensive configuration dialog
 */
function openConfigDialog() {
  if (!canvas.scene) {
    ui.notifications.warn("Nenhuma cena ativa para configurar.");
    return;
  }
  
  const currentFlags = {
    isometricEnabled: canvas.scene.getFlag(MODULE_ID, "isometricEnabled") ?? false,
    isometricBackground: canvas.scene.getFlag(MODULE_ID, "isometricBackground") ?? false,
    isometricScale: canvas.scene.getFlag(MODULE_ID, "isometricScale") ?? 1,
    projectionType: canvas.scene.getFlag(MODULE_ID, "projectionType") ?? DEFAULT_PROJECTION
  };
  
  new Dialog({
    title: "Configuração Perspectiva Isométrica",
    content: `
      <form style="font-family: Arial, sans-serif;">
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; font-weight: bold; margin-bottom: 5px;">
            <input type="checkbox" name="isometricEnabled" ${currentFlags.isometricEnabled ? 'checked' : ''} style="margin-right: 8px;"/>
            Ativar Modo Isométrico
          </label>
        </div>
        
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; font-weight: bold; margin-bottom: 5px;">
            <input type="checkbox" name="isometricBackground" ${currentFlags.isometricBackground ? 'checked' : ''} style="margin-right: 8px;"/>
            Transformar Fundo da Cena
          </label>
          <p style="font-size: 12px; color: #666; margin: 5px 0;">Aplica a transformação isométrica ao fundo da cena</p>
        </div>
        
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; font-weight: bold; margin-bottom: 5px;">Escala (0.5 - 3.0):</label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="range" name="isometricScale" min="0.5" max="3" step="0.1" value="${currentFlags.isometricScale}" style="flex: 1;"/>
            <span class="range-value" style="min-width: 40px; font-weight: bold;">${currentFlags.isometricScale}</span>
          </div>
        </div>
        
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; font-weight: bold; margin-bottom: 5px;">Tipo de Projeção:</label>
          <select name="projectionType" style="width: 100%; padding: 5px;">
            ${Object.keys(PROJECTION_TYPES).map(type => 
              `<option value="${type}" ${type === currentFlags.projectionType ? 'selected' : ''}>${type}</option>`
            ).join('')}
          </select>
          <p style="font-size: 12px; color: #666; margin: 5px 0;">Escolha o tipo de projeção isométrica</p>
        </div>
      </form>
    `,
    buttons: {
      apply: {
        icon: '<i class="fas fa-check"></i>',
        label: "Aplicar",
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
          
          ui.notifications.info("Configurações da perspectiva isométrica atualizadas.");
        }
      },
      toggle: {
        icon: '<i class="fas fa-toggle-on"></i>',
        label: "Alternar",
        callback: () => toggleIsometricMode()
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancelar"
      }
    },
    default: "apply",
    render: (html) => {
      // Update range display
      html.find('input[type="range"]').on('input', function() {
        html.find('.range-value').text(this.value);
      });
    }
  }, {
    width: 400,
    height: "auto"
  }).render(true);
}

/**
 * Set projection type for current scene
 */
async function setProjectionType(projectionType) {
  if (!Object.keys(PROJECTION_TYPES).includes(projectionType)) {
    ui.notifications.error(`Tipo de projeção inválido: ${projectionType}`);
    console.log("Tipos disponíveis:", Object.keys(PROJECTION_TYPES));
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
  ui.notifications.info(`Tipo de projeção definido para: ${projectionType}`);
}

/**
 * Open token offset configuration dialog (improved version of your bugfix script)
 */
function openTokenOffsetDialog() {
  const token = canvas.tokens.controlled[0];
  if (!token) {
    ui.notifications.warn("Selecione um token primeiro.");
    return;
  }
  
  const currentOffsetX = token.document.getFlag(MODULE_ID, "offsetX") ?? 0;
  const currentOffsetY = token.document.getFlag(MODULE_ID, "offsetY") ?? 0;
  
  new Dialog({
    title: "Ajustar Offset Isométrico do Token",
    content: `
      <form style="font-family: Arial, sans-serif;">
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; font-weight: bold; margin-bottom: 5px;">Offset X:</label>
          <input type="number" name="offsetX" value="${currentOffsetX}" step="1" style="width: 100%; padding: 5px;"/>
          <p style="font-size: 12px; color: #666; margin: 5px 0;">Ajuste horizontal (padrão: 0)</p>
        </div>
        
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; font-weight: bold; margin-bottom: 5px;">Offset Y:</label>
          <input type="number" name="offsetY" value="${currentOffsetY}" step="1" style="width: 100%; padding: 5px;"/>
          <p style="font-size: 12px; color: #666; margin: 5px 0;">Ajuste vertical (padrão: 0)</p>
        </div>
        
        <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin-top: 15px;">
          <p style="margin: 0; font-size: 12px;"><strong>Token:</strong> ${token.name}</p>
          <p style="margin: 5px 0 0 0; font-size: 12px;"><strong>Posição:</strong> X=${token.x}, Y=${token.y}</p>
        </div>
      </form>
    `,
    buttons: {
      apply: {
        icon: '<i class="fas fa-check"></i>',
        label: "Aplicar",
        callback: async (html) => {
          const offsetX = Number(html.find('[name="offsetX"]').val());
          const offsetY = Number(html.find('[name="offsetY"]').val());
          
          await token.document.update({
            [`flags.${MODULE_ID}.offsetX`]: offsetX,
            [`flags.${MODULE_ID}.offsetY`]: offsetY
          });
          
          ui.notifications.info(`Offset aplicado: X=${offsetX}, Y=${offsetY}`);
        }
      },
      preset1: {
        icon: '<i class="fas fa-magic"></i>',
        label: "Preset 1",
        callback: async (html) => {
          await token.document.update({
            [`flags.${MODULE_ID}.offsetX`]: 90,
            [`flags.${MODULE_ID}.offsetY`]: -2
          });
          ui.notifications.info("Preset 1 aplicado: X=90, Y=-2");
        }
      },
      reset: {
        icon: '<i class="fas fa-undo"></i>',
        label: "Reset",
        callback: async (html) => {
          await token.document.update({
            [`flags.${MODULE_ID}.offsetX`]: 0,
            [`flags.${MODULE_ID}.offsetY`]: 0
          });
          ui.notifications.info("Offset resetado para padrão.");
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancelar"
      }
    },
    default: "apply"
  }, {
    width: 350,
    height: "auto"
  }).render(true);
}

/**
 * Show help information
 */
function showHelp() {
  const helpContent = `
    <div style="font-family: Arial, sans-serif;">
      <h3>Comandos Disponíveis:</h3>
      <ul style="line-height: 1.6;">
        <li><strong>IsoConfig.toggle()</strong> - Alterna o modo isométrico</li>
        <li><strong>IsoConfig.configure()</strong> - Abre o diálogo de configuração</li>
        <li><strong>IsoConfig.setProjection("tipo")</strong> - Define o tipo de projeção</li>
        <li><strong>IsoConfig.tokenOffset()</strong> - Ajusta offset de token selecionado</li>
        <li><strong>IsoConfig.help()</strong> - Mostra esta ajuda</li>
      </ul>
      
      <h3>Tipos de Projeção Disponíveis:</h3>
      <ul style="line-height: 1.6;">
        ${Object.keys(PROJECTION_TYPES).map(type => `<li>${type}</li>`).join('')}
      </ul>
      
      <h3>Exemplo de Uso:</h3>
      <code style="background: #f0f0f0; padding: 10px; display: block; margin: 10px 0;">
        IsoConfig.setProjection("True Isometric")<br/>
        IsoConfig.toggle()
      </code>
    </div>
  `;
  
  new Dialog({
    title: "Ajuda - Perspectiva Isométrica V13",
    content: helpContent,
    buttons: {
      close: {
        icon: '<i class="fas fa-times"></i>',
        label: "Fechar"
      }
    },
    default: "close"
  }, {
    width: 500,
    height: "auto"
  }).render(true);
}

/**
 * Add macro bar integration for quick access
 */
function addMacroBarIntegration() {
  // This will be called when the module is ready
  Hooks.once('ready', () => {
  console.log('[Isometric Perspective] Module loaded. Version check.');
    // Add a notification about available commands
    if (game.user.isGM) {
      ui.notifications.info("Perspectiva Isométrica V13: Use IsoConfig.help() no console para comandos disponíveis.");
    }
  });
}
