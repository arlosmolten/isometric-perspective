# Fix 1: Centralize MODULE_ID and runtime helpers into `config.js`

What was wrong:
- Multiple modules imported runtime flags and constants from `main.js`, and modules re-exported runtime flags from `main.js`, leading to circular imports and fragile dependencies.

Why it's a problem:
- Circular imports can result in undefined values during module initialization, causing unpredictable behavior and race conditions.

What I changed:
- Added a new file `scripts/config.js` that exports static `MODULE_ID` and helper functions `isDebugEnabled()`, `isWorldIsometricEnabled()`, and `getFoundryVersion()`.
- Rewired all modules to import `MODULE_ID` and the helper functions from `config.js`.
- Removed runtime variables `DEBUG_PRINT`, `WORLD_ISO_FLAG` (which were exported from `main.js`) and replaced code with calls to helper functions.

Files updated:
- New: `scripts/config.js` (created)
- Updated: multiple files were changed to import from `config.js` instead of `main.js` including `main.js`, `transform.js`, `scene.js`, `token.js`, `tile.js`, `utils.js`, `hud.js`, `dynamictile.js`, `occlusion.js`, `autosorting.js`, `consts.js`.

Testing:
- After refactor, code imports are resolved without circular references; code uses `isDebugEnabled()` and other helpers to read runtime flags.

Notes:
- `config.js` centralizes small helper functions and `MODULE_ID` so that the bootstrapping `main.js` can remain a top-level initialization file without being used as a dependency for other modules.
