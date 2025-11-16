import { MODULE_ID } from './config.js';
import { TokenIsoSettings } from './apps/token-iso-app.js';
import { applyIsometricTransformation, removeTokenVisuals } from './transform.js';

export function registerTokenConfig() {
  Hooks.on('renderTokenConfig', addTokenIsoButton);
  Hooks.on('createToken', handleTokenMutation);
  Hooks.on('updateToken', handleTokenMutation);
  Hooks.on('refreshToken', handleTokenRefresh);
  Hooks.on('deleteToken', handleTokenDelete);
}

function addTokenIsoButton(app, html) {
  const header = html.find('.window-header .window-title');
  if (!header.length) return;
  if (html.find('button.iso-config-open').length) return;

  const label = game.i18n.localize('isometric-perspective.tab_isometric_name');
  const button = $(`<button type="button" class="iso-config-open" title="${label}">${label}</button>`);
  header.after(button);

  button.on('click', () => {
    const isoApp = new TokenIsoSettings(app.object);
    isoApp.render(true);
  });
}

function handleTokenMutation(tokenDocument) {
  const token = canvas.tokens?.get(tokenDocument.id);
  if (!token) return;

  const scene = token.scene;
  if (!scene) return;

  const isSceneIsometric = scene.getFlag(MODULE_ID, 'isometricEnabled');
  requestAnimationFrame(() => applyIsometricTransformation(token, isSceneIsometric));
}

function handleTokenRefresh(token) {
  if (!(token instanceof Token)) return;

  const scene = token.scene;
  if (!scene) return;

  const isSceneIsometric = scene.getFlag(MODULE_ID, 'isometricEnabled');
  requestAnimationFrame(() => applyIsometricTransformation(token, isSceneIsometric));
}

function handleTokenDelete(scene, tokenDocument) {
  const token = canvas.tokens?.get(tokenDocument.id);
  removeTokenVisuals(token ?? tokenDocument);
}

