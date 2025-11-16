# Fix 22: Mask cache key scheme and targeted invalidation

What was wrong:

- The occlusion mask cache used weak/global invalidation that often wiped the entire cache when a single token or tile changed; the keying scheme wasn't clear or predictable.

What I changed:

- Introduced a `maskCache` map keyed on either tile or token IDs with values containing the mask canvas and bounding box.
- Added `invalidateMaskCacheForTile(tileId)` and `invalidateMaskCacheForToken(tokenId)` helpers that remove specific mask entries instead of clearing the entire cache.
- Updated hooks to call the targeted invalidation helpers to avoid recomputing unaffected masks.

Files updated:

- `scripts/occlusion.js` (cache key setup, invalidation helpers)

Why this matters:

- Reduces occlusion recomputation overhead when small numbers of elements change.
- Lowers runtime CPU & GPU overhead and improves user-perceived performance.
