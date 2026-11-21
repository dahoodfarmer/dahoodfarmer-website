# Da HoodFarmer selectable skin system

## Scope

This change adds the first shared theme layer for the five approved website skins. It is intentionally isolated from the production branch.

- Royal Ranch is the default.
- Western Heritage uses warm leather, cream, and bronze tones.
- AgTech Future uses deep green, graphite, silver, and restrained purple.
- Entertainment Mode uses high-energy purple, black, red, and gold.
- Executive uses a refined graphite, white, and muted-gold palette.

## Implementation

- The shared site header injects one accessible appearance selector on every page using the existing shared layout script.
- Theme colors are expressed through the existing CSS custom properties, so page components inherit the selected palette without page-by-page duplication.
- A visitor's selected theme is stored under the non-sensitive local-storage key `dhf-theme-v1`.
- If browser storage is unavailable or the stored value is invalid, the experience falls back to Royal Ranch.
- No identity, account, contact-form, payment, or other sensitive data is stored by this feature.
- The selector has an accessible label and visible keyboard focus.
- Reduced-motion preferences disable decorative transitions and animations.

## Owner review checklist

1. Open the homepage and each major page at desktop and mobile widths.
2. Switch through all five themes and verify that backgrounds, cards, buttons, links, navigation, and form controls remain readable.
3. Reload and navigate to another page; confirm the chosen theme remains selected.
4. Clear or disable local storage; confirm the site falls back to Royal Ranch and remains usable.
5. Use keyboard-only navigation to reach and operate the appearance selector.
6. Enable the operating system's reduced-motion setting and confirm decorative motion is suppressed.
7. Confirm no page content, URLs, forms, payment configuration, analytics events, or SEO metadata changed.

## Verification status

The changed files were read back from the feature branch. Static checks confirmed all four non-default theme definitions, the persistent theme key, the Royal Ranch fallback, and the reduced-motion rule. A browser/device visual review and automated test run have not yet been performed. Do not merge or deploy until those checks are completed and the owner approves.
