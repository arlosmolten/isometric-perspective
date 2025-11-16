import { MODULE_ID } from '../config.js';
import { createAdjustableButton, cleanupAlignmentLines } from '../ui-utils.js';

const { FormApplicationV2 } = foundry.applications.api;

export class TokenIsoSettings extends FormApplicationV2 {
  /**
   * Default Options for the application
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'token-iso-settings',
      template: 'modules/isometric-perspective/templates/token-config.html',
      classes: ['isometric-settings', 'token-isometric'],
      width: 540,
      height: 'auto',
      resizable: true,
      title: game.i18n.localize('isometric-perspective.tab_isometric_name')
    });
  }

  constructor(tokenDocument, options = {}) {
    super(tokenDocument, options);
    this.token = this.document.object ?? canvas.tokens?.get(this.document.id);
    this._cleanupFns = [];
  }

  async getData(options = {}) {
    const base = await super.getData(options);
    const flags = this.document?.flags?.[MODULE_ID] ?? {};
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
    // Setup form sliders and inputs
    html.on('input', '.scale-slider', function () {
      html.find('.range-value').text(this.value);
    });

    // Setup anchor toggle
    html.on('change', 'input[name=isoAnchorToggle]', () => {
      const isChecked = html.find('input[name=isoAnchorToggle]').prop('checked');
      if (isChecked) {
        const isoAnchorX = html.find('input[name="flags.isometric-perspective.isoAnchorX"]').val();
        const isoAnchorY = html.find('input[name="flags.isometric-perspective.isoAnchorY"]').val();
        cleanupAlignmentLines();
        // draw initial alignment (via existing helper in token implementation)
      } else {
        cleanupAlignmentLines();
      }
    });

    // Use createAdjustableButton for anchor & offset
  const container = html[0].querySelector('.offset-point');
    if (container) {
      const fns = createAdjustableButton({
        container,
        buttonSelector: 'button.fine-adjust',
        inputs: [html.find('input[name="flags.isometric-perspective.offsetX"]')[0], html.find('input[name="flags.isometric-perspective.offsetY"]')[0]],
        adjustmentScale: 0.2,
        roundingPrecision: 0
      });
      this._cleanupFns.push(...fns);
    }

    const anchorContainer = html[0].querySelector('.anchor-point');
    if (anchorContainer) {
      const fns = createAdjustableButton({
        container: anchorContainer,
        buttonSelector: 'button.fine-adjust-anchor',
        inputs: [html.find('input[name="flags.isometric-perspective.isoAnchorX"]')[0], html.find('input[name="flags.isometric-perspective.isoAnchorY"]')[0]],
        adjustmentScale: 0.005,
        valueConstraints: { min: 0, max: 1 },
        roundingPrecision: 2
      });
      this._cleanupFns.push(...fns);
    }

    // Submit handler
  }

  close(options) {
    if (this._cleanupFns && this._cleanupFns.length) {
      for (const fn of this._cleanupFns) {
        try { fn(); } catch (e) { /* ignore */ }
      }
    }
    cleanupAlignmentLines();
    return super.close(options);
  }

  async _updateObject(event, formData) {
    const get = (key, fallback = 0) => {
      const value = formData[`flags.isometric-perspective.${key}`];
      return value ?? fallback;
    };

    const boolFlag = async (key, value) => {
      if (value) return this.document.setFlag(MODULE_ID, key, true);
      return this.document.unsetFlag(MODULE_ID, key);
    };

    const clamp = (value, { min = -Infinity, max = Infinity } = {}) => {
      if (!Number.isFinite(value)) return value;
      return Math.min(Math.max(value, min), max);
    };

    const isoTokenDisabled = Boolean(get('isoTokenDisabled', false));
    const isoScaleDisabled = Boolean(get('isoScaleDisabled', false));
    const scale = Number(get('scale', 1)) || 1;
    const isoAnchorX = clamp(Number(get('isoAnchorX', 0.5)), { min: 0, max: 1 });
    const isoAnchorY = clamp(Number(get('isoAnchorY', 0.5)), { min: 0, max: 1 });
    const offsetX = Number(get('offsetX', 0)) || 0;
    const offsetY = Number(get('offsetY', 0)) || 0;
    const isoAnchorToggle = Boolean(formData.isoAnchorToggle);

    await Promise.all([
  boolFlag('isoTokenDisabled', isoTokenDisabled),
  boolFlag('isoScaleDisabled', isoScaleDisabled),
  this.document.setFlag(MODULE_ID, 'scale', scale),
  this.document.setFlag(MODULE_ID, 'isoAnchorX', isoAnchorX),
  this.document.setFlag(MODULE_ID, 'isoAnchorY', isoAnchorY),
  this.document.setFlag(MODULE_ID, 'offsetX', offsetX),
  this.document.setFlag(MODULE_ID, 'offsetY', offsetY),
      isoAnchorToggle
  ? this.document.setFlag(MODULE_ID, 'isoAnchorToggle', true)
  : this.document.unsetFlag(MODULE_ID, 'isoAnchorToggle')
    ]);
  }
}
