# Fix 17: Add `canvasDestroyed` cleanup for occlusion visual layer

What was wrong:
- When the canvas was destroyed (for instance when switching scenes or when the Canvas resets), the occlusion container could remain if not properly removed. This causes leftover stage children and possible memory leaks.

What I changed:
- Added a `Hooks.on('canvasDestroyed', ... )` handler that removes `occlusionConfig.container` from the `canvas.stage`, destroys it, sets the config properties to `null`, and clears the `maskCache`.

Files updated:
- `scripts/occlusion.js`

Why this matters:
- Ensures occlusion containers are correctly cleaned up when the canvas is destroyed and doesn't leave orphaned containers on stage.
- Prevents memory leaks and visual glitches on scene changes/noise.

Notes:
- This mirrors the `changeScene` handler that also clears the container. `canvasDestroyed` ensures cleanup on internal reset events that don't involve scene changes.
