Method: dual-agent (A: /root/review_a_recovery · B: /root/review_b_recovery)

# Before critique — frozen portfolio baseline

Date: 2026-10-14. Target: the Home, Work, Lab, About, Contact and S1 chip-junction-temperature surfaces in the frozen `portfolio-p3/` source. That delivered source was imported into main at baseline commit `36dd3d9d9210a9ea20b1d4574c5db366e79805c3`. This is the complete combined **before** report, synthesized from the independent [Assessment A](assessment-a.md), [Assessment B](assessment-b.md), and [technical audit](audit.md). It contains no after score.

A completed its unanchored design judgment without reading B or detector findings. B worked independently and supplied technical measurements, browser evidence and the retained detector artifact. This synthesis did not rerun either assessment or the 48-state captures. The scores below are the assessments' human-readable, skill-guided judgments; no external CLI generated the critique or audit scores.

The governing playbooks are the [Impeccable critique reference](https://github.com/pbakaus/impeccable/blob/2f98774f86bc05563876643db37e6c37c322850f/.agents/skills/impeccable/reference/critique.md) and audit reference from the same pinned source, commit `2f98774f86bc05563876643db37e6c37c322850f`. See [provenance](../PROVENANCE.md) and the [evidence guide](evidence/README.md) for archive mappings and execution limits.

## Scope, mode and preserved direction

The existing evidence covers 6 pages × 2 languages (Chinese/English) × 2 widths (1440/390 CSS px) × 2 color preferences (light/dark): **48 distinct view states**, with additional targeted keyboard, failure, touch and enlarged-text evidence. These are independent A/B captures of the same 48-state coverage, not 96 different product states. Desktop viewport height is 1000 px; mobile is 844 px.

The portfolio is an **Experience** surface, S1 is an **Operate** surface, and its engineering explanation is **Read** content. All ten heuristics apply to the combined scope; none is n/a.

The user's explicit D1 direction, existing colors, Geist / Noto Sans SC / Geist Mono fonts, information architecture, and engineering text remain authoritative. In particular, keep the restrained light/dark surfaces, orange accent, physical layer story, scientific qualifications, sample-data disclosures and current navigation destinations. Do not invent credentials, customers, project outcomes or numerical validation claims.

`docs/DESIGN.md` and `docs/PRD` / `docs/PRD.md` were absent. No replacement document, audience brief or new visual direction was inferred from that absence. Baseline source, rendered evidence and the explicit constraints define this refinement's boundary.

## Design specificity verdict

**S1 is authored for its subject; the shared portfolio shell has not caught up with that identity.** The thermal stack, large junction-temperature result, material parameters and resistance contributions form a coherent engineering experiment. The geometry and numbers lead, while orange controls and restrained surfaces support the work. This is the product's strongest expression of D1.

Home, Work and Lab still use neutral rectangular text cards, browser-blue links and system fonts; About and Contact remain plain text layouts. Their source identifies them as placeholders. Entering S1 therefore feels like moving from an unfinished shell into a finished experiment. The opportunity is to apply the existing D1 system consistently and make its information usable, while preserving the engineering voice and small, candid sample-content scope.

**Deterministic signal:** [before-detector-raw.json](evidence/before-detector-raw.json) is exactly `[]`: **0 findings, no rule names and no file locations**. It contributes no additional rule finding and has no rule false positives to list. It does not establish that the design or accessibility is clean. B's browser/source checks found contrast, keyboard, warning and layout issues that are not represented in that empty artifact.

**Browser overlay:** no reliable user-visible detector overlay exists for this run. The native in-app browser was unavailable; a fresh Chrome extension tab provided bounded page evidence, but its documented evaluate surface did not permit mutable script injection. Detector overlay/console findings are **unavailable**, not zero. The existing Playwright captures are the stated fallback.

## Design health

The synthesis preserves A's independent scores instead of changing them after detector/browser evidence entered the shared context. B adds risk and confirmation beside those scores.

| # | Nielsen heuristic | Score / 4 | Evidence and interpretation |
|---|---|---:|---|
| 1 | Visibility of system status | 2 | S1 calculates and exposes status, but the mobile result/warning leave view during parameter changes. B also confirms the warning is absent from the live result announcement. |
| 2 | Match between system and real world | 3 | Units, physical layers and engineering explanations fit the task. Source-temperature versus peak-temperature qualifications need readable proximity, without new claims. |
| 3 | User control and freedom | 3 | Menu Escape, resets and analytical fallback provide exits. Cooler can be selected while clipped; B separately identifies missing keyboard orbit/zoom. |
| 4 | Consistency and standards | 2 | Locale and navigation structure are stable; shell typography, surfaces and theme behavior diverge from S1. |
| 5 | Error prevention | 3 | Bounded sliders, defaults, units and explicit model limitations are present. The offscreen/unannounced threshold warning weakens their practical value. |
| 6 | Recognition rather than recall | 2 | Routes and labels are recognizable, but hidden Cooler navigation and result/input separation require recall. |
| 7 | Flexibility and efficiency | 2 | Native slider keys and Arrow/Home/End tabs work. Mobile exploration still demands repeated scrolling; view manipulation lacks keyboard parity. |
| 8 | Aesthetic and minimalist design | 3 | Calm structures and a clear experiment focal point work well; very small secondary text achieves density at a cost to comprehension. |
| 9 | Help users recognize, diagnose and recover from errors | 3 | Simulated FEM load failure states the issue, retains analytical output and suggests retry; the preserved result is 125.6. |
| 10 | Help and documentation | 2 | Assumptions and validation notes exist, but small type and distance from the result make them hard to use at the decision point. |
| **Total** | **10 applicable; none n/a** | **25 / 40** | **Acceptable — 62.5%; significant improvements needed.** |

A's issue counts: P0 0 / P1 3 / P2 2 / P3 0. B's separate technical audit scores Accessibility 2, Performance 3, Theming 2, Responsive Design 2, Implementation Integrity 3: **12/20, Acceptable**. B's counts are P0 0 / P1 5 / P2 4 / P3 1. These counts describe different, overlapping review sets and must not be added as if every entry were unique. Neither score is WCAG certification, a Lighthouse score, a field-performance rating or a numerical-model validation result.

## Overall impression

The engineering artifact gives the site a clear reason to exist. The largest opportunity is to keep its result, limitations and controls understandable together, especially on a phone, and make the surrounding pages feel part of the same D1 system. This requires implementation and presentation corrections within the current direction, not a new aesthetic or rewritten product claims.

## What works

1. **The physical model carries the story.** Layers, temperature and resistance make the experiment specific and understandable. S1 preserves its hierarchy in both themes, and the content clearly states its modeling boundaries.
2. **Core navigation and recovery are sound.** Both locales support keyboard menu opening, Escape/focus return and email reveal/focus transfer. Locale switching preserves all six equivalent routes. FEM failure keeps analytical results available instead of leaving a dead screen.
3. **The implementation has useful foundations.** Native ranges have labels, units and value text; tabs and model selection have real state; the 2D fallback remains operable. Source shows dynamic viewer loading, on-demand rendering, reduced-motion final-state handling, narrow/coarse-pointer mesh reduction and cleanup. All 48 B states returned HTTP 200 with no recorded pageerror or document horizontal overflow.

## Priority issues

These five work groups synthesize the most consequential findings. Original IDs remain visible so the full raw findings can be traced without renumbering or hiding lower-priority work.

### C1 — P1: Keep the result and warning at the point of parameter editing

**What:** On 390 px mobile, A changed power to 500 W and observed 367.8°C, but the main result was at y = −312.69 px while the input was at y = 413.66 px. The threshold warning existed outside the visible editing context. B confirms that its visible warning has no status role/live ancestor and is absent from the existing result announcement.

**Why it matters:** The core action is changing a parameter and understanding its consequence. Repeated scrolling requires users to memorize values; a warning that is neither nearby nor announced can be missed.

**Fix within D1:** Provide a compact synchronized result, units, active-model context and existing warning beside the controls, or an unobtrusive mobile result strip while the controls are in use. Retain the primary visualization. Include the localized warning in an appropriate status update when its state changes; avoid duplicate or assertive announcements for every slider tick.

**Evidence:** A1 and B-05; [A interaction measurements](evidence/assessment-a-evidence/interaction-notes.json), [power-max viewport](evidence/assessment-a-evidence/en-s1-390-power-max-viewport.png), B targeted `warning` record in [targeted verification](evidence/before-targeted-verification.json). Baseline source: `ThermalStack.astro:87,115,234`; `client.ts:133,139,159` under `src/components/lab/thermal-stack/`.

**Authorized workflow:** manual fix based on /audit findings; /audit and /critique confirmation. No additional Impeccable refinement command is invoked.

### C2 — P1: Make technical explanations readable and allow enlarged text to reflow

**What:** A measured 8.32 px source labels, 8 px legend values, 7.2 px scale notes, 8.8 px view labels and 9.28 px range labels; model-note paragraphs were 10.72 px. B independently found several units/explanations in the 7.2–10.4 px range. These are different sampled elements, not one contradictory universal font measurement. At 200% root-font size, the fixed 380 px mobile stage allows metrics, actions and scale content to overlap in both languages.

**Why it matters:** The qualifications explain what the confident headline number does and does not mean. Tiny text forces magnification, while overlapping enlarged text undermines that remedy.

**Fix within D1:** Retain font families, palette and engineering wording. Increase secondary text/label sizes and line height; allow layout space to grow. Reflow legend and notes. Put metrics/actions in non-overlapping flow or reserve explicit space outside the canvas at narrow widths and enlarged text sizes.

**Evidence:** A2, B-04 and B-08; [English enlarged-text screenshot](evidence/b-text200-s1-en.png), [Chinese enlarged-text screenshot](evidence/b-text200-s1-zh.png), A `s1Style` measurements and B `text200` geometry. Baseline `thermal.css:64,96,180,269,567,642,659,683,714,759,798,805`. B records intersecting English metrics (x 50, y 836.42, w 265.70, h 267.98) and actions (x 198.05, y 833.42, w 146.95, h 145.56).

**Boundary:** Font size alone is not a WCAG failure. The 200% technique enlarges the root font; it is concrete text-expansion evidence, not a completed full-browser zoom or OS scaling conformance test.

**Authorized workflow:** manual responsive/typographic correction informed by /audit; bilingual /critique confirmation.

### C3 — P1: Complete keyboard view operation and fix verified control contrast

**What:** B found three separate accessibility issues. The dark S1 skip link renders pale text on white at approximately 1.09:1. A selected light-mode material preset uses orange text over orange-tinted white at approximately 3.85:1, below 4.5:1 for that small label. The WebGL viewer supports Home/Escape but no keyboard orbit/zoom equivalent: settled canvas hashes remain identical after ArrowRight and “+”.

**Why it matters:** Keyboard/low-vision users can reach controls yet lose their readable state, and cannot inspect all the views available to pointer users.

**Fix within D1:** Bind skip-link foreground/background to a matched existing theme pair. Use an existing high-contrast text token for the selected material, retaining its accent border/background. Add keyboard-accessible orbit/zoom controls and localized instructions while retaining pointer controls and reset.

**Evidence:** B-01/B-02/B-03; [English dark skip link](evidence/b-en-dark-skip.png), [Chinese dark skip link](evidence/b-zh-dark-skip.png), [settled orbit before](evidence/b-orbit-before.png), [settled orbit after](evidence/b-orbit-after.png), B interaction/targeted JSON and the settled Chrome follow-up documented in [Assessment B](assessment-b.md). Baseline source: `global.css:64`, `thermal-tokens.css:6,10,46,56`, `thermal.css:484`, `viewer.ts:161,415`.

**Boundary:** The selected preset works. The earlier immediate sample preceded its queued update; only settled contrast is defective. Contrast ratios derive from observed computed sRGB colors and alpha composition, not an exhaustive contrast inventory. The relevant criteria are WCAG 1.4.3 and 2.1.1; no full accessibility certification is claimed.

**Authorized workflow:** manual accessibility corrections under /audit; targeted keyboard/theme confirmation and /critique.

### C4 — P1: Carry the established D1 system across the shared shell

**What:** Home, Work, Lab, About and Contact retain system fonts, browser-blue links and white Canvas surfaces in light and dark preferences. S1 uses Geist / Noto, deliberate thermal surfaces, orange accents and an actual dark theme. B independently confirms identical shared-shell theme captures and `colorScheme=normal`.

**Why it matters:** The portfolio surrounding its strongest artifact appears unfinished and loses continuity. Dark-preferring visitors also encounter an abrupt bright transition.

**Fix within D1:** Apply the existing approved fonts and light/dark color/surface tokens to shared layout and controls. Harmonize links, borders, spacing and focus treatment. Preserve every page, destination, heading and engineering paragraph. Missing design documents do not authorize new colors, hero art, claims or IA.

**Evidence:** A3/B-06; the four [contact sheets](evidence/README.md#screenshots), [English Home light](evidence/b-en-home-1440-light.png) versus [dark](evidence/b-en-home-1440-dark.png), and corresponding S1 examples. Baseline `src/styles/tokens.css:1`, `global.css:3,10`, `thermal-tokens.css:1,20,46`; `ThermalStack.astro:2` font imports.

**Boundary:** Shared dark-theme inconsistency is a product requirement/design issue, not an automatic WCAG violation.

**Authorized workflow:** manual consistency correction derived from /audit and /critique, preserving D1.

### C5 — P2: Make mobile categories discoverable and controls comfortable to operate

**What:** The English tab strip has 324 px visible width and 383 px content; Cooler occupies x 360.98–416.38 and its scrollbar is hidden. End selects Cooler but leaves the active label/focus clipped. Measured controls are repeatedly small: view buttons 31 px high, legend buttons 32 px, model choices about 25.92 px, reset about 24.64 px, and language links 18–20 px.

**Why it matters:** A first-time visitor can miss the cooling category. A keyboard user can select a panel without seeing its tab. Small targets demand precise one-handed taps.

**Fix within D1:** Allow tabs to wrap or provide an obvious scroll affordance, and reveal the selected tab without unexpectedly scrolling the page. Grow effective mobile hit areas toward 44 px with sensible spacing/wrapping; keep visual marks quiet and preserve all five categories.

**Evidence:** A4/A5/B-07; [Cooler selected by keyboard](evidence/assessment-a-evidence/en-s1-390-cooler-keyboard.png), `tabs` and `coolerKeyboardSelected` in A notes, and target geometry in B matrix. Baseline `thermal.css:189,425,435,513,683,755,775,801,861`, `client.ts:63,68`, and shared mobile header rules.

**Boundary:** Synthesized touch successfully scrolls the strip and operates controls. This is local overflow/discoverability, not document overflow. A 44 px comfort/audit target is not a blanket WCAG 2.5.8 AA violation; the 24 px rule, spacing and exceptions require individual assessment.

**Authorized workflow:** manual mobile/accessibility correction under /audit; /critique confirmation.

## Complete technical finding coverage

The following retains all ten B findings, including those outside the five headline groups. Raw A has five findings, all mapped above.

| Raw ID | Original priority | Coverage in synthesis | Evidence basis |
|---|---|---|---|
| B-01 | P1 | C3, skip-link contrast | Computed colors and dark skip-link screenshots |
| B-02 | P1 | C3, selected material contrast | Settled native Chrome state, alpha-composited colors |
| B-03 | P1 | C3, keyboard orbit/zoom | Settled canvas hashes plus keyboard handler source |
| B-04 | P1 | C2, enlarged-text collisions | 200% root-font screenshots and intersecting rectangles |
| B-05 | P1 | C1, warning announcement | Warning attributes/live-result text and source |
| B-06 | P2 | C4, shared theme consistency | All shared-page theme captures and computed body colors |
| B-07 | P2 | C5, control hit areas | 390 px matrix target measurements |
| B-08 | P2 | C2, technical text/units | Computed font sizes and CSS |
| B-09 | P2 | Performance work below | Resource-size evidence and font imports |
| B-10 | P3 | Semantic maintenance below | Work/Lab h1→h3 heading sequences and shared cards |

**B-09 — P2, measured performance opportunity:** S1's generated `LabDetail.DaM3fsho.css` response is 256,868 decoded bytes / 257,168 transferred bytes on the local static server. Inspect duplicated/unneeded font-face/subset declarations while preserving the locked families, weights and Chinese/English coverage; measure compressed production output before changing loading strategy. The dynamically imported Three chunk (736,440 decoded bytes) supports the actual viewer and is not treated as an unused dependency. No field-vitals failure or production-network performance score follows from local transfer sizes.

**B-10 — P3, semantic maintenance:** Work and Lab index cards go from h1 directly to h3 because the same card component also serves Home's h2 sections. Parameterize heading level in context, keeping labels, typography and IA. This is a semantic best-practice finding, not an unsupported blanket WCAG failure.

The raw audit's generic command suggestions include harden/adapt/typeset/optimize/polish. They are preserved unchanged as source report text; **none is evidence that those commands were invoked**. Main is restricted to /audit and /critique with authorized manual fixes. In particular, /harden and /polish are not invoked on main by this review.

## Cognitive load

The small portfolio indexes are easy to scan: one selected work item, three lab choices and familiar navigation. Five stable top-level links exceed a literal four-option checklist threshold, but this is not sufficient reason to change the locked IA.

S1 mobile has **three checklist failures: moderate cognitive load**. The synthesis completes the eight-item checklist while retaining A's failure count.

| Checklist item | Result | Observation |
|---|---|---|
| Single focus | Pass | The experiment remains the primary activity; no competing filters or unrelated tasks. |
| Chunking | Fail | Eight resistance contributions appear together as very small interactive layer labels. |
| Grouping | Pass | Visualization, resistance, parameters and explanatory notes form understandable sections. |
| Visual hierarchy | Pass, with legibility caveat | Temperature and geometry dominate appropriately; essential secondary information is too small. |
| One thing at a time | Pass | One active parameter panel avoids exposing every slider simultaneously. |
| Minimal choices | Fail | Five parameter tabs and eight layer selectors each form a decision set exceeding four visible options. |
| Working memory | Fail | Result/input separation makes the visitor remember values across scroll travel. |
| Progressive disclosure | Pass | Tabs, model choices and selectable layers reveal task-specific detail. |

Improve local feedback, category visibility and readable grouping. Do not delete meaningful engineering content or restructure navigation merely to reduce a mechanical option count.

## Emotional journey

Entry is calm and honest, but the placeholder shell undersells the work. S1 provides the peak: a physical model and a clear headline temperature. The mobile valley begins at the parameter controls, where the result disappears and the visitor encounters tiny notes, cramped controls and a clipped category. Keyboard-only visitors face an additional break when the scene cannot orbit or zoom. Load failure is reassuring because analytical results remain available. The ending offers responsible limitations and uncomplicated sample contact information, but those limitations need to be as comfortable to read as the result is easy to notice. Preserve the sample disclosure rather than manufacture confidence.

## Persona walkthroughs

**Sam — keyboard and accessibility-dependent visitor.** Sam opens the mobile menu, reaches navigation, closes it with Escape, changes labeled ranges, switches models and reveals email successfully in the recorded keyboard evidence. The path breaks when Cooler becomes selected outside the visible strip and when the viewer lacks keyboard orbit/zoom. The dark skip link and selected material text have measured contrast defects. A changed calculation is announced, but the threshold warning is omitted. Tiny supporting text and enlarged-text overlap burden low-vision use. These are keyboard/source/computed-style findings; no actual NVDA/VoiceOver speech session is claimed.

**Jordan — first-time visitor.** Home makes Work and Lab available and declares the sample nature of the site. Entering S1, the geometry and number offer a strong starting point. Jordan can miss the cooling parameters, overlook the small analytical-source qualifier and mistake the result's visual confidence for stronger validation than the existing text allows. The solution is readable placement of existing explanations and visible categories, not new claims or an invented audience brief.

**Casey — distracted mobile visitor.** Simple pages fit the viewport, locale routes preserve context, and contact is uncomplicated. In S1, Casey repeatedly scrolls between controls and results and must tap small model/reset/view controls precisely. Synthesized touch orbit, cancellation recovery, range changes and tab scrolling work; their success does not remove the effort caused by small targets and hidden feedback. Place result/warning near the active controls and expand hit areas. Actual device behavior, interruption persistence and slow-network use beyond captured FEM failure remain untested.

## Minor observations and rejected claims

- Normal-size document widths match their viewports in all 48 states. Local clipped tabs and enlarged-text overlap are still real issues.
- Sparse sample content and generous whitespace do not justify invented projects or factual embellishment.
- D1's orange accent, restrained panels and scientific data-encoding colors are intentional. They are not automatically anti-patterns because they are constants.
- The analytical/FEM switch works. Earlier Chinese output and selected-preset samples were recorded before queued state settled; B's follow-up supersedes those impressions.
- An earlier moving canvas hash does not prove keyboard orbit. Settled hashes and the actual handler support the missing-functionality finding.
- Reduced-motion handling keeps static final-state feedback; no blanket loss-of-feedback defect is established.
- An explicit FEM retry control could improve convenience, but the existing message already preserves analytical results and gives a retry suggestion.
- No numerical correctness conclusion is inferred from the temperature visualization. Numerical-model validation belongs to its separate evidence.

## Evidence, limitations and run accounting

The archive keeps original A/B/audit reports unchanged and copies raw JSON, the original relative-path capture scripts, four B contact sheets and selected actual baseline screenshots. [The manifest](evidence/manifest.json) records source-relative paths, byte sizes and SHA-256 hashes. Selected screenshots are a delivery subset; the JSON retains complete 48-state measurement coverage. No missing screenshot is represented as regenerated.

- **Stable target:** `portfolio-p3/src/components/lab/thermal-stack/ThermalStack.astro` plus the five shared routes listed above; the runtime URL was local port 4325.
- **Slug/storage:** no retained critique-storage slug or prior trend artifact is available to this synthesis. This requested report archive is written directly under `reports/v2/before/`; no storage-helper run or CLI-generated snapshot/trend is claimed.
- **Ignore list:** A reports `portfolio-p3/.impeccable/critique/ignore.md` absent.
- **Independence:** A and B recovery were separate agents; A was completed before synthesis read B/detector findings. No new inline replacement assessment was used.
- **CLI detector:** actual detector output was retained and reused as `[]`. Original invocation, exit code and scanned-file inventory were not preserved; those details remain unavailable. No rerun was performed for this synthesis.
- **Browser evidence:** existing custom Playwright matrices are the fallback. B added one isolated native Chrome follow-up to settle material-selection state, then closed that tab.
- **Overlay:** mutable preflight/injection and [Human] detector presentation were unavailable through the exposed native API. No overlay or detector console-clean claim is made.
- **Server/temporary artifacts:** this synthesis started no server, browser, or temporary capture. The baseline server on 4325 remains the coordinator's cleanup responsibility. Reports/evidence are deliberate retained artifacts.
- **Test limits:** Chromium evidence, mostly reduced motion, is not physical-device/Safari/Firefox testing. No assistive-technology speech session, exhaustive accessibility-engine run, full contrast inventory, production compression/network test, field vitals or full browser/OS 200% zoom assessment was performed in the recovery.
- **Validation separation:** before scores do not predict after scores. Later local checks, fixes and after measurements must be reported in their own artifacts. Hosted GitHub CI has not run; no external repository was supplied.

## Design considerations and authorized next action

The review retains three concrete design considerations: make one parameter change understandable without leaving the controls; make existing qualifications as readable as the headline is noticeable; and express the existing D1 system throughout the shell without changing any engineering claim or destination.

The user already authorized all high/medium fixes within those constraints. Carry the listed corrections into the coordinator's fix list, then validate the actual resulting implementation with /audit and /critique. Lower-priority semantic maintenance and any evidence-bound deferral remain explicit in the separate fix/deferred list.

Questions skipped: the user already authorized all high/medium fixes consistent with the locked D1 colors, fonts, IA and engineering text. This explicit task scope overrides the playbook's generic question gate; no new approval or design-direction choice is needed.
