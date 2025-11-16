# Scene Presets for Isometric Scenes

The new scene preset manager stores per-scene isometric flag combinations so you can quickly reuse common layouts without recreating the settings each time. Presets are kept in the `scenePresets` world setting so every user in the world can reuse the same bundle of flags.

## Usage

1. Open a scene and configure the isometric toggles, projection, background transformation and scale as desired.
2. Enter a human-friendly name into the presets box and click **Save Current**. That snapshot is now persisted in the dropdown and stored inside the world-level `scenePresets` object.
3. Choose a preset from the dropdown and click **Apply** to push its stored flags immediately to the scene. The preview form updates with the saved values and the flags are written to the scene document.
4. Select a preset and click **Delete** to remove it from storage when you no longer need it.


## Behind the scenes

- `getScenePresets()` reads the entire `scenePresets` map so the dropdown can list every saved entry.
- `saveScenePreset(name, data)` writes the normalized payload (projection, scale, checkboxes, and optional custom projection string) under a timestamp-based ID.
- `getScenePreset(id)` and `deleteScenePreset(id)` let the form apply or dispose of an individual entry.

```javascript
// Save a payload manually (the form already calls this internally).
const payload = {
  isometricEnabled: true,
  transformBackground: false,
  scale: 1.2,
  projectionType: 'Custom Projection',
  customProjection: '30, 0, 0, 0, 0, 0, 0, 1'
};
await saveScenePreset('My Campaign Default', payload);
```

Reloading the module will keep every saved preset because the data sits in the world settings. Any future hooks that want to reapply a preset can call `getScenePreset` and feed the payload into `_applySceneFlags` or a similar helper.
