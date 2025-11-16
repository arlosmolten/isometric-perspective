# Fix 9: Move experimental occlusion files out of production scripts

What was wrong:
- There were multiple experimental occlusion implementations (v2-v21, occlusion3) present in the main `scripts/` directory. They clutter the production code and are a maintenance risk.

What I changed:
- Initially created `scripts/experimental/` and archived full legacy copies of the experimental occlusion files. These archives were later permanently deleted as part of the final cleanup. Files that were archived during migration included:
  - `legacy_occlusion2_v15_full.js`
  - `legacy_occlusion2_v21_full.js`
  - `legacy_occlusion3_full.js`
- Replaced the original files in `scripts/` with short comments indicating where they had been moved; those comments were later removed when the legacy files were permanently deleted.

Files affected:
- New folder: `scripts/experimental/` (created for migration, then removed)
- Previously created small experimental pointer files were replaced with the full legacy archived copies and then trimmed back to remove noise.
- Replaced the content of the old root files to indicate archived status and then deleted them.

Why this matters:
- Keeps the `scripts/` folder focused on production code and reduces the risk of accidentally importing experimental algorithms.
- Makes it clear where experimental work lives for future testing or reactivation.

Notes:
- The experimental/ archived full legacy files were created initially during the migration but have since been deleted as part of the final cleanup to remove legacy content.

  The active production occlusion implementation remains in `scripts/occlusion.js`.
