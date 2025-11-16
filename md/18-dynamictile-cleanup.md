# Fix 18: Add `canvasDestroyed` cleanup for dynamic tile containers

What was wrong:
- The dynamic tile feature adds an `alwaysVisibleContainer` to the canvas stage, but it wasn't cleaned when the canvas is destroyed, potentially leading to memory leaks.

What I changed:
- Added a `Hooks.on('canvasDestroyed', ...)` handler in `dynamictile.js` that removes and destroys `alwaysVisibleContainer` and clears the layers references.

Files updated:
- `scripts/dynamictile.js`

Why this matters:
- Ensures dynamic tile stage children don't persist across canvas resets, preventing visual artifacts and memory leaks.

Notes:
- Also kept the existing `changeScene` cleanup to remove the container when switching scenes.
