import { MODULE_ID } from '../config.js';
import { createAdjustableButton, cleanupAlignmentLines } from '../ui-utils.js';

const TokenFormApplication = foundry?.applications?.api?.FormApplicationV2
  ?? foundry?.applications?.FormApplication
  ?? globalThis.FormApplication;

const USES_TOKEN_FORM_APPLICATION_V2 = Boolean(foundry?.applications?.api?.FormApplicationV2);
const LEGACY_TOKEN_TEMPLATE = 'modules/isometric-perspective/templates/token-config.html';

export class TokenIsoSettings extends TokenFormApplication {
  static PARTS = USES_TOKEN_FORM_APPLICATION_V2
    ? {
        form: {
          template: LEGACY_TOKEN_TEMPLATE
        }
      }
    : undefined;

  static get defaultOptions() {
    const overrides = {
      id: 'token-iso-settings',
      classes: ['isometric-settings', 'token-isometric'],
      width: 540,
      height: 'auto',
      resizable: true,
      title: game.i18n.localize('isometric-perspective.tab_isometric_name')
    };

    const base = foundry.utils.duplicate(super.defaultOptions ?? {});
    if (!USES_TOKEN_FORM_APPLICATION_V2) {
      overrides.template = LEGACY_TOKEN_TEMPLATE;
    }
    return foundry.utils.mergeObject(base, overrides);
  }

  constructor(tokenDocument, options = {}) {
    super(tokenDocument, options);
    this.document = this._resolveTokenDocument(tokenDocument);
    this.object = this.document ?? this.object ?? tokenDocument;
    this.token = this._resolveTokenPlaceable();
    this._cleanupFns = [];
  }

  async getData(options = {}) {
    const base = (await super.getData(options)) ?? {};
    const tokenDocument = this._resolveTokenDocument();
    const flags = tokenDocument?.flags?.[MODULE_ID] ?? {};
    return {
      ...base,
      isoTokenDisabled: flags.isoTokenDisabled ?? false,
      offsetX: flags.offsetX ?? 0,
      offsetY: flags.offsetY ?? 0,
      isoAnchorX: flags.isoAnchorX ?? 0.5,
      isoAnchorY: flags.isoAnchorY ?? 0.5,
      isoAnchorToggle: flags.isoAnchorToggle ?? false,
      isoScaleDisabled: flags.isoScaleDisabled ?? false,
      scale: flags.scale ?? 1
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

    const anchorToggle = root.querySelector('input[name="isoAnchorToggle"]');
    anchorToggle?.addEventListener('change', () => {
      if (!anchorToggle.checked) {
        cleanupAlignmentLines();
      }
    });

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
        adjustmentScale: 0.2,
        roundingPrecision: 0
      });
      this._cleanupFns.push(...fns);
    }

    const anchorContainer = root.querySelector('.anchor-point');
    const anchorInputs = [
      root.querySelector('input[name="flags.isometric-perspective.isoAnchorX"]'),
      root.querySelector('input[name="flags.isometric-perspective.isoAnchorY"]')
    ];
    if (anchorContainer && anchorInputs.every(Boolean)) {
      const fns = createAdjustableButton({
        container: anchorContainer,
        buttonSelector: 'button.fine-adjust-anchor',
        inputs: anchorInputs,
        adjustmentScale: 0.005,
        valueConstraints: { min: 0, max: 1 },
        roundingPrecision: 2
      });
      this._cleanupFns.push(...fns);
    }

    this._wireAutoApply(root);
  }

  close(options) {
    for (const fn of this._cleanupFns) {
      try {
        fn();
      } catch (error) {
        console.warn('[isometric-perspective] token cleanup failed', error);
      }
    }
    cleanupAlignmentLines();
    return super.close(options);
  }

  async _updateObject(event, formData) {
    await this._applyTokenFlags(this._normalizeTokenPayload(formData));
  }

  _collectTokenPayload(root) {
    if (!root) return null;
    const read = (selector, { type = 'value', parser = (value) => value } = {}) => {
      const input = root.querySelector(selector);
      if (!input) return undefined;
      if (type === 'checked') return Boolean(input.checked);
      return parser(input.value ?? input.textContent ?? 0);
    };

    return {
      isoTokenDisabled: Boolean(read('input[name="flags.isometric-perspective.isoTokenDisabled"]', { type: 'checked' })),
      isoScaleDisabled: Boolean(read('input[name="flags.isometric-perspective.isoScaleDisabled"]', { type: 'checked' })),
      scale: Number(read('input[name="flags.isometric-perspective.scale"]', { parser: Number })) || 1,
      isoAnchorX: Number(read('input[name="flags.isometric-perspective.isoAnchorX"]', { parser: Number })) || 0.5,
      isoAnchorY: Number(read('input[name="flags.isometric-perspective.isoAnchorY"]', { parser: Number })) || 0.5,
      offsetX: Number(read('input[name="flags.isometric-perspective.offsetX"]', { parser: Number })) || 0,
      offsetY: Number(read('input[name="flags.isometric-perspective.offsetY"]', { parser: Number })) || 0,
      isoAnchorToggle: Boolean(read('input[name="isoAnchorToggle"]', { type: 'checked' }))
    };
  }

  async _applyTokenFlags(payload) {
    if (!payload) return;
    const tokenDocument = this._resolveTokenDocument();
    if (!tokenDocument) {
      console.warn('[isometric-perspective] TokenIsoSettings could not resolve a token document to update.');
      return;
    }

    const boolFlag = async (key, value) => {
      if (value) return tokenDocument.setFlag(MODULE_ID, key, true);
      return tokenDocument.unsetFlag(MODULE_ID, key);
    };

    const clamp = (value, { min = -Infinity, max = Infinity } = {}) => {
      if (!Number.isFinite(value)) return value;
      return Math.min(Math.max(value, min), max);
    };

    const isoTokenDisabled = Boolean(payload.isoTokenDisabled);
    const isoScaleDisabled = Boolean(payload.isoScaleDisabled);
    const scale = Number(payload.scale ?? 1) || 1;
    const isoAnchorX = clamp(Number(payload.isoAnchorX ?? 0.5), { min: 0, max: 1 });
    const isoAnchorY = clamp(Number(payload.isoAnchorY ?? 0.5), { min: 0, max: 1 });
    const offsetX = Number(payload.offsetX ?? 0) || 0;
    const offsetY = Number(payload.offsetY ?? 0) || 0;
    const isoAnchorToggle = Boolean(payload.isoAnchorToggle);

    console.debug('[isometric-perspective] Applying token flags', {
      tokenId: tokenDocument.id,
      isoTokenDisabled,
      isoScaleDisabled,
      scale,
      isoAnchorX,
      isoAnchorY,
      offsetX,
      offsetY,
      isoAnchorToggle
    });

    await Promise.all([
      boolFlag('isoTokenDisabled', isoTokenDisabled),
      boolFlag('isoScaleDisabled', isoScaleDisabled),
      tokenDocument.setFlag(MODULE_ID, 'scale', scale),
      tokenDocument.setFlag(MODULE_ID, 'isoAnchorX', isoAnchorX),
      tokenDocument.setFlag(MODULE_ID, 'isoAnchorY', isoAnchorY),
      tokenDocument.setFlag(MODULE_ID, 'offsetX', offsetX),
      tokenDocument.setFlag(MODULE_ID, 'offsetY', offsetY),
      isoAnchorToggle
        ? tokenDocument.setFlag(MODULE_ID, 'isoAnchorToggle', true)
        : tokenDocument.unsetFlag(MODULE_ID, 'isoAnchorToggle')
    ]);
  }

  _normalizeTokenPayload(formData) {
    if (!formData) return null;
    const get = (key, fallback = 0) => {
      const value = formData[`flags.isometric-perspective.${key}`];
      return value ?? fallback;
    };

    return {
      isoTokenDisabled: Boolean(get('isoTokenDisabled', false)),
      isoScaleDisabled: Boolean(get('isoScaleDisabled', false)),
      scale: Number(get('scale', 1)) || 1,
      isoAnchorX: Number(get('isoAnchorX', 0.5)) || 0.5,
      isoAnchorY: Number(get('isoAnchorY', 0.5)) || 0.5,
      offsetX: Number(get('offsetX', 0)) || 0,
      offsetY: Number(get('offsetY', 0)) || 0,
      isoAnchorToggle: Boolean(formData.isoAnchorToggle)
    };
  }

  _wireAutoApply(root) {
    if (!root) return;
    const debouncedApply = foundry?.utils?.debounce
      ? foundry.utils.debounce(() => { void this._applyTokenFlags(this._collectTokenPayload(root)); }, 150)
      : () => { void this._applyTokenFlags(this._collectTokenPayload(root)); };

    const selectors = [
      'input[name="flags.isometric-perspective.isoTokenDisabled"]',
      'input[name="flags.isometric-perspective.isoScaleDisabled"]',
      'input[name="flags.isometric-perspective.scale"]',
      'input[name="flags.isometric-perspective.isoAnchorX"]',
      'input[name="flags.isometric-perspective.isoAnchorY"]',
      'input[name="flags.isometric-perspective.offsetX"]',
      'input[name="flags.isometric-perspective.offsetY"]',
      'input[name="isoAnchorToggle"]'
    ];

    selectors.forEach((selector) => {
      const element = root.querySelector(selector);
      if (!element) return;
      const event = element.type === 'range' || element.type === 'number' ? 'input' : 'change';
      element.addEventListener(event, () => debouncedApply());
    });
  }

  _resolveTokenDocument(fallback) {
    const candidates = [
      this.document,
      this.object,
      fallback,
      this.options?.document,
      this.options?.token,
      canvas?.tokens?.controlled?.[0]?.document
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (typeof candidate.getFlag === 'function') return candidate;
      if (candidate.document && typeof candidate.document.getFlag === 'function') {
        return candidate.document;
      }
    }

    return null;
  }

  _resolveTokenPlaceable() {
    const doc = this._resolveTokenDocument();
    if (doc?.object) return doc.object;
    if (doc?.id) {
      const placeable = canvas.tokens?.get(doc.id);
      if (placeable) return placeable;
    }
    return null;
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
