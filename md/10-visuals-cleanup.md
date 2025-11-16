# Fix 10: Visual containers cleanup on scene change

What was wrong:
- Token elevation visuals were not reliably removed when changing scenes. This could leave stray PIXI containers on the stage and cause visual leaks.

What I changed:
- Added a hook in `transform.js`: `Hooks.on('changeScene', clearAllVisuals);` to ensure elevation visuals are cleared when switching scenes.
- Also ensured `canvasReady` and `deleteToken` were already handled.

Files updated:
- `scripts/transform.js`

Why this is important:
- Prevents visual artifacts and memory leaks when changing scenes.

Notes:
- If additional visuals are added by other modules or features, they should register similar cleanup hooks to ensure a clean stage state on scene change.
