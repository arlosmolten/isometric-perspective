# Isometric Perspective Module: Patch Notes and Fixes

This folder contains detailed markdown files for each fix performed on the `isometric-perspective` module.

List of fixes and their documentation:

- 01-config-centralization.md - Create `config.js` to centralize MODULE_ID and helper functions to avoid circular imports.
- 02-imports-update.md - Update all modules to import from `config.js` instead of `main.js`.
- 03-remove-debug-export.md - Remove `DEBUG_PRINT` and runtime exports from `main.js`.
- 04-token-checkbox-fix.md - Fix `isoAnchorToggle` checkbox `unchecked` -> `checked` issue.
- 05-pointer-events-adjust-buttons.md - Replace `mousedown`/`mousemove` with pointer events using named handlers.
- 06-dropCanvasData-event.md - Update `dropCanvasData` hook to accept `event` and fix event usage.
- 07-occlusion-debounce-cache.md - Add debounce to `occlusion` updates and simple mask caching.
- 08-templates-accessibility.md - Add `title` and `aria-label` attributes to templates.
- 09-experimental-move.md - Move experimental occlusion files to `scripts/experimental/`.
- 10-visuals-cleanup.md - Add cleanup on `changeScene` to clear visuals.
- 11-pass-template-flags.md - Ensure correct data is passed to token config template flags.
- 12-token-config-scale-disabled.md - Fix scale disabled template variable.
- 20-v2-release.md - v2.0.0 release notes, cleaning experimental code and stabilizing the core occlusion implementation.
- 30-v13-migration.md - v13 migration notes and changes (manifest set to v13 and v11 compatibility removed).
- 31-scene-presets.md - Document the new scene presets UI and storage workflow.

This index will be updated as more fixes are applied and documented.
