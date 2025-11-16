# Fix 13: Add mask cache invalidation in occlusion module

What was wrong:
- A simple mask caching mechanism was added but wasn't being invalidated on critical events (tile or token updates). This could present stale masks when changes occur.

What I changed:
- Added `maskCache.clear()` to the update hooks that can change occlusion results, specifically on `updateTile`, `deleteTile`, `updateToken`, and `deleteToken`.
- Ensured `scheduleOcclusionUpdate()` is used for Hook events and that `maskCache` is cleared appropriately before recalculating occlusion masks.

Files updated:
- `scripts/occlusion.js`

Why it matters:
- Ensures that occlusion masks are accurate after changes and avoids serving stale cached masks.
- Reduces CPU load while preserving correctness by clearing the cache only when necessary.
