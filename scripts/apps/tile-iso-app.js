import { MODULE_ID } from '../config.js';
import { createAdjustableButton } from '../ui-utils.js';

const TileFormApplication = foundry?.applications?.api?.FormApplicationV2 ?? FormApplication;

export class TileIsoSettings extends TileFormApplication {
  static PARTS = {
    form: {
      template: 'modules/isometric-perspective/templates/tile-config.html'
    }
  };

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions ?? {}, {
      id: 'tile-iso-settings',
      classes: ['isometric-settings', 'tile-isometric'],
      width: 560,
      height: 'auto',
      resizable: true,
      title: game.i18n.localize('isometric-perspective.tab_isometric_name')
    });
  }

  constructor(tileDocument, options = {}) {
    super(tileDocument, options);
    this._cleanupFns = [];
    this._awaitingWallSelection = false;
  }

  async getData(options = {}) {
    const base = await super.getData(options);
    const flags = this.document?.flags?.[MODULE_ID] ?? {};
    const linkedWallIds = flags.linkedWallIds || [];

    return {
      ...base,
      isoTileDisabled: flags.isoTileDisabled ?? false,
      scale: flags.scale ?? 1,
      isFlipped: flags.tokenFlipped ?? false,
      offsetX: flags.offsetX ?? 0,
      offsetY: flags.offsetY ?? 0,
      linkedWallIds: linkedWallIds.join(', '),
      isOccluding: flags.OccludingTile ?? false
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    const root = ensureHTMLElement(html);
    if (!root) return;

    const scaleSlider = root.querySelector('.scale-slider');
    const rangeValue = root.querySelector('.range-value');
    if (scaleSlider && rangeValue) {
      scaleSlider.addEventListener('input', (event) => {
        rangeValue.textContent = event.currentTarget.value;
      });
    }

    const offsetContainer = root.querySelector('.offset-point');
    const offsetInputs = [
      root.querySelector('input[name="flags.isometric-perspective.offsetX"]'),
      root.querySelector('input[name="flags.isometric-perspective.offsetY"]')
    ];
    if (offsetContainer && offsetInputs.every(Boolean)) {
      const fns = createAdjustableButton({
        container: offsetContainer,
        buttonSelector: 'button.fine-adjust',
        inputs: offsetInputs,
        adjustmentScale: 0.1,
        roundingPrecision: 0
      });
      this._cleanupFns.push(...fns);
    }

    const linkedWallInput = root.querySelector('input[name="flags.isometric-perspective.linkedWallIds"]');
    root.querySelector('.select-wall')?.addEventListener('click', () => this._handleWallSelection(linkedWallInput));
    root.querySelector('.clear-wall')?.addEventListener('click', () => this._clearLinkedWalls(linkedWallInput));
  }

  close(options) {
    if (this._cleanupFns && this._cleanupFns.length) {
      for (const fn of this._cleanupFns) try { fn(); } catch (e) {}
    }
    return super.close(options);
  }

  async _updateObject(event, formData) {
    const get = (key, fallback = 0) => {
      const value = formData[`flags.isometric-perspective.${key}`];
      return value ?? fallback;
    };

    const parseNumber = (value, fallback = 0) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };

    const boolFlag = async (key, value) => {
      if (value) return this.document.setFlag(MODULE_ID, key, true);
      return this.document.unsetFlag(MODULE_ID, key);
    };

    const isoTileDisabled = Boolean(get('isoTileDisabled', false));
    const isFlipped = Boolean(get('tokenFlipped', false));
    const isOccluding = Boolean(get('OccludingTile', false));
    const offsetX = parseNumber(get('offsetX', 0));
    const offsetY = parseNumber(get('offsetY', 0));
  const rawScale = parseNumber(get('scale', 1), 1);
  const scale = Number.isFinite(rawScale) ? foundry.utils.clamp(rawScale, 0.01, 3) : 1;
    const linkedWallValue = formData['flags.isometric-perspective.linkedWallIds'] ?? '';
    const linkedWallIds = String(linkedWallValue)
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    await Promise.all([
  boolFlag('isoTileDisabled', isoTileDisabled),
  boolFlag('tokenFlipped', isFlipped),
  boolFlag('OccludingTile', isOccluding),
  this.document.setFlag(MODULE_ID, 'offsetX', offsetX),
  this.document.setFlag(MODULE_ID, 'offsetY', offsetY),
  this.document.setFlag(MODULE_ID, 'scale', scale),
  this.document.setFlag(MODULE_ID, 'linkedWallIds', linkedWallIds)
    ]);
  }

  _handleWallSelection(linkedWallInput) {
    if (this._awaitingWallSelection) return;
    this._awaitingWallSelection = true;
    this.minimize();
    canvas.walls.activate();

    Hooks.once('controlWall', async (wall, controlled) => {
      try {
        if (!controlled || !wall) return;
        const selectedWallId = wall.id;
        const currentWallIds = Array.from(this.document.getFlag(MODULE_ID, 'linkedWallIds') ?? []);
        if (!currentWallIds.includes(selectedWallId)) {
          currentWallIds.push(selectedWallId);
          await this.document.setFlag(MODULE_ID, 'linkedWallIds', currentWallIds);
          if (linkedWallInput) linkedWallInput.value = currentWallIds.join(', ');
        }
      } finally {
        await this._restoreFromWallSelection();
      }
    });
  }

  async _clearLinkedWalls(linkedWallInput) {
    await this.document.setFlag(MODULE_ID, 'linkedWallIds', []);
    if (linkedWallInput) linkedWallInput.value = '';
    canvas.tiles.activate();
  }

  async _restoreFromWallSelection() {
    this._awaitingWallSelection = false;
    try {
      await this.maximize();
    } catch (err) {
      // ignore maximize errors (application may not support it)
    }
    this.bringToTop();
    canvas.tiles.activate();
  }
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
