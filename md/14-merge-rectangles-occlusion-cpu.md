# Fix 14: Merge rectangles in CPU occlusion mask generation

What was wrong:
- The CPU occlusion mask generation collected many small rectangles per chunk and used `drawRect()` for each one. When scenes are complex, this can create a high number of draw operations and a complex mask (many sprites/graphics), which slows down rendering.

What I changed:
- Implemented a `mergeRectangles` function inside `createOcclusionMask_cpu` which merges overlapping and adjacent rectangles (within 1 pixel), producing a smaller set of larger rectangles to draw.
- Replaced the previous drawing loop to draw the merged rectangles instead of all raw rectangles.

Files updated:
- `scripts/occlusion.js`

Why this matters:
- Reduces the number of draw calls and mask complexity.
- Reduced memory and CPU pressure, particularly on big scenes in CPU occlusion mode.

Notes:
- The merge algorithm used is O(n^2) for simplicity but should be adequate for moderate numbers of rectangles. If there are many rectangles, a more optimal union/packing algorithm should be implemented.
- This is a safe improvement that complements the cache/debounce already implemented.
