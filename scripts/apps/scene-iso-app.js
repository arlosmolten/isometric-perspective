import { MODULE_ID } from '../config.js';
import { applyIsometricPerspective, applyBackgroundTransformation } from '../transform.js';

import {
  updateIsometricConstants,
  parseCustomProjection,
  updateCustomProjection,
  PROJECTION_TYPES,
  DEFAULT_PROJECTION
} from '../consts.js';
import { getScenePresets, getScenePreset, saveScenePreset, deleteScenePreset } from '../presets.js';

const SceneFormApplication = foundry?.applications?.api?.FormApplicationV2
  ?? foundry?.applications?.FormApplication
  ?? globalThis.FormApplication;

const USES_FORM_APPLICATION_V2 = Boolean(foundry?.applications?.api?.FormApplicationV2);
const LEGACY_SCENE_TEMPLATE = 'modules/isometric-perspective/templates/scene-config.html';

function buildProjectionOptions(selected) {
  return Object.keys(PROJECTION_TYPES).map((label) => ({
    value: label,
    label,
    selected: label === selected
  }));
}

export class SceneIsoSettings extends SceneFormApplication {
  static PARTS = USES_FORM_APPLICATION_V2
    ? {
        form: {
          template: LEGACY_SCENE_TEMPLATE
        }
      }
    : undefined;

  static get template() {
    if (USES_FORM_APPLICATION_V2) {
      return super.template ?? LEGACY_SCENE_TEMPLATE;
    }
    return LEGACY_SCENE_TEMPLATE;
  }

  static get defaultOptions() {
    const options = foundry.utils.mergeObject(super.defaultOptions ?? {}, {
      id: 'scene-iso-settings',
      classes: ['isometric-settings', 'scene-isometric'],
      width: 560,
      height: 'auto',
      resizable: true,
      title: game.i18n.localize('isometric-perspective.tab_isometric_name')
    });
    if (!USES_FORM_APPLICATION_V2) {
      options.template = LEGACY_SCENE_TEMPLATE;
    }
    return options;
  }

  constructor(scene, options = {}) {
    super(scene, options);
    if (!USES_FORM_APPLICATION_V2 && !this.options?.template) {
      this.options.template = LEGACY_SCENE_TEMPLATE;
    }
  }

  async getData(options = {}) {
    // SAFEGUARD: Ensure base is an object to prevent spread errors
    const base = (await super.getData(options)) || {};
    const scene = this._resolveSceneDocument();

    // SAFEGUARD: Handle null presets
    const rawPresets = getScenePresets() || {};
    const presets = Object.entries(rawPresets).map(([id, preset]) => ({
      id,
      name: preset.name || 'Unnamed Preset'
    }));

    // Default fallback values
    const defaults = {
      isIsometric: false,
      transformBackground: false,
      scale: 1,
      projectionOptions: buildProjectionOptions(DEFAULT_PROJECTION),
      customProjection: this._defaultCustomProjectionString(),
      isCustomProjection: false,
      presets,
      // SAFEGUARD: Add potential missing fields that template might request as empty strings
      isoBackgroundImage: "",
      isoPath: ""
    };

    if (!scene) {
      return { ...base, ...defaults };
    }

    // SAFEGUARD: Use || as a fallback for null (?? only catches undefined)
    const isIsometric = scene.getFlag(MODULE_ID, 'isometricEnabled') || false;
    const transformBackground = scene.getFlag(MODULE_ID, 'isometricBackground') || false;
    const scale = scene.getFlag(MODULE_ID, 'isometricScale') ?? 1;
    const projectionType = scene.getFlag(MODULE_ID, 'projectionType') || DEFAULT_PROJECTION;

    // Explicitly convert to string and trim, defaulting to internal default if null/empty
    const storedCustom = scene.getFlag(MODULE_ID, 'customProjection');
    const customProjection = storedCustom ? storedCustom.toString() : this._defaultCustomProjectionString();

    return {
      ...base,
      isIsometric,
      transformBackground,
      scale,
      projectionOptions: buildProjectionOptions(projectionType),
      customProjection: customProjection, // Guaranteed string
      isCustomProjection: projectionType === 'Custom Projection',
      presets,
      // If your template uses a background image override, ensure it isn't null
      isoBackgroundImage: scene.getFlag(MODULE_ID, 'isoBackgroundImage') || ""
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

    const projectionSelect = root.querySelector('select[name="flags.isometric-perspective.projectionType"]');
    const customInput = root.querySelector('input[name="flags.isometric-perspective.customProjection"]');

    const toggleCustom = () => {
      if (!projectionSelect || !customInput) return;
      const isCustom = projectionSelect.value === 'Custom Projection';
      customInput.disabled = !isCustom;
      if (isCustom && !customInput.value) {
        customInput.value = this._defaultCustomProjectionString();
      }
    };

    toggleCustom();
    projectionSelect?.addEventListener('change', toggleCustom);

    const presetSelect = root.querySelector('.iso-preset-select');
    const presetApply = root.querySelector('.iso-preset-apply');
    const presetDelete = root.querySelector('.iso-preset-delete');
    const presetSave = root.querySelector('.iso-preset-save');
    const presetName = root.querySelector('.iso-preset-name');

    const togglePresetActions = () => {
      const hasSelection = Boolean(presetSelect?.value);
      if (presetApply) presetApply.disabled = !hasSelection;
      if (presetDelete) presetDelete.disabled = !hasSelection;
    };

    const toggleSaveState = () => {
      const hasName = Boolean(presetName?.value?.toString().trim());
      if (presetSave) presetSave.disabled = !hasName;
    };

    presetSelect?.addEventListener('change', togglePresetActions);
    presetName?.addEventListener('input', toggleSaveState);

    togglePresetActions();
    toggleSaveState();

    presetSave?.addEventListener('click', async () => {
      const name = presetName?.value?.toString().trim();
      if (!name) {
        ui.notifications.warn(game.i18n.localize('isometric-perspective.presets_nameRequired'));
        return;
      }

      const payload = this._normalizePresetPayload(this._collectPresetPayload(root));
      await saveScenePreset(name, payload);
      if (presetName) presetName.value = '';
      toggleSaveState();
      ui.notifications.info(game.i18n.localize('isometric-perspective.presets_saved', { name }));
      await this.render(true);
    });

    presetDelete?.addEventListener('click', async () => {
      const id = presetSelect?.value;
      if (!id) return;
      await deleteScenePreset(id);
      ui.notifications.info(game.i18n.localize('isometric-perspective.presets_deleted'));
      await this.render(true);
    });

    presetApply?.addEventListener('click', async () => {
      const id = presetSelect?.value;
      if (!id) return;
      const preset = getScenePreset(id);
      if (!preset) {
        ui.notifications.error(game.i18n.localize('isometric-perspective.presets_notFound'));
        return;
      }

      const payload = this._normalizePresetPayload(preset.data);
      this._populateFormFields(root, payload);
      await this._applySceneFlags(payload);
    });

    this._wireAutoApply(root);
  }

  async _updateObject(event, formData) {
    const payload = this._normalizePresetPayload(formData);
    await this._applySceneFlags(payload);
  }

  _collectPresetPayload(root) {
    const getInput = (selector) => root.querySelector(selector);
    const scaleInput = getInput('input[name="flags.isometric-perspective.isometricScale"]');
    const projectionSelect = getInput('select[name="flags.isometric-perspective.projectionType"]');
    const customInput = getInput('input[name="flags.isometric-perspective.customProjection"]');
    const isoEnabled = getInput('input[name="flags.isometric-perspective.isometricEnabled"]');
    const transformBackground = getInput('input[name="flags.isometric-perspective.isometricBackground"]');

    return {
      isometricEnabled: Boolean(isoEnabled?.checked),
      transformBackground: Boolean(transformBackground?.checked),
      scale: Number(scaleInput?.value ?? 1),
      projectionType: projectionSelect?.value ?? DEFAULT_PROJECTION,
      customProjection: (customInput?.value ?? '').toString()
    };
  }

  _wireAutoApply(root) {
    if (!root) return;

    const applyChanges = () => {
      const payload = this._normalizePresetPayload(this._collectPresetPayload(root));
      return this._applySceneFlags(payload);
    };

    const debouncedApply = foundry?.utils?.debounce
      ? foundry.utils.debounce(() => { void applyChanges(); }, 150)
      : () => { void applyChanges(); };

    const bindings = [
      { selector: 'input[name="flags.isometric-perspective.isometricEnabled"]', event: 'change' },
      { selector: 'input[name="flags.isometric-perspective.isometricBackground"]', event: 'change' },
      { selector: 'input[name="flags.isometric-perspective.isometricScale"]', event: 'input' },
      { selector: 'select[name="flags.isometric-perspective.projectionType"]', event: 'change' },
      { selector: 'input[name="flags.isometric-perspective.customProjection"]', event: 'change' }
    ];

    bindings.forEach(({ selector, event }) => {
      const element = root.querySelector(selector);
      if (!element) return;
      element.addEventListener(event, () => debouncedApply());
    });
  }

  _normalizePresetPayload(source) {
    if (!source) {
      return {
        isometricEnabled: false,
        transformBackground: false,
        scale: 1,
        projectionType: DEFAULT_PROJECTION,
        customProjection: ''
      };
    }

    const fromForm = source['flags.isometric-perspective.isometricEnabled'] !== undefined ||
      source['flags.isometric-perspective.isometricBackground'] !== undefined;

    let isometricEnabled;
    let transformBackground;
    let scale;
    let projectionType;
    let customProjection;

    if (fromForm) {
      isometricEnabled = Boolean(source['flags.isometric-perspective.isometricEnabled']);
      transformBackground = Boolean(source['flags.isometric-perspective.isometricBackground']);
      const rawScale = Number(source['flags.isometric-perspective.isometricScale'] ?? 1);
      scale = Number.isFinite(rawScale) ? foundry.utils.clamp(rawScale, 0.5, 3) : 1;
      projectionType = source['flags.isometric-perspective.projectionType'] || DEFAULT_PROJECTION;
      customProjection = (source['flags.isometric-perspective.customProjection'] ?? '').toString().trim();
    } else {
      isometricEnabled = Boolean(source.isometricEnabled);
      transformBackground = Boolean(source.transformBackground);
      const rawScale = Number(source.scale ?? 1);
      scale = Number.isFinite(rawScale) ? foundry.utils.clamp(rawScale, 0.5, 3) : 1;
      projectionType = source.projectionType || DEFAULT_PROJECTION;
      customProjection = (source.customProjection ?? '').toString().trim();
    }

    return {
      isometricEnabled,
      transformBackground,
      scale,
      projectionType,
      customProjection
    };
  }

  _populateFormFields(root, payload) {
    if (!payload) return;

    const projectionSelect = root.querySelector('select[name="flags.isometric-perspective.projectionType"]');
    const customInput = root.querySelector('input[name="flags.isometric-perspective.customProjection"]');
    const isoEnabled = root.querySelector('input[name="flags.isometric-perspective.isometricEnabled"]');
    const transformBackground = root.querySelector('input[name="flags.isometric-perspective.isometricBackground"]');
    const scaleInput = root.querySelector('input[name="flags.isometric-perspective.isometricScale"]');
    const rangeValue = root.querySelector('.range-value');

    if (isoEnabled) isoEnabled.checked = payload.isometricEnabled;
    if (transformBackground) transformBackground.checked = payload.transformBackground;
    if (scaleInput) scaleInput.value = payload.scale;
    if (rangeValue) rangeValue.textContent = payload.scale;
    if (projectionSelect) projectionSelect.value = payload.projectionType;
    if (customInput) customInput.value = payload.customProjection;
    projectionSelect?.dispatchEvent(new Event('change'));
  }

  async _applySceneFlags(payload) {
    if (!payload) return;

    const scene = this._resolveSceneDocument();
    if (!scene) return;

    const isoEnabled = Boolean(payload.isometricEnabled);
    const transformBackground = Boolean(payload.transformBackground);
    const scale = payload.scale;
    const projectionType = payload.projectionType || DEFAULT_PROJECTION;
    const customProjectionInput = (payload.customProjection ?? '').toString().trim();

    console.debug('[isometric-perspective] Applying scene flags', {
      sceneId: scene.id,
      isoEnabled,
      transformBackground,
      scale,
      projectionType
    });

    await scene.setFlag(MODULE_ID, 'isometricEnabled', isoEnabled);
    await scene.setFlag(MODULE_ID, 'isometricBackground', transformBackground);
    await scene.setFlag(MODULE_ID, 'isometricScale', scale);
    await scene.setFlag(MODULE_ID, 'projectionType', projectionType);

    if (projectionType === 'Custom Projection') {
      try {
        const parsedCustom = parseCustomProjection(customProjectionInput);
        updateCustomProjection(parsedCustom);
        await scene.setFlag(MODULE_ID, 'customProjection', customProjectionInput);
      } catch (error) {
        ui.notifications.error(error.message ?? error);
        throw error;
      }
    } else {
      await scene.unsetFlag(MODULE_ID, 'customProjection');
    }

    updateIsometricConstants(projectionType);
    if (canvas.scene?.id === scene.id) {
      requestAnimationFrame(() => {
        applyIsometricPerspective(scene, isoEnabled);
        applyBackgroundTransformation(scene, isoEnabled, transformBackground);
      });
    }
  }

    _resolveSceneDocument() {
      const candidates = [
        this.document,
        this.object,
        this.options?.document,
        this.options?.scene,
        canvas?.scene
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

  _defaultCustomProjectionString() {
    // Fallback if consts.js import fails
    if (!PROJECTION_TYPES || !PROJECTION_TYPES['Custom Projection']) {
        return "30, 30, 0, 0, 0, 0, 0, 1.73";
    }
    const projection = PROJECTION_TYPES['Custom Projection'];
    return [
      projection.rotation,
      projection.skewX,
      projection.skewY,
      projection.HudAngle,
      projection.reverseRotation,
      projection.reverseSkewX,
      projection.reverseSkewY,
      projection.ratio
    ].join(', ');
  }
}

if (!USES_FORM_APPLICATION_V2) {
  Reflect.deleteProperty(SceneIsoSettings, 'PARTS');
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