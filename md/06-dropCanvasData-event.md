# Fix 6: Use proper event signature for dropCanvasData hook

What was wrong:
- The code used a global `event` variable inside the `Hooks.on('dropCanvasData'...)` callback in `transform.js`. This global `event` may not be available and is fragile.

What I changed:
- Updated the callback signature to accept the `event` argument: `Hooks.on('dropCanvasData', (canvas, object, event) => { ... })`.
- Replaced any usage of the global `event` with the local `event` parameter.
- Additionally, where code previously checked `FOUNDRY_VERSION`, I replaced usages with `getFoundryVersion()` helper.

Files updated:
- `scripts/transform.js`

Why this matters:
- Prevents reliance on browser globals and ensures the event data used comes from the actual hook call. This is more forward-compatible and robust across browsers/Foundry versions.

Testing:
- Tested drop behavior by dropping tokens onto the map and verifying that the calculated coordinates were correct and that the local `event` was used (no global `event` references).
