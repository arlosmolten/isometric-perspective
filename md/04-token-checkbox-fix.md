# Fix 4: Token config checkbox `unchecked` to `checked` fix

What was wrong:
- The code used `prop("unchecked", ...)` and the template used the `unchecked` attribute in the checkbox `isoAnchorToggle` rather than using `checked`. This caused the checkbox to not reflect the flag correctly in the UI.

What I changed:
- In `token.js`:
  - Replaced `isoAnchorToggleCheckbox.prop("unchecked", app.object.getFlag(MODULE_ID, "isoAnchorToggle") ?? false);` with:
    - `isoAnchorToggleCheckbox.prop("checked", !!(app.object.getFlag(MODULE_ID, "isoAnchorToggle") ?? false));`
- In `templates/token-config.html`:
  - Replaced `{{#if isoAnchorToggle}}unchecked{{/if}}` with `{{#if isoAnchorToggle}}checked{{/if}}`

Why this is important:
- The checkbox `checked` attribute is the correct way to set the initial state of the input. Using `unchecked` is invalid and can result in incorrect UI behavior.

Files updated:
- `templates/token-config.html`
- `scripts/token.js`

Testing done:
- Verified the checkbox reflects the token flag when the `TokenConfig` is opened and persisted correctly on submit.
