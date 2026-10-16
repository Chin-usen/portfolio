# BEFORE Assessment B — detector and browser evidence

Method: independent Assessment B for a dual-agent critique; original evidence collector /root/v3_before_b, completion reviewer /root/v3_before_b_finish. Assessment A output was not read. This is B evidence, not the combined critique.

Date: 2026-10-15. Stable target: frozen `portfolio-main-v2` (baseline supplied as commit `85fdb504e35ee480f43c98b0237f87ee866fb367`), specifically `src/components/HomePage.astro`, `src/components/lab/thermal-stack/ThermalStack.astro`, and their shared shell/styles. Preview: `http://127.0.0.1:4330`. No source file in v2 or v3 was changed by this assessment.

## Authority and scope

Read the pinned Impeccable SKILL.md and reference/audit.md and reference/critique.md. Pin independently confirmed by `git -C .dev-tools/impeccable rev-parse HEAD`: `2f98774f86bc05563876643db37e6c37c322850f`; bundled launcher VERSION: `0.1.14`. The coordinator already ran context once; it was not rerun. Only audit/critique evaluation was performed; no Taste or style/refinement command was run or recommended.

Compared source and saved screenshots with immutable `portfolio-main-v3/docs/DESIGN.md`, `docs/PRD.md`, and the D1 desktop/mobile and S1 desktop HTML/JPG references. Current user requirements override the old S1 stacked mock: top metrics, model on the left, parameters on the right at desktop. The 52 px header requirement overrides the mobile mock's 48 px. Career content must remain literal placeholders; this audit does not ask for real career claims or roadmap features beyond the current task.

## Deterministic detector

Invocation, executed by the original B collector at 2026-10-15T01:57:45Z:

```text
cwd: portfolio-main-v2
.dev-tools/skills/impeccable/scripts/impeccable.cmd detect --json src/components src/pages src/layouts
```

The launcher path is absolute in `evidence/detector-invocation.json`. The argument parser supports multiple positional paths. Recorded scope inventory: 33 markup files, individually hashed in that invocation record.

- Exit: **0**.
- Exact stdout: `[]` plus newline (3 bytes).
- Stderr: empty (0 bytes).
- Detector findings: **0**; rule names: none; reported file locations: none.
- Detector false positives: none, because no finding was emitted.
- Raw stdout SHA256: `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570`.
- An earlier quoting attempt exited **1**, stdout 0 bytes, stderr 189 bytes. It failed to invoke the launcher, not to inspect source. Its complete metadata/stderr remain in `launcher-quoting-failure.json` and `launcher-quoting-failure.stderr.raw.txt`. The corrected successful invocation above supersedes it.

A clean static detector does not establish visual fidelity, WCAG conformance, or runtime performance. It did not catch the manual findings below. The frozen baseline has no `.impeccable/critique/ignore.md`; no issues were suppressed. No detector rerun was necessary.

## Browser provenance and 16-state coverage

Reused the original independent B evidence after inspecting the scripts and JSON. The matrix is complete: 16 unique combinations = Home/S1 × zh/en × 1440/390 × light/dark. Each has its own full-page PNG. The four `b-sheet-{zh,en}-{1440,390}.png` contact sheets were visually inspected, covering all 16 states. Original individual PNGs remain available for full resolution.

Matrix engine: **Chromium 156.0.8078.4**, Playwright, headless, deviceScaleFactor 1, reducedMotion `reduce`; desktop 1440×1000 and mobile 390×844. Matrix contexts specify viewport dimensions but do not claim a physical phone. All 16 responses were HTTP 200; all 16 had exactly one main and one h1; document scrollWidth equalled viewport width; captured pageerror arrays were empty. These checks are not a whole-site audit.

The continuation also attempted a fresh native IAB tab; the harness returned `Browser is not available: iab`. Available Chrome was discovered, then a **new independent** Chrome tab `1585785875` was created, navigated to Home and English S1, and inspected via native screenshot/AX and read-only DOM geometry. Baseline was live. Native viewport was 1463×688, distinct from the required matrix. At that viewport S1 header measured 84.57 px, stage started at y=202.49, and parameters at y=763.26. This native spot check corroborates the stacked layout; exact 1440 measurements come from the saved matrix/targeted evidence.

Native browser API documentation explicitly restricts evaluate to read-only scope. Title/script mutation was therefore not attempted through an unsupported API. **No live detector server was started, no detect.js was injected, no user-visible overlay was created, and no browser detector console findings are claimed.** The fallback is native visual/AX inspection plus retained Playwright matrix and CLI scan. The native tab was closed. Playwright scripts close their browsers in finally blocks. The preview belongs to the coordinator and remains running for their controlled cleanup; B did not start another server. Evidence/scripts are intentionally retained, not disposable leftovers.

## Confirmed manual findings

| ID | Severity | Finding and concrete evidence |
|---|---|---|
| B01 | P1 | Home does not implement the fixed D1 composition. HomePage lines 25–56 contain text, a work list and LabCard list; no module hero, black metric section, or placeholder core numbers. Targeted geometry records zero hero img/canvas/svg, h1 48 px desktop / 32 px mobile versus the brief's 88/38. The shell remains about 85 px tall; English Home adds a language row at mobile. The D1 centered hero, name/menu shell, rounded Lab cards and contact footer are absent. |
| B02 | P1 | Home's S1 Lab card has no live temperature output or ceramic-thickness input. LabCard.astro lines 16–25 are a text/link card; all Home matrix entries have rangeCount 0. The required immediate input-to-Tj demonstration is not available on Home. |
| B03 | P1 | S1 desktop still stacks stage, resistance section, then parameters. At 1440 the stage is x144/y202.91/w1152/h490; parameters x144/y834.69/w1152. First power input is at y1139.33. This fails the current top-metrics + left-model/right-controls requirement. The sticky control summary is useful but does not provide simultaneous model/control viewing. |
| B04 | P2 | Shared Home links use `--thermal-accent` (orange) and default underlines; global.css:318–320. DESIGN.md requires separate blue link colors #0066CC / #2997FF. This is token-role/identity drift, not a demonstrated contrast failure. |
| B05 | P2 | The strict 44×44 project target rule is not fully met. Chinese S1 mobile Conditions tab is 39.984×44 px in both themes. Desktop nav links range from 25.33 to 43.77 px wide (height44). Skip link is 41.59 px high when focused. These are measured rectangles; see cautions below. |
| B06 | P2 | The frozen package still declares gsap3.15.0, and demos.ts:79 dynamically imports it. That conflicts with the current explicit removal requirement. No GSAP request was observed on Home/S1; do not call it current Home/S1 transfer bloat or make an independent license conclusion. |

Full locations, impact, priority and recommendations are in `audit.md`. Audit health: **13/20 (Acceptable, provisional technical evidence)**. This score judges the baseline against the newly supplied fixed brief, not against a prior release acceptance.

## Positive runtime evidence

`interactions.json` records successful zh/en mobile keyboard menu opening, first-nav focus, Escape closure/focus return, and four locale switches that preserve the route. Dark skip-link focus is visible and Enter focuses main. Tab End selects Cooler. Power ArrowRight changes100→110W and updates Tj125.6→131.6°C. FEM switching updates the result; view orbit/zoom changes canvas hashes. Forced `?renderer=2d` keyboard selection chooses the AMB panel and exposes fallback guidance.

Synthesized touch was explicitly exercised in an isMobile/hasTouch Chromium context using CDP dispatchTouchEvent: orbit changed pixels, orbit still worked after touchCancel, a touch tap changed power100→370W, and swiping the overflow tab strip moved scrollLeft0→111 (scrollWidth435/clientWidth324). These are emulated Chromium checks, not physical-device or Safari/Firefox claims.

`targeted-evidence.json` records FEM default114.7°C and500W producing313.3°C, visible warning, and matching localized live text. The explanatory copy distinguishes analytic source-node estimates, FEM surrogate errors, development-inspected holdout, lack of independent/experimental validation, and reconstructed rather than complete3D fields. Scientific accuracy was not recomputed by B.

## False-positive handling and evidence limits

- Geometry textContent includes hidden warning text at default125.6°C and hidden selection-card text. Native AX, screenshot and visible-height check confirm the default warning is **not visible**. This is not an erroneous warning defect.
- The script's small-target heuristic includes an offscreen skip link. Its41.59px height is a project-target exception, not an inaccessible keyboard path. Closed mobile nav links were not counted as visible.
- 44×44 is the project's stricter requirement. These measurements alone do not prove a WCAG2.2 AA24×24 target-size failure; do not label every sub44 target a WCAG AA violation.
- Sampled token contrast: light secondary/background4.91, light accent/background4.91, dark secondary/card7.03, dark accent/card8.92; primary text16.28–19.29. This is token sampling, not exhaustive composited-text/UI contrast certification.
- Four720px captures demonstrate narrow reflow only. The script changes viewport from390 to720 and does **not** set browser zoom or text scale. Thus200% text resizing remains untested by B.
- No fresh Lighthouse, LCP, throttled mobile, frame-time, screen-reader, physical touch or cross-engine run was performed. No current PRD performance threshold pass is claimed. Performance resource data are localhost uncompressed/transferred observations, not production gzip sizes.
- Source inspection found on-demand rendering, visibility pause, reduced-motion handling, IntersectionObserver/dynamic viewer load, and deferred FEM load. The matrix's reducedMotion setting does not prove all transition behavior.
- Home Chinese resource totals820629 transfer bytes vs121513 English, and S1 Chinese1661465 vs961349 English; font subsets and736440 decoded bytes of Three account for much of the difference. These are budget observations, not proof of a Lighthouse failure.
- Target slug/persistence of the combined critique is owned by the coordinator. B did not invent a slug or alter critique storage. Independence is retained across B completion; A artifacts were not consumed.

Evidence index: `evidence/detector-invocation.json`, `detector.stdout.raw.json`, `detector.stderr.raw.txt`, `browser-matrix.json`, `interactions.json`, `targeted-evidence.json`, 16 state PNGs, 4 contact sheets, focused skip-link PNGs and4 reflow-proxy PNGs. Reproduction scripts: detect.cjs, matrix.cjs, interactions.cjs, targeted.cjs, contact-sheets.py.

Questions skipped: the current brief already specifies the target and authorized reconstruction; B is an evidence input to the coordinator's critique, not a request to choose another aesthetic.
