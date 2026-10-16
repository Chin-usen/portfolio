# Mobile header layout-shift diagnosis

The initial English home Lighthouse report records a single CLS event of 0.247041 (rounded to six decimals). A controlled local-production probe held all WOFF2 responses: the English main content began at y=85px in fallback fonts and moved to y=145px after Geist/Noto loaded. The language selector moved from y=20px to y=80px. The menu was already enhanced in both samples. Chinese remained at y=85px with no measured CLS. This identifies font-induced flex wrapping, rather than late navigation enhancement, as the cause.

The scoped CSS fix reserves the already-observed second language row for English non-thermal mobile pages before fonts load. It changes no typeface, token, navigation content, markup, or menu JavaScript; Chinese and S1 headers are excluded.

`tests/e2e/header-stability.spec.ts` adds three browser regressions:

- Delayed-font geometry on all eight English non-S1 routes at 390 x 844. Main and language-row movement must remain within 0.5px; the passing run writes `header-font-stability.json` with the actual pre/post font measurements.
- English keyboard menu opening, Tab navigation, Escape dismissal, and returned toggle focus.
- All five primary navigation links and the language switch remain available without JavaScript.

The diagnosis JSON preserves the pre-fix measured geometry and identifies the original Lighthouse report by SHA-256. Post-fix validation passed all 45 browser tests. All eight delayed-font routes retained mainTop=145px and languageTop=80px before and after loading, with no document overflow. Final mobile Lighthouse passed all 18 routes / 54 measurements: route Performance medians 90-100; Accessibility and SEO were 100 in all 54 runs. Original median thresholds are unchanged. The final Lighthouse CLS range on the eight affected English routes was 0.000215116-0.016027979; this residual whole-page result is distinct from the controlled zero-movement header probe.
