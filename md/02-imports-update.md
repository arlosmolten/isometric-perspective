# Fix 2: Update imports to use `config.js`

What was wrong:
- Many files imported `MODULE_ID` and runtime flags from `main.js`. This created circular import patterns where modules could import each other indirectly via `main.js`.

What I changed:
- Updated every module's import statement that referenced `main.js` to instead import `MODULE_ID` and/or helper functions (`isDebugEnabled`, `isWorldIsometricEnabled`, `getFoundryVersion`) from `config.js`.

Files updated (examples):
- `transform.js`
- `token.js`
- `tile.js`
- `scene.js`
- `utils.js`
- `occlusion.js`
- `hud.js`
- `dynamictile.js`
- `autosorting.js`
- `consts.js`

Why this is important:
- It isolates a small set of static symbols in a single file and avoids referencing the module bootstrap file for these values. This reduces circular imports and makes module relationships explicit and stable.

Notes:
- Runtime flags are read at runtime using helper functions, not by importing a mutable variable exported by `main.js`.
