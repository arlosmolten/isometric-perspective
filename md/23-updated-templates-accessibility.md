# Fix 23: Template accessibility and corrected template variables

What was wrong:

- Some config templates used the `unchecked` attribute and incorrect variable names such as `isoScaleDisabled` vs `isoScaleDisabled` mismatch, causing UI options to not reflect actual state.
- Templates lacked `title` attributes and `aria-label`s for some interactive elements.

What I changed:

- Replaced `unchecked` with `checked` logic bound to the appropriate template variable to ensure blue checkboxes reflect the setting correctly.
- Ensured `isoScaleDisabled`, `isoTokenDisabled` bindings are present and spelled consistently.
- Added `title` and `aria-label` where the templates provide controls for users with assistive tech.

Files updated:

- `templates/token-config.html`, `templates/tile-config.html`, `templates/scene-config.html`

Why this matters:

- Fixes UI bugs users saw when enabling/disabling features.
- Improves accessibility for users relying on screen readers and keyboard navigation.
