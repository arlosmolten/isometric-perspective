# Fix 12: Token Config scale disabled variable mismatch

What was wrong:
- The token config `isoScaleDisabled` checkbox used the wrong template variable `isoTokenDisabled` which resulted in the scale disable checkbox reflecting the wrong state.

What I changed:
- Fixed the template in `templates/token-config.html` to use `{{#if isoScaleDisabled}}checked{{/if}}`.
- Ensured `scripts/token.js` passes `isoScaleDisabled` to the template render data.

Files updated:
- `templates/token-config.html`
- `scripts/token.js`

Testing:
- Verfied that toggling the scale disable setting reflects correctly in the UI and persists as the right flag on submit.
