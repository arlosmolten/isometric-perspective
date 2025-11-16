# Isometric Perspective v2.0.0 Release

This release bumps the module to major release 2.0.0. It reflects a cleanup and consolidation of the code base, removal of experimental/legacy code, code improvements and refactors that prepare the module for long-term stability and future Foundry VTT upgrades.

Summary of highlights

- Module and test harness version bump to `2.0.0`.
- Removed all experimental/legacy occlusion files and stubs from `scripts/` and `scripts/experimental/`.
- Consolidated configuration helpers into `scripts/config.js` (runtime helpers like `MODULE_ID`, `isDebugEnabled`, `getFoundryVersion`).
- Kept a single production `scripts/occlusion.js` implementation and improved occlusion performance (debounced updates, mask cache, CPU/GPU fallback).
- Reworked token/tile pointer event handling, replaced global DOM queries, and improved cleanup.
- Added `mergeRectangles` util and unit tests; updated tests to pass under the new structure.
- Migrated all FormApplications (`SceneIsoSettings`, `TokenIsoSettings`, `TileIsoSettings`) to `FormApplicationV2` and documented the new header-control placement for the Isometric button so the module no longer hits compatibility warnings when opening its settings.

Breaking changes and migration notes

- Experimental files have been removed permanently. If any code (other modules) depended on them, update imports to use `scripts/occlusion.js` or reimplement missing functionality.
- `module.json` changed to `version: 2.0.0`. Please update any `manifest` links or references to reference the released v2.0.0 artifact.
- Ensure you have Foundry VTT v13+ (manifest minimum) and test under Foundry 13 to match the reported verified compatibility.

Next steps recommended

- Run a full Foundry integration test with a copy of your world (verify `allowList` for settings, hooks, and runtime behavior are preserved).
- After opening each settings form (scene, token, tile), verify there are no `deprecated FormApplication` warnings in the console and that the saved flag changes persist.
- Patch and verify any dependent modules or macros that may have imported legacy occlusion variants.
- Consider adding a CI pipeline (git actions) to run unit tests and lint checks and a release process to create the module manifest and zip artifacts.

If you want, I can now:

- Audit for any remaining pre-V2 breaking API usage and ensure compatibility with the target Foundry versions.
- Automate a small release script that prepares a `module.json` manifest and a zip artifact for distribution.
- Run a full linter / formatting pass to clean up the codebase and fix MD lint warnings.

-- End of v2 notes
