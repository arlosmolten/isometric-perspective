# Fix 20: Button pointer handlers use named handlers and cleanup

What was wrong:

- The adjustable fine-tune buttons used anonymous `mousemove`/`mouseup` listeners on the `document`, which could persist or conflict across multiple config windows.

What I changed:

- Replaced `mousedown/mousemove/mouseup` with `pointerdown/pointermove/pointerup` and used named handlers `onMove` and `onUp` attached to `window`, allowing reliable removal when `pointerup` fires.
- Ensures `applyAdjustment` stops updating when `isAdjusting` is false and we remove listeners once the `pointerup` event fires.

Files updated:

- `scripts/token.js` and `scripts/tile.js`

Why this matters:

- Avoids leaking global event listeners and improves multi-window behavior.
- Improves support for touch and stylus inputs via pointer events.
