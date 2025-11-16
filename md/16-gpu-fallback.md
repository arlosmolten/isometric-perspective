# Fix 16: GPU occlusion fallback and robustness

What was wrong:
- The GPU occlusion path could raise runtime errors when Filter creation/shader uniforms failed. There was no fallback and this caused occlusion layer to fail silently.

What I changed:
- Surround `createOcclusionMask_gpu` with `try/catch`. If GPU mask creation fails, it now gracefully falls back to CPU occlusion mask creation by calling `createOcclusionMask_cpu(token, intersectingTiles, 2)`.

Files updated:
- `scripts/occlusion.js`

Why it matters:
- Prevents the occlusion feature from breaking the canvas if GPU operations fail on a browser or GPU.
- Allows end users to still use occlusion CPU mode even if GPU is unsupported or has errors.

Notes:
- Future iterations could preserve the errors in a log and provide a user-friendly notification when GPU occlusion is disabled by failure.
