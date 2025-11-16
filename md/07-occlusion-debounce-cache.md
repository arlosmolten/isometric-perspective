# Fix 7: Debounce occlusion updates & add simple mask caching

What was wrong:
- The occlusion module triggered heavy computations on frequently fired Hooks (`updateToken`, `canvasPan`, `canvasTokensRefresh`, etc.) directly which caused CPU spikes and UI lag on large scenes.

What I changed:
- Added a simple debouncer (`scheduleOcclusionUpdate`) that waits for 100ms of silence before running `updateOcclusionLayer`.
- Added a `maskCache` Map to reuse generated occlusion masks (PIXI Graphics) keyed by tokenId and tileIds collected into a string (`token.id|tile.id,...`).
- Modified the Hooks registration in `registerOcclusionConfig` so each event calls `scheduleOcclusionUpdate()` and clears `maskCache` when events alter tokens/tiles that can affect intersections.

Files updated:
- `scripts/occlusion.js`

Why this helps:
- Reduces the number of expensive occlusion recalculations when many events fire in quick succession.
- Reusing masks where possible reduces the overhead of re-creating complex masks every time, improving performance.

Notes / Limitations:
- The mask cache is a basic implementation and can still be improved (fine-grained invalidation per tile/token, shared masks, offscreen renderTexture caching), but it is a good first performance win.
