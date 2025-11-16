# Fix 15: Introduce `logDebug` wrapper for debug logging

What was wrong:
- Some modules used `console.log` directly for debug printing, while others used `DEBUG_PRINT`. This was inconsistent and sometimes resulted in debug prints being unguarded.

What I changed:
- Added `logDebug` in `scripts/config.js` which prints only when `isDebugEnabled()` returns true.
- Replaced many `console.log` occurrences with `logDebug()` across the codebase to centralize logging behavior.

Files updated:
- `scripts/config.js` (existing helper function `logDebug`)
- `scripts/transform.js`, `scripts/token.js`, `scripts/hud.js` — replaced console.log calls with `logDebug()`.

Why this matters:
- Centralizes debug logging and ensures that debug prints are consistently enabled/disabled via the module setting.
- Removes sporadic console logs and helps maintain clean logs for users.

Notes:
- Some `console.log` occurrences still exist in commented code or experimental files (which are archived). Keep the active code free of unguarded debug prints.
