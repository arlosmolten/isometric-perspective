# Fix 8: Add titles / aria labels to template inputs and improve accessibility

What was wrong:
- Templates were lacking form control accessibility attributes such as `title` and `aria-label`. Linting tools reported these inputs as missing `title`/accessibility attributes.

What I changed:
- Added `title` attributes to the controls in `token-config.html` and `tile-config.html` for inputs to provide descriptive tooltips and improve accessibility.
- Added `aria-label` to the projection `select` in `scene-config.html` to ensure it has an accessible name.

Files updated:
- `templates/token-config.html`
- `templates/tile-config.html`
- `templates/scene-config.html`

Why this matters:
- Improves accessibility for users relying on assistive tools and satisfies linter checks regarding form labels.
