# Fix 11: Pass correct template variables for Token Config

What was wrong:
- The token template referenced `isoTokenDisabled` and `isoScaleDisabled` variables for initial `checked` states, but the JavaScript `renderTemplate` call passed `isoDisabled` (a different variable), and `isoScaleDisabled` was missing.

What I changed:
- Updated `renderTemplate` call in `scripts/token.js` to pass `isoTokenDisabled` and `isoScaleDisabled` so the template variable names match the initial data.
- This makes sure the token config UI reflects the actual stored flags on open.

Files updated:
- `scripts/token.js` (render data now includes `isoTokenDisabled` and `isoScaleDisabled`)

Testing:
- Opening token config now shows the correct checked states based on the token flags.
