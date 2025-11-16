import { registerSceneConfig } from './scene.js';
import { registerTokenConfig } from './token.js';
import { registerTileConfig } from './tile.js';
import { registerHUDConfig } from './hud.js';
import { registerSortingConfig } from './autosorting.js';
import { registerDynamicTileConfig } from './dynamictile.js';
import { MODULE_ID } from './config.js';

//import { registerOcclusionConfig } from './silhouetetoken.js';
import { registerOcclusionConfig } from './occlusion.js';

// ---------- CONSTANTS ----------

// NOTE: runtime flags are accessed through config helpers (isDebugEnabled etc.)


// Hook to register module configuration in Foundry VTT
Hooks.once("init", function() {

  // ------------- Registra as configurações do módulo -------------
  // Checkbox configuration to enable or disable isometric mode globally
  game.settings.register(MODULE_ID, "worldIsometricFlag", {
    name: game.i18n.localize('isometric-perspective.settings_main_name'), //name: "Enable Isometric Perspective",
    hint: game.i18n.localize('isometric-perspective.settings_main_hint'), //hint: "Toggle whether the isometric perspective is applied to the canvas.",
    scope: "world",  // "world" = sync to db, "client" = local storage
    config: true,    // false if you dont want it to show in module config
    type: Boolean,   // You want the primitive class, e.g. Number, not the name of the class as a string
    default: true,
    requiresReload: true // true if you want to prompt the user to reload
    //onChange: settings => window.location.reload() // recarrega automaticamente
  });

  game.settings.register(MODULE_ID, 'enableHeightAdjustment', {
    name: game.i18n.localize('isometric-perspective.settings_height_name'), //name: 'Enable Height Adjustment',
    hint: game.i18n.localize('isometric-perspective.settings_height_hint'), //hint: 'Toggle whether token sprites adjust their position to reflect their elevation',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, 'enableTokenVisuals', {
    name: game.i18n.localize('isometric-perspective.settings_visuals_name'), //name: 'Enable Token Visuals',
    hint: game.i18n.localize('isometric-perspective.settings_visuals_hint'), //hint: 'Displays a circular shadow and a vertical red line to indicate token elevation. Requires "Enable Height Adjustment" to be active.',
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, 'enableOcclusionDynamicTile', {
    name: game.i18n.localize('isometric-perspective.settings_dynamic_tile_name'),
    hint: game.i18n.localize('isometric-perspective.settings_dynamic_tile_hint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, 'enableOcclusionTokenSilhouette', {
    name: game.i18n.localize('isometric-perspective.settings_token_silhouette_name'), //'Enable Occlusion: Token Silhouette',
    hint: game.i18n.localize('isometric-perspective.settings_token_silhouette_hint'), //'Adjusts the visibility of tiles dynamically with the positioning of tokens.',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      "off": "Off",
      "gpu": "GPU Mode",
      "cpu1": "CPU Mode (Chunk Size 1)",
      "cpu2": "CPU Mode (Chunk Size 2)",
      "cpu3": "CPU Mode (Chunk Size 3)",
      "cpu4": "CPU Mode (Chunk Size 4)",
      "cpu6": "CPU Mode (Chunk Size 6)",
      "cpu8": "CPU Mode (Chunk Size 8)",
      "cpu10": "CPU Mode (Chunk Size 10)"
    },
    default: "off",
    requiresReload: true
  });

  game.settings.register(MODULE_ID, 'enableAutoSorting', {
    name: game.i18n.localize('isometric-perspective.settings_token_sort_name'),
    hint: game.i18n.localize('isometric-perspective.settings_token_sort_hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  // Welcome screen option
  game.settings.register(MODULE_ID, 'showWelcome', {
    name: game.i18n.localize('isometric-perspective.settings_welcome_name'),
    hint: game.i18n.localize('isometric-perspective.settings_welcome_hint'),
    scope: 'client',
    config: true,
    default: true,
    type: Boolean,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, 'scenePresets', {
    name: 'Scene Presets',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  // ------------- Execute the module hooks and initialization -------------
  registerSceneConfig();
  registerTokenConfig();
  registerTileConfig();
  registerHUDConfig();

  // Feature hooks and non-essential modules
  registerDynamicTileConfig();
  registerSortingConfig();
  registerOcclusionConfig();

  // No explicit FOUNDRY_VERSION variable needed; use getFoundryVersion().major when necessary

}); // end Hooks.once('init')

// Welcome Message Setup
export class WelcomeScreen extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'isometric-perspective-welcome',
      template: "modules/isometric-perspective/templates/welcome.html",
      width: 600,
      height: 620,
      classes: ["welcome-screen"],
      resizable: false,
      title: "Isometric Perspective Module",
      modal: true
    });
  }

  // Provide data for the template
  async getData(options = {}) {
    return {
      showWelcome: game.settings.get(MODULE_ID, 'showWelcome')
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Initialize checkbox with the current setting
    const checkbox = html.find('#show-on-start');
    if (checkbox.length) checkbox.prop('checked', game.settings.get(MODULE_ID, 'showWelcome'));

    // Toggle setting when user changes the checkbox
    html.find('#show-on-start').on('change', async (ev) => {
      const checked = ev.currentTarget.checked;
      await game.settings.set(MODULE_ID, 'showWelcome', checked);
    });

    // Close button
    html.find('.close-welcome').on('click', (ev) => {
      this.close();
    });
  }
}

Hooks.once('ready', async function() {
  if (game.settings.get(MODULE_ID, "showWelcome")) {
    const welcome = new WelcomeScreen();
    welcome.render(true);
  }
});