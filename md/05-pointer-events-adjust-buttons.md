# Fix 5: Use pointer events & scoped handlers in adjustable buttons

What was wrong:
- `createAdjustableButton` used `mousedown` + `document.addEventListener('mousemove')` and inline anonymous `mouseup` handlers. This can cause event leak and global effects across multiple open config windows. The same was true for the tile offset adjustor.

What I changed:
- Replaced `mousedown` with `pointerdown` and use `window.addEventListener('pointermove', onMove)` and `window.addEventListener('pointerup', onUp)` to track pointer movements.
- The move & up functions are now named (`onMove`, `onUp`) and are removed once pointerup occurs to prevent leaks.

Files updated:
- `scripts/token.js` - `createAdjustableButton` implementation updated
- `scripts/tile.js` - `updateAdjustOffsetButton` implementation updated

Why this change matters:
- Using pointer events improves cross-device compatibility (touch + mouse).
- Named handlers allow safe removal and prevent global listener leakage.
- Scoped selection via provided `container` improves behavior when multiple config windows are open.

Testing done:
- Adjusted offsets and anchor values via the buttons in the token and tile config and ensured the values update and the listeners are removed after release.

Notes:
- I used `window` for pointer listeners so they work reliably even if the pointer leaves the small button element.
