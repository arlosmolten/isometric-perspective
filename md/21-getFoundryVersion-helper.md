# Fix 21: Created `getFoundryVersion` helper and updated version checks

What was wrong:

- Multiple modules compared `game.version` or `game.data.version` directly. These checks were inconsistent, used different semantics, and caused future-compatibility issues.

What I changed:

- Added `getFoundryVersion()` to `scripts/config.js`, returning `game.version` parsed into a `{ major, minor, patch }` object for consistent version checks.
- Replaced every direct `game.version` check with `getFoundryVersion()` usage where appropriate.

Files updated:

- `scripts/autosorting.js`, `scripts/main.js`, `scripts/scene.js`

Why this matters:

- Makes version checks deterministic and easier to maintain.
- Prepares module for future Foundry versions and simplifies feature-flagging by major version.
