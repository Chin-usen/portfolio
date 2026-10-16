# BEFORE technical audit — frozen v2 against the v3 brief

Method: independent Assessment B (`/root/v3_before_b`, completed by `/root/v3_before_b_finish`); Assessment A was not read. Impeccable pin `2f98774f86bc05563876643db37e6c37c322850f`. Date2026-10-15. Source remains unchanged.

## Implementation integrity verdict: FAIL for the current fixed brief

The engineering implementation is coherent within S1: typed parameters, functional analytic/FEM choices, localized labels, explicit model limits and an operable fallback. The Home/shell implementation does not express the supplied D1 system, and S1 does not express the user's newly mandated desktop arrangement. This is verified by source structure,16 saved screenshots and native Chrome inspection. It is not a generic detector judgment: the static scan returned zero findings.

## Audit health

| Dimension | Score /4 | Evidence and limit |
|---|---:|---|
| Accessibility | 3 | Labels, visible focus, keyboard menu/tabs/ranges/view controls and2D fallback pass targeted checks; several hit areas miss the strict44px rule. No full screen-reader or200% text-size certification. |
| Performance | 3 | On-demand rendering, lazy viewer/FEM imports and visibility handling are present. Local resource weight warrants budget attention. No fresh throttled Lighthouse/LCP run; score is provisional rather than a threshold certificate. |
| Theming | 3 | Light/dark tokens work in all16 captures and sampled contrast is strong. Global link role incorrectly uses orange accent instead of the documented blue token. |
| Responsive design | 3 | No document overflow at1440/390; synthesized touch and cancellation recovery work. Minor hit-area gaps and mobile header inconsistency remain; full200% text scaling untested. |
| Implementation integrity | 1 | Repeated major omissions relative to the current fixed brief: D1 Home hierarchy/hero/metrics, live Home S1 card, and S1 desktop two-column layout; legacy GSAP remains. |
| **Total** | **13/20** | **Acceptable: significant brief-alignment work required.** |

Totals: **P0=0, P1=3, P2=3, P3=0**. Score and priorities apply to the new v3 acceptance brief; they do not imply a regression in the frozen previously accepted v2 release. No demonstrated P0 failure or confirmed WCAG AA violation was found in the bounded checks.

## Detailed findings

### B01 — P1: Home and shared shell do not implement D1

- Location: `portfolio-main-v2/src/components/HomePage.astro:25`, `src/styles/tokens.css:8`, `src/styles/global.css:40`, `src/components/Header.astro:18`, `src/components/Footer.astro`.
- Category: Implementation integrity; responsive consistency.
- Evidence: source has only a left-aligned text hero followed by generic work/Lab lists. All four Home variants at each width lack the module visual and black metric band. Measured title48px desktop/32px mobile versus88/38 requested. Header remains about85px desktop, and English mobile reserves a second language row rather than the prescribed52px name/menu shell. Card styling remains square/bordered rather than D1's28px desktop/24px mobile surfaces. Footer is a motto rather than the placeholder contact composition.
- Impact: the primary surface fails the approved reference identity and omits the product/metric evidence hierarchy the recruiting audience is meant to scan.
- Standard: current user brief, immutable DESIGN.md and D1 HTML/JPG; not a WCAG claim.
- Recommendation: reconstruct Home to the reference sequence, preserve approved fonts/colors and literal content placeholders, add the generic power-module asset with an appropriate static/performance fallback, and implement the52px responsive shell. Keep layout readable when text grows.
- Command follow-up: manual authorized implementation, then only `impeccable audit` and `impeccable critique` validation.

### B02 — P1: Home's S1 card cannot demonstrate input → result

- Location: `src/components/HomePage.astro:49`, `src/components/LabCard.astro:16`.
- Category: Implementation integrity / required interaction.
- Evidence: all Home matrix entries have rangeCount0. LabCard contains status/title/summary/link only; no temperature output or ceramic-thickness control. D1 has this specific live S1 preview.
- Impact: users cannot test the engineering behavior from the homepage as requested; the most concrete capability stays behind navigation.
- Standard: current user brief and D1 reference.
- Recommendation: use the existing analytic model for a labeled ceramic-thickness range and live Tj output, with locale-aware units, keyboard/touch support and accessible result feedback. Retain an explicit route into full S1; no fabricated career values.
- Command follow-up: manual implementation, then audit/critique only.

### B03 — P1: Desktop S1 separates the model from its parameter controls

- Location: `src/components/lab/thermal-stack/ThermalStack.astro:70` (stage), `:203` (breakdown), `:232` (parameters); `src/components/lab/thermal-stack/thermal.css:64`.
- Category: Implementation integrity / task layout.
- Evidence: at1440×1000 both stage and parameter panel are1152px wide and share x144. Stage y202.91/h490; parameters y834.69; first power input y1139.33. Model and sliders therefore cannot be examined together in the first desktop viewport. The top metrics remain within the stage rather than a separate top bar. Native Chrome independently confirms the stacking.
- Impact: changing inputs and reading the spatial result requires scrolling/context switching, contrary to the explicitly selected interaction arrangement.
- Standard: current explicit two-column brief; this overrides the older stacked S1 mock.
- Recommendation: top metric bar, left model, right analytic/FEM and grouped parameters at desktop; preserve existing2D fallback, keyboard layer selection, warning/live feedback and model disclosures. Use a mobile stack without overflow.
- Command follow-up: manual implementation, then audit/critique only.

### B04 — P2: Link token role is conflated with the orange label accent

- Location: `src/styles/global.css:318` (global anchor rule).
- Category: Theming / consistency.
- Evidence: global anchors use `--thermal-accent`; Home screenshots show orange underlined CTAs/navigation/card titles. DESIGN.md assigns links #0066CC light and #2997FF dark, separate from orange labels. S1 also applies local shell overrides, giving Home and S1 different link appearances.
- Impact: navigation and metadata compete with the same emphasis and the shell changes visual language between routes.
- Standard: design-token contract. The sampled orange contrast passes the sampled text pairs; this is not a contrast failure.
- Recommendation: add/use a semantic link token and D1 chevron link treatment. Keep focus visibly distinct and preserve links in prose where underlines aid recognition.
- Command follow-up: manual token correction, then audit/critique only.

### B05 — P2: Strict44×44 interaction target requirement has isolated gaps

- Location: `src/styles/global.css:352` (anchors only enforce min-height), `src/styles/global.css:64` (skip link), `src/components/lab/thermal-stack/thermal.css:434` and `:779` (tab padding).
- Category: Responsive / accessibility.
- Evidence: Chinese S1 mobile Conditions tab39.984×44px in both themes; desktop nav widths25.33–43.77px with44px height; focused skip-link height41.59px. Source confirms no universal min-width44 rule. The raw script also reports the offscreen skip link; only its focused hit area is relevant.
- Impact: small pointer targets are less forgiving for coarse input and fail the project's stated44px target standard.
- Standard: project requirement / enhanced target-size goal. These do not by themselves prove WCAG2.2 AA24px violations. Normal mobile menu links and tested sliders meet44px height.
- Recommendation: enforce44px minimum inline and block size for navigation, tabs and skip link without increasing visible icon/text size; check new compact header/menu does not overflow.
- Command follow-up: manual CSS correction, then audit only for measured sizes plus keyboard/touch checks.

### B06 — P2: Legacy GSAP dependency remains despite explicit removal scope

- Location: `package.json:31`, `src/scripts/demos.ts:79`, associated lockfile/dependency documentation.
- Category: Implementation integrity / dependency scope.
- Evidence: package pins gsap3.15.0 and demo code imports it dynamically. Home/S1 resource captures do not request it.
- Impact: baseline does not satisfy the new explicit dependency requirement; retaining the import would keep the removal incomplete even if the landing page does not load it.
- Standard: current user requirement. No separate claim about legal status is made here.
- Recommendation: replace the demo behavior with native animation as authorized, remove package/lock entries and refresh relevant dependency documentation/tests while preserving reduced-motion behavior.
- Command follow-up: manual dependency/code change; audit/critique are the only permitted Impeccable commands.

## Patterns and practices to preserve

The central mismatch is that shared D1 colors/fonts were carried over without D1's composition and interaction hierarchy. Local S1 styling is more complete than the shared Home shell. Keep a consistent semantic token layer and check the entire16-state matrix after changes instead of treating the default Chinese desktop view as sufficient.

Preserve the working strengths: one main/h1, locale-aware navigation, mobile menu Escape/focus return, explicit labels and units, tab keyboard behavior, native range controls, keyboard orbit/zoom/reset, forced2D fallback with layer selection, no observed page errors/overflow, and clear scientific limitations. Touch orbit survived cancellation and the tab strip scrolled under synthesized touch. Dark focus and sampled token contrast were sound. Rendering is invalidation driven, pauses when hidden and dynamically loads viewer/FEM code.

## Evidence and boundaries

The successful detector emitted `[]`, exit0, stderr empty; its33-file hashed scope, command and times are in `evidence/detector-invocation.json`. Initial launcher quoting failure(exit1) is retained separately. No detector finding was relabeled as a manual finding or hidden.

`browser-matrix.json` contains16 complete route/locale/width/theme states with HTTP200, no captured pageerror, scrollWidth equal viewport width, and16 screenshots. Contact sheets were inspected alongside the three immutable reference JPGs. `interactions.json` and `targeted-evidence.json` contain the keyboard/touch/geometry/model/contrast facts summarized in Assessment B.

No live overlay exists: native evaluate is documented read-only, so no mutation/injection was attempted and no live-server process was started. A fresh native Chrome tab was used and closed; preview shutdown remains coordinator-owned. All retained Playwright browsers were closed by finally blocks. The baseline preview was available during native inspection.

Cautions: default warning text appears in raw textContent even while hidden; native visible-height/AX/screenshot checks confirm no default false warning. The720px captures are reflow proxies, **not200% text scaling**. Chromium viewport/touch simulation is not physical iOS/Android or cross-engine validation. Sampled token contrast is not exhaustive WCAG certification. No fresh Lighthouse/LCP/throttling, frame-time or screen-reader test was run. Resource bytes are local transfer/decoded observations; not production-compression totals. Numerical models were exercised, not scientifically revalidated.

## Recommended order within the authorized task

1. Resolve B01–B03 with the fixed Home/S1 reconstruction and preserve the existing engineering/accessibility behaviors.
2. Resolve B04–B06 while integrating the shared shell/tokens and removing the legacy dependency.
3. Run the required functional/quality gates and actual200% text-size checks, then repeat the16-state audit and independent critique.

Only audit and critique are authorized Impeccable operations. No polish, adapt, optimize or other style command is proposed or executed; manual fixes remain part of the user's reconstruction request.

Questions skipped: implementation direction and acceptance requirements are already explicit; this before audit is input to the active reconstruction, not a new approval gate.

