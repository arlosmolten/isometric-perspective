# Documenting `scene.js` Hook Rework

**What was wrong:**

- `scene.js` previously relied on legacy tab injection UI and scattered flag reads, so updates to scene flags (projection, background, grid) could slip through the cracks or trigger without a clear contract.
- The file also imported runtime flags from `main.js`, which created brittle dependencies and made the hook behavior harder to reason about during module initialization.

**Why it mattered:**

- Scene updates had to keep the isometric projection, background transform, and constants in sync, especially when a new FormApplication moved the UI away from the old tab approach.
- Circular imports and inconsistent flag handling meant the canvas could drift from the user-configured settings, breaking the isometric perspective visual fidelity.

**What was changed:**

- Added the `registerSceneConfig` entrypoint to hook into `renderSceneConfig`, `updateScene`, `canvasReady`, and `canvasResize`, ensuring all lifecycle moments consult the centralized flags.
- Switched every runtime import in `scene.js` to the helpers exported by `config.js`, so `MODULE_ID`, `logDebug`, and `logError` no longer depend on `main.js`.
- Refined `handleUpdateScene` to only react to relevant changes (image, background offsets, projection flags, grid settings) before re-applying `updateIsometricConstants`, `applyIsometricPerspective`, and `applyBackgroundTransformation`. Custom projections now parse through `parseCustomProjection` with error handling.
- Added fallback selectors when injecting the button so the FormApplication can be opened even if a theme changes the `.window-header` structure—the button now appends to the header container if no title element is found.
- Normalized the `renderSceneConfig` `html` argument to a jQuery object so `addSceneIsoButton` reliably queries and injects the button even when Foundry passes a plain DOM node.
- Styled the injected button with `header-control` and `iso-scene-config-open` so it sits next to the built-in controls, and fall back to inserting before the first `.header-control` if the title element isn’t found.
- Styled the injected button with `header-control` and `iso-scene-config-open` so it sits next to the built-in controls, and fall back to inserting before the first `.header-control` if the title element isn’t found.

- Rebased every settings popout (`SceneIsoSettings`, `TokenIsoSettings`, `TileIsoSettings`) onto `FormApplicationV2` so the module uses the V2 application stack, relies on `this.document`, and avoids the compatibility log warnings.
- Guarded `SceneIsoSettings` so it tolerates missing `scene` references (falling back to the current canvas scene), short-circuits form data when no scene is provided, and now extends `FormApplicationV2` so we stop hitting the deprecated V1 API.
- `handleCanvasReady` and `handleCanvasResize` now proactively set default projection flags, apply custom projections, and run the same transformation helpers, preserving the isometric state after canvas events.

**Key snippets:**

```javascript
function handleUpdateScene(scene, changes) {
  if (scene.id !== canvas.scene?.id) return;

  if (
    changes.img ||
    changes.background?.offsetX !== undefined ||
    changes.background?.offsetY !== undefined ||
    changes.flags?.[MODULE_ID]?.isometricEnabled !== undefined ||
    changes.flags?.[MODULE_ID]?.isometricBackground !== undefined ||
    changes.flags?.[MODULE_ID]?.customProjection !== undefined ||
    changes.flags?.[MODULE_ID]?.projectionType !== undefined ||
    changes.grid !== undefined ||
    changes.gridType !== undefined ||
    changes.gridSize !== undefined
  ) {
    // recalculates constants and reapplies scene transforms
  }
}
```

This snippet captures the guarded update logic that keeps the isometric projection and background transformation in sync only when meaningful scene data changes. It feeds back into `updateIsometricConstants`, `applyIsometricPerspective`, and `applyBackgroundTransformation` after parsing any custom projection the user stored in flags.

**Testing:**

- Manual experience: open a scene config, toggle isometric/background/projection options, and ensure the canvas redraws correctly with the new FormApplication workflow.
- No automated tests yet (UI-heavy behavior), but the new hook coverage keeps the projection constants consistent during updates.
