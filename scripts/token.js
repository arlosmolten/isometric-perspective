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
  const appElement = resolveAppElement(app, html);
  if (!appElement) return;

  const header = appElement.querySelector('.window-header');
  if (!header) return;

  if (header.querySelector('button.iso-config-open')) return;

  const label = game.i18n.localize('isometric-perspective.tab_isometric_name');
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('iso-config-open', 'header-control', 'icon', 'fa-solid', 'fa-cubes');
  button.setAttribute('aria-label', label);
  button.dataset.tooltip = label;

  const title = [...header.querySelectorAll('.window-title, .app-title, h1')].pop();
  if (title?.parentElement === header) {
    title.insertAdjacentElement('afterend', button);
  } else {
    const reference = header.querySelector('.header-control');
    if (reference) header.insertBefore(button, reference);
    else header.append(button);
  }

  button.addEventListener('click', () => {
    const isoApp = new TokenIsoSettings(app.object);
    isoApp.render(true);
  });
}

function resolveAppElement(app, html) {
  const candidates = [
    app?.element?.[0],
    app?.element,
    html?.[0],
    html
  ];

  for (const candidate of candidates) {
    if (candidate instanceof HTMLElement) return candidate.closest('.app, .application') ?? candidate;
  }

  if (Array.isArray(html)) {
    for (const entry of html) {
      if (entry instanceof HTMLElement) return entry.closest('.app, .application') ?? entry;
    }
  }

  return null;
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
  if (!(token instanceof foundry.canvas.placeables.Token)) return;

  const scene = token.scene;
  if (!scene) return;

  const isSceneIsometric = scene.getFlag(MODULE_ID, 'isometricEnabled');
  requestAnimationFrame(() => applyIsometricTransformation(token, isSceneIsometric));
}

function handleTokenDelete(scene, tokenDocument) {
  const token = canvas.tokens?.get(tokenDocument.id);
  removeTokenVisuals(token ?? tokenDocument);
}

