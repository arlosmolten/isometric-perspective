# Fix 3: Remove DEBUG_PRINT / WORLD_ISO_FLAG exports from `main.js`

What was wrong:
- `main.js` exported dynamic runtime variables (e.g. `DEBUG_PRINT` and `WORLD_ISO_FLAG`) which caused modules to import mutable runtime values. This was fragile and combined with circular imports could lead to inconsistent values.

What I changed:
- Removed these runtime exports from `main.js` and replaced usage with helper functions in `config.js` (`isDebugEnabled`, `isWorldIsometricEnabled`).
- Updated all places that relied on `DEBUG_PRINT` to use `isDebugEnabled()`.

Files changed:
- `main.js` - removed debug runtime export and replaced the logic using helper functions
- `transform.js`, `scene.js`, `token.js`, `occlusion.js`, `dynamictile.js`, `hud.js` and others - switched to `isDebugEnabled()` calls

Why this is important:
- Ensures that debugging flag is always read from the settings at runtime and avoids stale or undefined exports.

Notes:
- There are still development-time debug comments and logs; these are now controlled by `isDebugEnabled()`.
