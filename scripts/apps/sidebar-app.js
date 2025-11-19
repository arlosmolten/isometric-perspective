import { SceneIsoSettings } from './scene-iso-app.js';
import { TokenIsoSettings } from './token-iso-app.js';
import { TileIsoSettings } from './tile-iso-app.js';
import { MODULE_ID } from '../config.js';

let sidebarInstance = null;
let IsoSidebarAppClass = null;
let IsoSidebarAppPromise = null;
let USES_APPLICATION_V2 = false;

export async function openIsoSidebar() {
  try {
    const SidebarApp = await ensureIsoSidebarAppClass();
    if (!SidebarApp) return;

    if (!sidebarInstance || isAppDestroyed(sidebarInstance)) {
      sidebarInstance = new SidebarApp();
    }

    renderCompat(sidebarInstance, { focus: true });
  } catch (error) {
    console.error('[isometric-perspective] Failed to open IsoSidebarApp', error);
    ui.notifications?.error('Failed to open the Isometric Toolkit panel. Check console for details.');
  }
}

async function ensureIsoSidebarAppClass() {
  if (IsoSidebarAppClass) return IsoSidebarAppClass;
  if (!IsoSidebarAppPromise) {
    IsoSidebarAppPromise = buildIsoSidebarAppClass();
  }
  return IsoSidebarAppPromise;
}

async function buildIsoSidebarAppClass() {
  await ensureFoundryReady();

  const api = foundry?.applications?.api ?? {};
  const { ApplicationV2, HandlebarsApplicationMixin } = api;
  let BaseApplication = null;

  if (ApplicationV2 && HandlebarsApplicationMixin) {
    USES_APPLICATION_V2 = true;
    BaseApplication = HandlebarsApplicationMixin(ApplicationV2);
  } else {
    USES_APPLICATION_V2 = false;
    BaseApplication = foundry?.applications?.FormApplication
      ?? globalThis.FormApplication
      ?? foundry?.applications?.Application
      ?? globalThis.Application
      ?? null;
    if (!BaseApplication) {
      console.error('[isometric-perspective] Unable to locate a usable Application base to render the sidebar panel.');
      ui.notifications?.error('Isometric Toolkit could not initialize its sidebar panel. See console for details.');
      return null;
    }

    console.warn('[isometric-perspective] ApplicationV2 API unavailable – falling back to legacy FormApplication rendering.');
  }

  class IsoSidebarApp extends BaseApplication {
    constructor(...args) {
      super(...args);
      this._hookBindings = [];
      const requestRender = () => {
        if (!this.rendered) return;
        this._refreshPanel({ action: 'iso-sidebar-refresh' });
      };
      this._requestRefresh = foundry?.utils?.debounce
        ? foundry.utils.debounce(requestRender, 75)
        : requestRender;
    }

    static get defaultOptions() {
      const merged = foundry.utils.mergeObject(super.defaultOptions ?? {}, {
        id: 'iso-sidebar-panel',
        classes: ['isometric-settings', 'iso-sidebar-panel'],
        title: game.i18n.localize('isometric-perspective.sidebar_title'),
        width: 360,
        height: 'auto',
        resizable: false
      });

      if (!USES_APPLICATION_V2) {
        merged.template = 'modules/isometric-perspective/templates/sidebar-panel.html';
      }

      return merged;
    }

    async getData(options = {}) {
      const scene = canvas?.scene ?? null;
      const sceneFlags = scene?.flags?.[MODULE_ID] ?? {};
      const controlledTokens = Array.from(canvas?.tokens?.controlled ?? []);
      const tokenDocuments = controlledTokens.map((token) => token?.document).filter(Boolean);
      const primaryToken = tokenDocuments[0] ?? null;
      const tokenFlags = primaryToken?.flags?.[MODULE_ID] ?? {};

      const sceneScaleRaw = Number(sceneFlags.isometricScale ?? 1);
      const tokenScaleRaw = Number(tokenFlags.scale ?? 1);
      const tokensAllDisabled = tokenDocuments.length
        ? tokenDocuments.every((doc) => Boolean(doc.getFlag(MODULE_ID, 'isoTokenDisabled')))
        : false;

      return {
        sceneName: scene?.name ?? null,
        sceneIsIso: Boolean(sceneFlags.isometricEnabled),
        sceneBackground: Boolean(sceneFlags.isometricBackground),
        sceneScale: Number.isFinite(sceneScaleRaw) ? sceneScaleRaw.toFixed(2) : '1.00',
        sceneCanToggle: Boolean(game.user?.isGM && scene),
        hasTokenSelection: Boolean(tokenDocuments.length),
        tokenName: primaryToken?.name ?? null,
        tokenIsoEnabled: Boolean(tokenDocuments.length) ? !tokensAllDisabled : false,
        tokenScale: Number.isFinite(tokenScaleRaw) ? tokenScaleRaw.toFixed(2) : '1.00',
        hasTileSelection: Boolean(canvas?.tiles?.controlled?.length)
      };
    }

    activateListeners(html) {
      super.activateListeners(html);
      const root = ensureHTMLElement(html);
      if (!root) return;

      root.querySelectorAll('[data-action]')?.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const action = event.currentTarget?.dataset?.action;
          if (action) void this._handleAction(action);
        });
      });

      this._ensureRealtimeBindings();
    }

    async close(options = {}) {
      this._teardownRealtimeBindings();
      return super.close(options);
    }

    async _handleAction(action) {
      switch (action) {
        case 'toggle-scene-iso':
          await this._toggleSceneIsometric();
          break;
        case 'toggle-scene-background':
          await this._toggleSceneBackground();
          break;
        case 'toggle-token-iso':
          await this._toggleTokenIsometric();
          break;
        case 'scene-settings':
          this._openSceneSettings();
          break;
        case 'token-settings':
          this._openTokenSettings();
          break;
        case 'tile-settings':
          this._openTileSettings();
          break;
        default:
          break;
      }
    }

    async _toggleSceneIsometric() {
      if (!game.user?.isGM) {
        ui.notifications?.warn(game.i18n.localize('isometric-perspective.sidebar_requiresGM'));
        return;
      }
      const scene = canvas?.scene;
      if (!scene) {
        ui.notifications?.warn(game.i18n.localize('isometric-perspective.sidebar_noScene'));
        return;
      }
      const current = Boolean(scene.getFlag(MODULE_ID, 'isometricEnabled'));
      await scene.setFlag(MODULE_ID, 'isometricEnabled', !current);
      await this._refreshPanel();
    }

    async _toggleSceneBackground() {
      if (!game.user?.isGM) {
        ui.notifications?.warn(game.i18n.localize('isometric-perspective.sidebar_requiresGM'));
        return;
      }
      const scene = canvas?.scene;
      if (!scene) {
        ui.notifications?.warn(game.i18n.localize('isometric-perspective.sidebar_noScene'));
        return;
      }
      const current = Boolean(scene.getFlag(MODULE_ID, 'isometricBackground'));
      await scene.setFlag(MODULE_ID, 'isometricBackground', !current);
      await this._refreshPanel();
    }

    async _toggleTokenIsometric() {
      const controlled = Array.from(canvas?.tokens?.controlled ?? []);
      const documents = controlled.map((token) => token?.document).filter(Boolean);
      if (!documents.length) {
        ui.notifications?.warn(game.i18n.localize('isometric-perspective.sidebar_selectToken'));
        return;
      }

      const allDisabled = documents.every((doc) => Boolean(doc.getFlag(MODULE_ID, 'isoTokenDisabled')));
      const operations = documents.map((doc) => (
        allDisabled
          ? doc.unsetFlag(MODULE_ID, 'isoTokenDisabled')
          : doc.setFlag(MODULE_ID, 'isoTokenDisabled', true)
      ));

      await Promise.all(operations);
      await this._refreshPanel();
    }

    _openSceneSettings() {
      if (!game.user?.isGM) {
        ui.notifications?.warn(game.i18n.localize('isometric-perspective.sidebar_requiresGM'));
        return;
      }
      const scene = canvas?.scene;
      if (!scene) {
        ui.notifications?.warn(game.i18n.localize('isometric-perspective.sidebar_noScene'));
        return;
      }
      new SceneIsoSettings(scene).render(true);
    }

    _openTokenSettings() {
      const controlled = canvas?.tokens?.controlled;
      const target = controlled?.[0]?.document;
      if (!target) {
        ui.notifications?.warn(game.i18n.localize('isometric-perspective.sidebar_selectToken'));
        return;
      }
      new TokenIsoSettings(target).render(true);
    }

    _openTileSettings() {
      const controlled = canvas?.tiles?.controlled;
      const target = controlled?.[0]?.document;
      if (!target) {
        ui.notifications?.warn(game.i18n.localize('isometric-perspective.sidebar_selectTile'));
        return;
      }
      new TileIsoSettings(target).render(true);
    }

    _ensureRealtimeBindings() {
      if (this._hookBindings?.length) return;
      this._hookBindings = [];

      const refresh = () => this._requestRefresh();
      const refreshIfViewedScene = (scene) => {
        if (scene?.id === canvas?.scene?.id) this._requestRefresh();
      };

      this._registerHook('controlToken', refresh);
      this._registerHook('updateToken', refresh);
      this._registerHook('deleteToken', refresh);
      this._registerHook('controlTile', refresh);
      this._registerHook('updateTile', refresh);
      this._registerHook('deleteTile', refresh);
      this._registerHook('canvasReady', refresh);
      this._registerHook('updateScene', refreshIfViewedScene);
      this._registerHook('deleteScene', refreshIfViewedScene);
    }

    _registerHook(event, handler) {
      Hooks.on(event, handler);
      this._hookBindings.push({ event, handler });
    }

    _teardownRealtimeBindings() {
      if (!this._hookBindings?.length) return;
      for (const { event, handler } of this._hookBindings) {
        Hooks.off(event, handler);
      }
      this._hookBindings.length = 0;
    }

    _refreshPanel(options = {}) {
      if (!this.rendered) return null;
      const renderOptions = USES_APPLICATION_V2
        ? { parts: ['form'], ...options }
        : options;
      return renderCompat(this, renderOptions, true);
    }
  }

  if (USES_APPLICATION_V2) {
    IsoSidebarApp.PARTS = {
      form: {
        template: 'modules/isometric-perspective/templates/sidebar-panel.html'
      }
    };
    IsoSidebarApp.template = 'modules/isometric-perspective/templates/sidebar-panel.html';
  } else {
    IsoSidebarApp.template = 'modules/isometric-perspective/templates/sidebar-panel.html';
  }

  IsoSidebarAppClass = IsoSidebarApp;
  return IsoSidebarAppClass;
}

function ensureHTMLElement(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  if (Array.isArray(element)) {
    for (const entry of element) {
      if (entry instanceof HTMLElement) return entry;
    }
  }
  return null;
}

function renderCompat(app, options = {}, force = false) {
  if (USES_APPLICATION_V2) return app.render(options);
  return app.render(force, options);
}

function isAppDestroyed(app) {
  if (!app) return true;
  if (Object.prototype.hasOwnProperty.call(app, 'destroyed')) return Boolean(app.destroyed);
  if (Object.prototype.hasOwnProperty.call(app, '_state')) {
    const state = app._state ?? 0;
    return typeof Application !== 'undefined'
      ? state <= (Application.RENDER_STATES?.CLOSED ?? Application.RENDER_STATES?.NONE ?? 0)
      : state < 0;
  }
  return false;
}

async function ensureFoundryReady() {
  if (game?.ready) return;
  if (typeof Hooks === 'undefined') return;
  await new Promise((resolve) => {
    Hooks.once('ready', resolve);
  });
}
