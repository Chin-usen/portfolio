Method: independent Assessment A (design review), recovered by /root/review_a_recovery before any Assessment B or detector findings were read.

# Before — Assessment A

Date: 2026-10-14. Baseline: `portfolio-p3`, unchanged by this reviewer. This is the raw A assessment for the parent dual-agent synthesis, not the combined critique.

## Scope and evidence boundary

Reviewed Home, Work, Lab, About, Contact, and S1 chip-junction-temperature in Chinese and English, at 1440 px desktop and 390 px mobile widths, in light and dark media preferences: all 48 existing screenshots were visually inspected. Also inspected the four existing targeted mobile screenshots, A's captured DOM measurements and interaction notes, and relevant source. The captures are from the same baseline: matrix written 2026-10-14 06:58:55 UTC, interaction notes 07:00:46 UTC. Recovery reused them and did not repeat the full capture matrix or modify product files.

Evidence root: `.dev-tools/reviews/assessment-a-evidence/`. Matrix files use `{zh|en}-{home|work|lab|about|contact|s1}-{1440|390}-{light|dark}.png`. Measurement files: `matrix.json` and `interaction-notes.json`. Capture provenance: `.dev-tools/reviews/assessment-a-capture.cjs` and `.dev-tools/reviews/assessment-a-interactions.cjs`.

User constraints: preserve D1 direction, existing colors, Geist / Noto Sans SC / Geist Mono choices, IA, and engineering copy. `docs/DESIGN.md` and `docs/PRD` are absent in the workspace according to the coordinator's verified context; no replacement brief or audience assumptions were invented. Source and rendered baseline provide the visual truth. `portfolio-p3/.impeccable/critique/ignore.md` is absent. Pinned reference: `.dev-tools/skills/impeccable/reference/critique.md`, Impeccable commit `2f98774f86bc05563876643db37e6c37c322850f`.

Mode: Experience for the portfolio, Operate for S1, with Read content explaining the model. Therefore all ten heuristics apply, including efficiency and contextual help. The simulator's numerical validity, real-device touch behavior, actual screen-reader speech, performance scoring, and detector rules are outside this independent design assessment. Screen-reader-related findings below distinguish source support from tested keyboard behavior. No Assessment B files or detector output were read.

## Design specificity verdict

S1 is authored for the subject: the layered thermal stack, prominent junction-temperature result, thermal-resistance breakdown and parameter groups communicate an engineering experiment. Its orange accent, restrained surfaces and numerical typography support the artifact rather than becoming decoration. This is the strongest source of product identity.

The surrounding portfolio remains a structural scaffold. Home, Work and Lab use undifferentiated rectangular text cards, browser-blue links and system fonts; About and Contact are plain text layouts. Source explicitly calls these neutral placeholders. The visual jump into S1 is consequently much larger than the change in task warrants. This is not evidence that D1 should be replaced: it is evidence that the already-established D1 system has not reached the shared shell. The opportunity is continuity and legibility within that system.

The content is more specific than the layout: constraints, assembly decisions and verification boundaries are credible organizing ideas. Preserve this restrained engineering voice. Do not invent real employment, customers, outcomes, profile information or validation claims to make the portfolio appear richer.

## Design health

| # | Heuristic | Score / 4 | Evidence and limitation |
|---|---|---:|---|
| 1 | Visibility of system status | 2 | S1 recalculates and exposes status, but its main temperature and threshold warning are outside the mobile viewport during parameter editing. |
| 2 | Match between system and real world | 3 | Units, physical layer names and engineering explanations fit the task. The distinction between equivalent source temperature and a true peak needs easier access, not new claims. |
| 3 | User control and freedom | 3 | Menu Escape, view reset, parameter reset and model fallback provide exits. Keyboard tab selection works, though selected Cooler can remain visually outside its tab strip. |
| 4 | Consistency and standards | 2 | Navigation and locale structure are stable; typography, link treatment, surfaces and dark behavior differ sharply between S1 and every other reviewed route. |
| 5 | Error prevention | 3 | Bounded sliders, defaults, units and model limitations are present. A threshold warning that leaves the viewport weakens this otherwise sound foundation. |
| 6 | Recognition rather than recall | 2 | Main routes and labels are recognizable. Hidden English Cooler navigation and offscreen result comparison impose avoidable recall. |
| 7 | Flexibility and efficiency | 2 | Native slider keyboard input and Arrow/Home/End tab handling exist. Mobile parameter exploration still requires repeated travel between inputs and results. |
| 8 | Aesthetic and minimalist design | 3 | The experiment has a strong focal point and the page structures are calm. Supporting text is compressed to preserve that visual calm, reducing practical clarity. |
| 9 | Error diagnosis and recovery | 3 | Simulated FEM load failure states the problem, keeps analytical results active and offers retry. The state was captured with the result preserved at 125.6. |
| 10 | Help and documentation | 2 | Assumptions and validation notes exist in context, but their very small type and distance from the main number reduce usefulness at the decision point. |
| **Total** | **All ten applicable; no n/a** | **25 / 40** | **Acceptable — 62.5%; significant improvements needed in mobile use and consistency.** |

Scores use the pinned 0–4 guide, where 4 means excellent rather than merely functional. P0 count: 0. P1 count: 3. P2 count: 2. P3 priority issues: 0.

## What works

1. **S1 makes the physical model the centerpiece.** The geometry, temperature and resistance contributions establish a clear engineering story. Light and dark S1 captures maintain the same hierarchy and content; the colors are purposeful.
2. **Recovery preserves a usable result.** `en-s1-390-fem-load-failure.png` and `interaction-notes.json` show a specific load-failure message, an active analytical selection and preserved output. Source also includes polite result announcements and explicit status/error regions; this is positive source evidence, not a claim of a completed assistive-technology test.
3. **The portfolio is straightforward to navigate and read.** All 48 captured document widths match their viewport widths. Localized headings and content fit, the mobile menu opens with keyboard focus reaching Home and closes with Escape, and revealing email transfers focus to the revealed link. Existing sample-content disclosure is appropriate to the fictional brief.

## Priority issues

### A1 — P1: The mobile control/result feedback loop breaks

**What:** On mobile, changing chip power happens below the visualization and headline result. In the existing End-key check, power becomes 500 W and the result becomes 367.8, but the result's top is -312.69 px while the input is at 413.66 px in the viewport. The threshold warning is unhidden in the DOM but is not visible alongside the changed input.

**Why it matters:** Exploring cause and effect is the core S1 task. The user must scroll back, remember the result, return to the control, and repeat. Missing the warning is an additional comprehension problem even though this is a fictional demonstration.

**Fix within D1:** Repeat a compact, synchronized result and existing warning beside the parameter controls, or use a small mobile result strip while those controls are visible. Include the active model and units using existing text. Keep it clear of sliders and focus, and avoid duplicate screen-reader announcements. Do not replace the existing main visualization.

**Evidence:** `en-s1-390-power-max-viewport.png`; `interaction-notes.json` keys `afterPower`, `resetResult`. Source: `portfolio-p3/src/components/lab/thermal-stack/ThermalStack.astro:87`, `:115`, `:234`; `client.ts:133` and `:139` in the same directory. Suggested workflow: `$impeccable audit` / manual responsive fix, then `$impeccable critique` confirmation; no new direction command.

### A2 — P1: Important supporting information is too small to read comfortably

**What:** At 390 px, computed font sizes are 8.32 px for the source-node qualifier, 8 px for legend values, 7.2 px for the color-scale explanation, 8.8 px for view-action labels and 9.28 px for range labels. Model-note paragraphs are 10.72 px. The full-page screenshots confirm that these are visually subordinate to the point of being hard to inspect, especially in the dense Chinese notes.

**Why it matters:** The qualifiers explain what the number and colored geometry actually mean. Shrinking them makes the demonstration look more certain than its existing engineering copy permits, and creates unnecessary zoom work for low-vision readers. This is a legibility judgment; font size alone is not being reported as a measured WCAG contrast failure.

**Fix within D1:** Keep the font families and palette; increase supporting-label and explanatory-text sizes, line height and available layout space. Reflow the legend and notes instead of scaling them down to fit. Give the existing source-node qualifier readable presence beside the result. Preserve all scientific limitations verbatim.

**Evidence:** All eight S1 matrix screenshots; `interaction-notes.json` key `s1Style`. Source: `portfolio-p3/src/components/lab/thermal-stack/thermal.css:659`, `:683`, `:714`, `:759`, `:798`, `:805`; desktop note styling at `:567`. Suggested workflow: `$impeccable audit` / manual typography fix; verify with critique in both languages.

### A3 — P1: The shared portfolio shell does not carry the established D1 identity

**What:** Home, Work, Lab, About and Contact render with `system-ui, sans-serif`, white Canvas backgrounds under both light and dark preferences, browser-blue links and square baseline cards. S1 switches to Geist / Noto, its own surfaces, orange-accent controls and actual dark styling.

**Why it matters:** Moving from the portfolio to its flagship experiment feels like crossing between unfinished and finished products. For an Experience surface, this inconsistency directly weakens confidence in the work and fails to express the pinned visual direction consistently.

**Fix within D1:** Apply the existing approved font families and shared D1 color/surface tokens to the shell and its controls. Harmonize link, border, spacing and focus treatments using those tokens. Preserve every page, navigation destination, title and engineering paragraph. Do not introduce a different palette, speculative hero art, new claims or a new IA. Confirm which system behavior is intended globally from the explicit user constraints; no missing design document can be treated as a license to invent one.

**Evidence:** Compare `en-home-1440-light.png`, `en-home-1440-dark.png`, `zh-about-390-dark.png` and `en-contact-390-light.png` with the corresponding S1 captures. `matrix.json` records the font/background difference for every route. Source: `portfolio-p3/src/styles/tokens.css:1`, `global.css:3`, `thermal-tokens.css:1` and `:46`; font imports in `portfolio-p3/src/components/lab/thermal-stack/ThermalStack.astro:2`. Suggested workflow: manual consistency correction within the audit/critique scope.

### A4 — P2: English mobile Cooler tab is hidden without an overflow cue

**What:** The English tab strip has 324 px of visible width and 383 px of content. Cooler starts at x=360.98 and ends at x=416.38, beyond the strip's visible right edge. The scrollbar is hidden. Pressing End successfully selects Cooler, but its label and focus remain clipped; the screenshot shows the Cooler panel below an apparently unchanged set of visible tabs.

**Why it matters:** A first-time visitor may conclude that cooling parameters are absent. A keyboard user can activate a panel while losing sight of which tab is active. Horizontal scrolling is a workaround, so this is P2 rather than a complete blocker.

**Fix within D1:** Let the existing tabs wrap cleanly or provide an obvious scroll affordance, and bring the selected tab into view on keyboard selection without unexpectedly scrolling the page. Keep the five categories and engineering labels intact.

**Evidence:** `en-s1-390-light.png`, `en-s1-390-cooler-keyboard.png`; `interaction-notes.json` keys `tabs`, `coolerKeyboardSelected`. Source: `portfolio-p3/src/components/lab/thermal-stack/thermal.css:425` and `client.ts:63` in the same directory; `focus({ preventScroll: true })` is at `client.ts:68`. Suggested workflow: manual responsive/accessibility correction, audit and critique confirmation.

### A5 — P2: Mobile controls offer unnecessarily small touch areas

**What:** Measured view-action buttons are 31 px tall, legend-layer buttons 32 px, model choices approximately 25.92 px, reset approximately 24.64 px, and S1's menu button 28.39 px. The general-shell menu and Reveal email buttons are approximately 31.59 px tall. Language links are 18–20 px tall.

**Why it matters:** These controls are usable with a mouse and many remain reachable by keyboard, but the small hit areas increase precision demand for a one-handed mobile visitor. This is a practical 44 px comfort-target recommendation, not a claim that every element fails a specific WCAG target-size rule; surrounding spacing and exceptions would need separate standards assessment.

**Fix within D1:** Increase interactive hit areas toward at least 44 px on mobile, allow sensible wrapping and preserve separation between adjacent targets. The visible label need not become visually loud. Keep the quiet D1 control treatment and all existing actions.

**Evidence:** `matrix.json`, especially `en-home-390-light`, `en-contact-390-light`, `en-s1-390-light`; their screenshots. Source: `portfolio-p3/src/components/lab/thermal-stack/thermal.css:189`, `:435`, `:683`, model-switch styling in the same file; `portfolio-p3/src/styles/global.css:18` and the mobile header rules. Suggested workflow: manual hit-area correction under audit, followed by mobile critique confirmation.

## Cognitive load

Portfolio indexes have low cognitive load: one selected work item and three lab choices, familiar page labels, and no competing filter/sort system. The five top-level navigation items exceed a literal four-option count, but are stable and familiar; this alone is not a reason to change the locked IA.

S1 mobile has **three checklist failures: moderate cognitive load**:

| Checklist | Result | Observation |
|---|---|---|
| Chunking | Fail | Eight labeled resistance contributions are presented together in very small wrapping text; they are also interactive layer buttons. |
| Grouping | Pass | Visualization, resistance, parameters and explanatory notes form understandable sections. |
| Visual hierarchy | Pass with legibility caveat | Main temperature and geometry dominate correctly; A2 covers the suppressed secondary information. |
| One thing at a time | Pass | One active parameter panel avoids exposing every slider at once. |
| Minimal choices | Fail | Five parameter tabs are a single decision set; eight layer selectors form another. Preserve the meaningful categories, improve presentation and visibility. |
| Working memory | Fail | A1 makes the user remember a result across scrolling before adjusting inputs again. |
| Progressive disclosure | Pass | Tabs, model choices and selectable layers reveal task-specific detail. |

Do not solve these findings by deleting technical content. Make the result local to the action, the selected category visible, and the detailed text readable.

## Emotional journey

The entry is calm and candid, but the scaffold-like portfolio shell undersells the work. S1 provides the strongest peak: a physical stack and an immediately understandable headline number. The mobile valley begins when the visitor reaches the parameters and loses sight of the result, then encounters tiny legend text and a clipped final category. Load failure is handled reassuringly: the explanation states that analytical results remain available. The ending contains responsible limitations, but reading them requires more effort than the main result; increase their legibility while keeping their meaning. Contact is uncomplicated and honestly marked as sample data. Do not remove that disclosure to manufacture confidence.

## Persona walkthroughs

**Sam — keyboard and accessibility-dependent reader.** Opening the mobile menu, reaching Home with Tab, closing with Escape, changing a slider with End and revealing email are supported by the existing interaction evidence. The S1 source includes labels, outputs and a polite result live region. The red flag is selecting Cooler with End while its tab and focus stay out of view. Low-vision inspection is also burdened by the 7.2–10.72 px secondary text. No actual NVDA/VoiceOver session or 200% zoom test was performed in this recovery, so neither is claimed to pass.

**Jordan — first-time visitor.** Home clearly offers Work and Lab and the content declares its sample status. On entering S1, the visual stack and temperature are understandable entry points. The analytical-source qualifier and model limitations are too small relative to the confident number, and the English mobile tab strip does not reveal the cooling category. The remedy is clearer presentation of existing terminology and boundaries, not rewriting the engineering copy for a different audience.

**Casey — distracted mobile visitor.** Locale and contact actions are easy to find, and the simple content pages do not overflow. In S1, repeated scrolling separates parameter adjustments from their effect. Small model/reset/view targets and tightly packed layer labels require careful taps. A visible result beside the active controls and comfortable hit areas would materially improve this path. Slow-network behavior beyond the captured FEM load failure and interruption/state persistence were not tested.

## Minor observations and deliberate non-findings

- No document-level horizontal overflow appears in A's 48 measurements. The clipped S1 tab strip is a local overflow problem, not a whole-page overflow claim.
- The plain portfolio's large desktop whitespace is not itself a defect; it follows the small amount of sample content. Do not add invented projects to fill it.
- D1's restrained rounded experiment panels and orange accent are retained because the explicit brief wins over stylistic preferences.
- The color field is accompanied by existing limitations. This review does not certify its physical validity or infer a numerical error from appearance.
- The load-failure message says retry and preserves the current analytical result. An explicit retry button could improve convenience, but this is lower priority than the five issues above.

## Design prompts retained for the synthesis

- Can the user change one parameter and understand its consequence without leaving the control area?
- Can the existing source-node and validation qualifications be as easy to read as the result is to notice?
- Can the shared shell express the existing D1 system without changing a single engineering claim or navigation destination?

Questions skipped: the user already authorized all high/medium fixes that do not conflict with the locked design direction. These prompts are review considerations, not a request to pause work.

## Assessment completion notes

This reviewer inspected all 48 existing matrix images plus the four targeted interaction images, read only A evidence and baseline source, and produced this independent report before receiving detector findings. No new full matrix, product edits, server starts, server stops, public open-tag messages or detector runs were performed. The baseline server remains under the parent coordinator's ownership. The combined report, detector synthesis, final validation and archive persistence are the parent coordinator's responsibilities.
