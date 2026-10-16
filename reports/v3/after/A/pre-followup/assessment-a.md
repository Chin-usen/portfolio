# AFTER Assessment A — independent design review

Method: independent Assessment A by `/root/v3_after_a_complete`; no Assessment B, detector output, or previous before/after assessment was read. This report is for parent synthesis, not a combined A/B report.

Target: `portfolio-main-v3/src/components/HomePage.astro` and `src/components/lab/thermal-stack/ThermalStack.astro`, their styles/client/header dependencies, served at `http://127.0.0.1:4337/`. The root-owned preview process was left running. No production source was edited.

**Verdict: 30/40 — Good.** The fixed D1/S1 design is present, coherent, and usable across the tested matrix. The remaining concerns are specific to S1 interpretation and precise parameter work. Required placeholders are treated as intentional sample content, not design defects. This review does not compare with or claim improvement over an earlier version.

## Evidence and independence

- Read A-only `prep.md` and capture harness, critique guidance, `docs/DESIGN.md`, `docs/PRD.md`, `docs/design/README.md`, D1 desktop/mobile and S1 HTML references, and visually inspected all three immutable JPG references.
- Opened a fresh native Chrome tab first (`1585785878`), inspected Home visually and its accessibility tree, then inspected English S1 in that same A-owned tab. Did not reuse a prior assessment's tab.
- Captured and visually inspected all 16 full-page states: Home/S1 × zh/en × 1440/390 px × light/dark. The matrix uses Chromium 156.0.8078.4, 900 px viewport height, device scale factor 1. The geometry file records capture time and SHA-256 hashes for six relevant source files.
- Native Chrome inspection precedes the requested Playwright matrix harness. No detector or detector overlay was run or claimed.
- The harness initially failed because generated canvas and wrapper both matched `[data-thermal-canvas]`; narrowed the harness selector to `.thermal-canvas[data-thermal-canvas]`. A first full-page dark Home capture had an offscreen paint artifact: career-section crops were correct. Recaptured full pages after section paint and visually rechecked all four affected dark Home images. This was not reported as a product defect.
- Supplemental files: `interaction-evidence.json`, `home-interaction.png`, `s1-mobile-high-power.png`, `s1-convection-selection.png`, and four `*-390-text200.png` images. All four enlarged-text images were visually inspected.
- Only assessment-local harnesses/evidence/report were written. Browser processes created by the harnesses closed normally.

### Screenshot manifest and visual inspection

| Surface | Locale | 1440 light | 1440 dark | 390 light | 390 dark |
|---|---|---|---|---|---|
| Home | zh | home-zh-1440-light.png | home-zh-1440-dark.png | home-zh-390-light.png | home-zh-390-dark.png |
| Home | en | home-en-1440-light.png | home-en-1440-dark.png | home-en-390-light.png | home-en-390-dark.png |
| S1 | zh | s1-zh-1440-light.png | s1-zh-1440-dark.png | s1-zh-390-light.png | s1-zh-390-dark.png |
| S1 | en | s1-en-1440-light.png | s1-en-1440-dark.png | s1-en-390-light.png | s1-en-390-dark.png |

Every cell above was opened and visually inspected, including the footer and lower-page content. Home zh/en retain the same hierarchy, with natural English card wrapping. Dark Home retains visible career metrics after the capture artifact was eliminated. S1 retains readable controls and notes in both themes; English tabs wrap onto two rows without horizontal overflow. Mobile S1 uses a clear vertical sequence, though its model/parameter distance is a usability tradeoff described below.

## Fixed brief and design specificity

The composition is recognizably a hardware engineer's portfolio: the three-terminal module, measured career band, analytical slider, thermal stack, material controls and resistance breakdown are meaningfully related. The typographic/white-card language is intentionally familiar D1 minimalism. It does not feel like a generic dashboard grafted onto an unrelated landing page. Because names, positioning and career claims are intentionally placeholders, the candidate-specific story and the PRD's real recruiting effectiveness cannot yet be evaluated.

| Requirement | Observed evidence | Judgment |
|---|---|---|
| 52 px header | Geometry: 52 px in all 16 default states | Preserved, including mobile, following the fixed brief rather than the older 48 px mobile mock |
| 88/38 px two-line Home headline | 88 px desktop, 38 px mobile; both locales show two intended lines at default text size | Preserved; permitted rewrapping at 200% text prevents clipping |
| Orange eyebrow and blue CTA | Visible on every Home screenshot; source uses accent/link tokens | Preserved |
| Three-terminal native Three image | Exactly three copper-colored terminals, dark housing, gray base; static responsive WebP in Home. Scene/readme identify native Three.js BoxGeometry and build-time rendering | Preserved; no runtime Home 3D viewer is implied |
| Black career placeholder section | Real placeholder text, black band, large warm gradient number, three subordinate metrics | Preserved; no invented personal results |
| 28 px Lab cards | Geometry: 28 px at desktop and mobile; light white/dark charcoal surfaces | Preserved |
| Home live analytical Tj and ceramic slider | Default 125.6 °C; keyboard End changes thickness 0.32 → 1 mm and Tj to 133.4 °C, with matching status text | Actual interaction, not a decorative range or hardcoded displayed result |
| S1 top measurements, LEFT model / RIGHT parameters | Desktop measurements begin y=231.2; stage and parameter card both y=425.3; columns 670/462 px at 1440 px | Explicit brief override followed. Do not penalize difference from older stacked S1 mock |
| S1 D1 surfaces, 24 px cards, pills, scale, resistance bar | Stage radius 24 px; white card, soft segmented controls, labeled thermal scale and breakdown; dark variants retain grouping | Preserved |
| Narrow layout and bilingual equivalence | Every default matrix state has document scrollWidth equal to viewport width; language link preserves S1 route in inspected AX/source | No default horizontal overflow; English labels add height rather than clip |
| 44 px controls and 200% text | All visible a/button/input boxes in default matrix at least 44 × 44 CSS px. Four 390 px light text-enlargement tests have no overflow, with full-page visual inspection | Supported for this scope; text enlargement is root font-size 200%, not native browser zoom or a screen-reader test |

The local Noto subset change was not treated as a redesign. Current screenshots show the expected CJK hierarchy and no visible missing glyphs in these routes. I did not perform an outline-by-outline font comparison or exhaustive glyph coverage test.

## Nielsen heuristic scores

All ten apply because the target includes an interactive analytical tool, not only a static portfolio. Scores describe observed UX, not scientific accuracy or performance. A 4 is reserved for unusually complete behavior within this scope.

| # | Heuristic | Score / 4 | Evidence and remaining boundary |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Values, model selection and warning update; the parameter-local summary keeps Tj visible on mobile. Home status changes to 133.4 °C. Slow loading and failure states were source-reviewed, not deliberately exercised. |
| 2 | Match between system and real world | 3 | Layer/material terminology, units and source-node label suit the technical reader. Color-field limits are accurate in the notes but too distant from the graphic for a first-time reader. |
| 3 | User control and freedom | 4 | Back to Lab, route navigation, reset view, restore parameters, reversible model/material selection, and mobile Escape with focus return all provide direct exits. No destructive workflow exists. |
| 4 | Consistency and standards | 3 | D1 tokens and native ranges are consistent across locales/themes. Convection legend activation unexpectedly opens Cooler details/parameters rather than the convection control. |
| 5 | Error prevention | 3 | Ranges bound input, defaults give a usable result, and high temperature is signaled near both outputs and controls. The field's illustrative character is disclosed, but not at the interpretation point. |
| 6 | Recognition rather than recall | 3 | Labels, units, selected tabs, material presets and repeated output summary reduce recall. Mobile still requires scrolling between model/resistance details and parameter changes. |
| 7 | Flexibility and efficiency of use | 2 | Native slider keyboard operation, arrow-key tabs and view shortcuts help. Exact parameter values cannot be typed directly; reproducing a chosen multi-parameter case requires slider/key stepping. |
| 8 | Aesthetic and minimalist design | 3 | Strong first hierarchy, restrained orange/blue, meaningful black data break, and legible card grouping. S1's small assembled model occupies a comparatively tall mobile stage; desktop duplicates the result summary even while top metrics remain nearby. |
| 9 | Help recognize, diagnose and recover from errors | 3 | P=500 W shows 367.8 °C and a clear 175 °C warning. Restore defaults returns 100 W/125.6 °C and removes it. Input/model-load recovery copy exists in source, but those failure paths were not forced. |
| 10 | Help and documentation | 3 | Keyboard instructions, fixed-chip note, units, model provenance and validation limits are present in-context. The most important color-field caveat is several scroll regions below the mobile visualization. |
| | **Total** | **30/40** | **Good — 75%** |

## Cognitive load

The checklist is a design aid, not a clinical measurement. A five-item tab set is not automatically a critical defect: the relevant question is whether the reader must mentally combine all five to act.

| Checklist item | Home primary flow | S1 desktop | S1 mobile |
|---|---|---|---|
| Single focus | Pass: two clear routes, then one active Lab experiment | Pass: output, view and input roles are distinct | Pass: vertical order is clear |
| Chunking | Pass: four specialties, three metrics, four Lab cards | Fail: five parameter groups and eight legend entries | Fail: same sets wrap into multiple rows |
| Grouping | Pass: sections/cards provide clear units | Pass: measurement/model/control groups | Pass: separate cards preserve grouping |
| Visual hierarchy | Pass: headline → object → metrics → Lab | Pass: Tj is primary, inputs secondary | Pass: Tj remains unmistakable |
| One thing at a time | Pass | Pass: one active parameter panel | Pass: one active panel |
| Minimal choices | Pass on primary route: two CTAs | Fail under the strict ≤4 rubric: five tabs and eight layer choices | Fail under the same rubric |
| Working memory | Pass | Pass: model and controls sit side by side | Fail for spatial/model comparison; local Tj summary does solve numerical recall |
| Progressive disclosure | Pass: fuller simulator behind S1 link | Pass: tabs, selected layer card, material presets | Pass: same controls |

- Home primary path: 0 failures, low load. The expanded mobile menu is a separate five-destination choice set plus locale navigation; it exceeds the strict four-item guidance but remains familiar and clearly grouped. This is not a reason to remove required navigation.
- S1 desktop: 2 failures, moderate. S1 mobile: 3 failures, moderate. The intrinsic physics task explains much of the complexity; do not flatten everything into a single form.
- Explicit sets over four: five parameter tabs; eight resistance categories; five editable values in the AMB panel; five expanded mobile navigation destinations. Model choice has two options, view actions three, and ceramic presets three.
- The repeated parameter-local Tj/Rth/model summary is valuable on mobile. It prevents a numeric memory bridge while preserving the required top metrics and desktop left/right arrangement.

## Strengths to preserve

1. **A coherent evidence-oriented identity.** The landing sequence, hardware object and black numerical section establish engineering subject matter without decorative grids, annotation noise or marketing copy. Dark mode preserves the same hierarchy rather than simply inverting an image.
2. **A real low-friction demonstration.** The Home ceramic control gives an immediate, labeled numerical response and leads directly to the full simulator. S1 keeps the calculation model explicit, with detailed validation limits instead of a misleading claim of laboratory truth.
3. **Practical accessibility basics.** Default 44 px target boxes, visible keyboard focus, arrow-key tabs, reversible controls, mobile menu Escape/focus return and unclipped text enlargement were observed. These are actual interaction strengths, with the screen-reader limits below.

## Priority issues

### A1 — P2: Convection selection opens the wrong parameter context

**Where:** S1 resistance legend; `client.ts` convection branch.

**Observed:** Activating `Convection 12.2%` opens a card titled `Cooler` with 3 mm, 390 W/(m·K), a 31.31 °C layer drop and 51.7% resistance. It selects the `Cooler` tab, whose parameters are cooler thickness/conductivity. The convection coefficient h is in `Conditions`. The legend's accessible description promises to locate the selected item's parameters.

**Impact:** A technical reviewer investigating convection is directed to a different resistance component and must notice the changed title to avoid interpreting 51.7% as convection. The model remains operable, so this is not a task blocker.

**Constrained action:** Keep the legend and D1 design, but route convection to Conditions/h and show convection-specific data or omit the unrelated cooler card. Evidence: `interaction-evidence.json` → `convection`, `s1-convection-selection.png`.

### A2 — P2: The field's interpretation caveat is separated from the graphic

**Where:** S1 temperature scale and lower model/validation notes.

**Observed:** The scale names Temperature/°C and the nearby text explains enlarged thickness. The statement that the color field is illustrative and is not a FEM/validated local-temperature field appears only in the notes below the controls. At 390 px the model, eight-item breakdown and parameter card precede that caveat.

**Impact:** A first-time reviewer can reasonably read the vivid continuous field as simulated local temperatures before reaching its stated limitations. This is a disclosure-placement issue, not a claim that the numeric solver is invalid.

**Constrained action:** Add a short contextual indication beside the scale, such as `Illustrative field`, with the existing detailed explanation retained below. Keep the actual analytical Tj and FEM-surrogate distinction intact.

### A3 — P2: Exact case reproduction has no direct-value entry

**Where:** S1 parameter ranges/readouts.

**Observed:** Parameters use ranges with outputs; values respond to keys and material presets. There is no editable numeric field. The test could set 500 W with End and restore defaults, but an arbitrary chosen value or a complete reference case needs repeated slider/keyboard adjustments.

**Impact:** Acceptable for exploration, slower for the PRD's technical interviewer who wants to reproduce a particular case. The narrow h range track is especially hard to set precisely by pointer.

**Constrained action:** Make the existing value readout optionally editable with the same limits/units, preserving ranges as the primary exploratory interaction. This is an efficiency enhancement, not an accessibility blocker.

Priority counts: **P0 0 · P1 0 · P2 3 · P3 0**. No issue was invented to meet a quota; required placeholders, fixed title sizes, the 52 px mobile header, and the explicit S1 left/right override are not defects.

## Emotional journey and personas

**Journey:** The generous headline and singular hardware object create calm authority. The black metric band gives a deliberate visual peak; its placeholder status correctly limits what can be concluded about real credibility. The live Home control creates a second, earned moment of interest. S1 then supports active exploration and reassures through reset and model disclosures. The mobile valley is the scrolling distance between spatial output and controls. The ending is honest but subdued: three planned Lab cards and the footer are understandable for this authorized sample phase, not a broken-product finding.

- **Jordan / first-time recruiter, grounded in PRD:** Two blue CTAs make the next action obvious, and the hero object conveys the field. Required placeholder positioning prevents a real 10-second recruiting test; do not manufacture candidate content. In S1, AMB and model details assume technical knowledge, and A2 is the concrete interpretation red flag.
- **Sam / keyboard and low-vision technical reviewer:** The tested Home tab order reaches skip link, name, menu, CTAs, experiment link, slider and full simulation link with visible outlines. S1 tabs respond to ArrowRight, range controls respond to End, and reset works. All four 390 px/200% text views retain content without document horizontal overflow. A1 changes the semantic context unexpectedly; A3 slows exact keyboard-driven case entry. Real NVDA/VoiceOver output was not evaluated.
- **Casey / mobile visitor:** Menu opens with language access; Escape closes it and restores toggle focus. Controls meet the measured 44 px bounds. The S1 parameter panel begins around y=1222 px in Chinese and y=1329 px in English; the local summary makes numerical exploration practical, but checking the 3D consequence still requires a return scroll. No real-device touch, network interruption, background resume or slow-network test was run.

## Minor observations and scope boundaries

- The Home power-module silhouette is less dominant on mobile than the tightly cropped D1 mobile SVG reference because the new image includes its own scene whitespace. It is still readable and clearly has three terminals; the brief's essential shape is preserved.
- The S1 default assembled stack is small relative to the vertical stage, especially at 390 px. Reducing surplus stage space or using a closer default camera would shorten mobile comparison travel without violating top-metrics or desktop left/right placement. This is an optional refinement, not an additional priority issue.
- English tabs wrap, including desktop Cooler on a second row; the order remains clear and no text is cut off. At 200% text the English S1 title splits a long word across lines, but remains readable and does not overlap or disappear.
- Required font family/glyph appearance was observed only in the rendered content. No claim is made about all possible CJK glyphs or complete font binary equivalence.
- The page reports analytic 125.6 °C by default; the tested ceramic material preset changed it to 120.8 °C and FEM surrogate to 110.4 °C for that changed ceramic conductivity. These are UI observations, not independent validation of thermal predictions. FEM disclosure explicitly distinguishes its inspected holdout from a fresh independent test and experimental validation.
- No Lighthouse run, detector scan, performance score, screenshot pixel diff, contrast-ratio audit, network-failure injection, screen-reader session, real device or cross-browser testing was performed by A. Do not convert these screenshots into claims of universal accessibility or scientific correctness.
- The 200% test doubles the root font size at a 390 px viewport in light mode and inspects the resulting layout. It does not establish native browser zoom behavior, every theme at enlarged text, or arbitrary viewport support. All 16 default states have no page errors and no horizontal overflow; all observed default a/button/input boxes meet 44 px minima.
- The browser automation artifact directory is the deliverable location; harness scripts are retained for reproducibility. Root's preview remains available at port 4337.

Questions skipped: the user supplied a fixed brief and explicitly authorized completing the after-assessment without a new question gate; the three priority issues above are offered for parent synthesis within that scope.
