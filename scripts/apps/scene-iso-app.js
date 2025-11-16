import { MODULE_ID } from '../config.js';
import { applyIsometricPerspective, applyBackgroundTransformation } from '../transform.js';
const { FormApplicationV2 } = foundry.applications.api;

import {
  updateIsometricConstants,
  parseCustomProjection,
  updateCustomProjection,
  PROJECTION_TYPES,
  DEFAULT_PROJECTION
} from '../consts.js';
import { getScenePresets, getScenePreset, saveScenePreset, deleteScenePreset } from '../presets.js';

function buildProjectionOptions(selected) {
  return Object.keys(PROJECTION_TYPES).map((label) => ({
    value: label,
    label,
    selected: label === selected
  }));
}

export class SceneIsoSettings extends FormApplicationV2 {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'scene-iso-settings',
      template: 'modules/isometric-perspective/templates/scene-config.html',
      classes: ['isometric-settings', 'scene-isometric'],
      width: 560,
      height: 'auto',
      resizable: true,
      title: game.i18n.localize('isometric-perspective.tab_isometric_name')
    });
  }

  constructor(scene, options = {}) {
    super(scene, options);
  }

  async getData(options = {}) {
    const base = await super.getData(options);
    const scene = this.document ?? canvas.scene;
    const rawPresets = getScenePresets();
    const presets = Object.entries(rawPresets).map(([id, preset]) => ({
      id,
      name: preset.name
    }));

    if (!scene) {
      return {
        ...base,
        isIsometric: false,
        transformBackground: false,
        scale: 1,
        projectionOptions: buildProjectionOptions(DEFAULT_PROJECTION),
        customProjection: this._defaultCustomProjectionString(),
        isCustomProjection: false,
        presets
      };
    }

    const isIsometric = scene.getFlag(MODULE_ID, 'isometricEnabled') ?? false;
    const transformBackground = scene.getFlag(MODULE_ID, 'isometricBackground') ?? false;
    const scale = scene.getFlag(MODULE_ID, 'isometricScale') ?? 1;
    const projectionType = scene.getFlag(MODULE_ID, 'projectionType') ?? DEFAULT_PROJECTION;
    const storedCustom = scene.getFlag(MODULE_ID, 'customProjection');
    const customProjection = storedCustom ?? this._defaultCustomProjectionString();

    return {
      ...base,
      isIsometric,
      transformBackground,
      scale,
      projectionOptions: buildProjectionOptions(projectionType),
      customProjection,
      isCustomProjection: projectionType === 'Custom Projection',
      presets
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on('input', '.scale-slider', function () {
      html.find('.range-value').text(this.value);
    });

    const projectionSelect = html.find('select[name="flags.isometric-perspective.projectionType"]');
    const customInput = html.find('input[name="flags.isometric-perspective.customProjection"]');

    const toggleCustom = () => {
      const isCustom = projectionSelect.val() === 'Custom Projection';
      customInput.prop('disabled', !isCustom);
      if (isCustom && !customInput.val()) {
        customInput.val(this._defaultCustomProjectionString());
      }
    };

    toggleCustom();
    projectionSelect.on('change', toggleCustom);

    const presetSelect = html.find('.iso-preset-select');
    const presetApply = html.find('.iso-preset-apply');
    const presetDelete = html.find('.iso-preset-delete');
    const presetSave = html.find('.iso-preset-save');
    const presetName = html.find('.iso-preset-name');

    const togglePresetActions = () => {
      const hasSelection = Boolean(presetSelect.val());
      presetApply.prop('disabled', !hasSelection);
      presetDelete.prop('disabled', !hasSelection);
    };

    const toggleSaveState = () => {
      const hasName = Boolean(presetName.val()?.toString().trim());
      presetSave.prop('disabled', !hasName);
    };

    presetSelect.on('change', togglePresetActions);
    presetName.on('input', toggleSaveState);

    togglePresetActions();
    toggleSaveState();

    presetSave.on('click', async () => {
      const name = presetName.val()?.toString().trim();
      if (!name) {
        ui.notifications.warn(game.i18n.localize('isometric-perspective.presets_nameRequired'));
        return;
      }

      const payload = this._normalizePresetPayload(this._collectPresetPayload(html));
      await saveScenePreset(name, payload);
      presetName.val('');
      toggleSaveState();
      ui.notifications.info(game.i18n.localize('isometric-perspective.presets_saved', { name }));
      await this.render(true);
    });

    presetDelete.on('click', async () => {
      const id = presetSelect.val();
      if (!id) return;
      await deleteScenePreset(id);
      ui.notifications.info(game.i18n.localize('isometric-perspective.presets_deleted'));
      await this.render(true);
    });

    presetApply.on('click', async () => {
      const id = presetSelect.val();
      if (!id) return;
      const preset = getScenePreset(id);
      if (!preset) {
        ui.notifications.error(game.i18n.localize('isometric-perspective.presets_notFound'));
        return;
      }

      const payload = this._normalizePresetPayload(preset.data);
      this._populateFormFields(html, payload);
      await this._applySceneFlags(payload);
    });
  }

  async _updateObject(event, formData) {
    const payload = this._normalizePresetPayload(formData);
    await this._applySceneFlags(payload);
  }

  _collectPresetPayload(html) {
    const scaleInput = html.find('input[name="flags.isometric-perspective.isometricScale"]');
    const projectionSelect = html.find('select[name="flags.isometric-perspective.projectionType"]');
    const customInput = html.find('input[name="flags.isometric-perspective.customProjection"]');

    return {
      isometricEnabled: html.find('input[name="flags.isometric-perspective.isometricEnabled"]').prop('checked'),
      transformBackground: html.find('input[name="flags.isometric-perspective.isometricBackground"]').prop('checked'),
      scale: Number(scaleInput.val() ?? 1),
      projectionType: projectionSelect.val() ?? DEFAULT_PROJECTION,
      customProjection: (customInput.val() ?? '').toString()
    };
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

  _populateFormFields(html, payload) {
    if (!payload) return;

    const projectionSelect = html.find('select[name="flags.isometric-perspective.projectionType"]');
    const customInput = html.find('input[name="flags.isometric-perspective.customProjection"]');

    html.find('input[name="flags.isometric-perspective.isometricEnabled"]').prop('checked', payload.isometricEnabled);
    html.find('input[name="flags.isometric-perspective.isometricBackground"]').prop('checked', payload.transformBackground);

    const scaleInput = html.find('input[name="flags.isometric-perspective.isometricScale"]');
    scaleInput.val(payload.scale);
    html.find('.range-value').text(payload.scale);

    projectionSelect.val(payload.projectionType);
    customInput.val(payload.customProjection);
    projectionSelect.trigger('change');
  }

  async _applySceneFlags(payload) {
    if (!payload) return;

    const scene = this.document;
    if (!scene) return;

    const isoEnabled = Boolean(payload.isometricEnabled);
    const transformBackground = Boolean(payload.transformBackground);
    const scale = payload.scale;
    const projectionType = payload.projectionType || DEFAULT_PROJECTION;
    const customProjectionInput = (payload.customProjection ?? '').toString().trim();

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

  _defaultCustomProjectionString() {
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
