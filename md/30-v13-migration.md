# v13 Migration Notes

This module now targets Foundry VTT v13 as a minimum. Key changes applied for the migration:

- Set `module.json` compatibility minimum and verified to `13`.
- Removed Foundry v11 compatibility fallbacks and code paths. The module now assumes v13+ APIs and prefers the v13 code paths for visibility and wall edge handling.
- Updated dynamic tile logic to always use `wall.edge.a`/`wall.edge.b` (v13+) and `canvas.visibility.testVisibility` for visibility tests (v13+).
- Removed `setupCompatibilityHooks` and other v11-specific hooks. The `dropCanvasData` handler uses the newer `(canvas, object, event)` signature.
- Updated language strings and hints to reflect v13 minimum compatibility.

Notes for maintainers:
- Before releasing, ensure the module is tested on a running Foundry v13 instance. Some minor API differences between v12/v13 may require additional runtime adjustments.
- If maintaining compatibility with v12 is desired, tests should be performed on both v12 and v13 to ensure behaviors are consistent.

If a user needs to maintain v11 compatibility, the module no longer supports it and manual patches or forks should be considered.
