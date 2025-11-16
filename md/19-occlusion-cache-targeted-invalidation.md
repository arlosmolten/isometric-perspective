# Fix 19: Target cache invalidation for occlusion masks

What was wrong:
- Mask cache invalidation was clearing the entire cache on any tile/token update, which could cause performance problems due to frequent cache flushes.

What I changed:
- Implemented targeted invalidation helpers `invalidateMaskCacheForTile(tileId)` and `invalidateMaskCacheForToken(tokenId)`.
- Updated hook handlers to call these helpers instead of clearing the entire cache for `updateTile`, `deleteTile`, `updateToken`, and `deleteToken` events.

Files updated:
- `scripts/occlusion.js`

Why this matters:
- Reduces unnecessary cache invalidation and improves occlusion stall performance while maintaining correctness when updates happen.

Notes:
- The logic looks for tileId in the cache key format `tokenId|tileId1,tileId2` and removes cache relevant to that tile. This prevents a full cache flush for small changes.
