# AFTER Assessment A — Phase 1 preparation

Status: source/reference review complete; browser capture intentionally NOT started while root runs Lighthouse. No scores assigned before visual inspection.

## Independent scope
- Target: portfolio-main-v3/src/components/HomePage.astro and src/components/lab/thermal-stack/ThermalStack.astro, with their current CSS, Header, BaseLayout, client and copy dependencies.
- Fixed brief governs. S1 top metrics + LEFT model / RIGHT parameters at desktop overrides the stacked S1 reference. Home keeps 52 px nav, 88/38 px title, blue CTA, three-terminal static hero, black career placeholders, 28 px Lab cards and live analytical Tj/ceramic slider.
- Both locales, both themes, 1440 px and 390 px; keyboard, 200% reflow, 44 px controls.
- Read critique.md guidance and immutable docs/DESIGN.md, PRD.md, design/README.md, all D1/S1 HTML and all three JPG references.
- No prior A/B reports, before/after findings or detector outputs read. Only the permitted prior capture.cjs script was read to adapt paths and capture mechanics. No detector executed.
- .impeccable/critique/ignore.md does not exist at the working root.
- No production source edits. Root owns preview port 4337, PID 31276; do not stop it.

## Structure reserved for final assessment
1. Evidence provenance and applicability limits.
2. Design specificity and fixed-brief fidelity, with a source/reference/observed matrix.
3. All 10 Nielsen heuristics (0–4 each), scores only after capture/inspection; S1 makes efficiency and help applicable.
4. Cognitive-load checklist: all eight items, explicit decision sets >4 choices, Home versus S1 distinction.
5. Emotional journey, 2–3 strengths, 3–5 priority issues if supported (no invented quota).
6. Personas: first-time recruiter/Jordan; keyboard/low-vision technical reviewer/Sam; mobile visitor/Casey. Product audience derived from PRD, not invented profile.
7. Minor observations, constrained next-step questions if useful, and evidence limitations.

## Source-supported items to verify visually (unscored)
- Home source explicitly uses semantic content, two blue CTA links, static picture variants, 28 px cards, real evaluator-driven Tj plus native ceramic range with change announcements.
- S1 source places metrics in document flow above a 1.45:1 desktop workspace, stage left and parameters right, changing to stacked below 56 rem. This is intentional brief compliance, not reference drift.
- Parameter groups are five tabs; heat-resistance legend exposes eight selectable categories. Need observe whether visual grouping and progressive disclosure make these manageable.
- Two model choices, restore defaults, three view buttons, stage legend, layer card, input readouts, validation copy: judge actual competing attention and mobile memory burden after rendering.
- Header uses accessible mobile toggle, Escape and focusout close behavior, route-preserving locale link. Need inspect mobile menu and language discovery.
- Analytical versus FEM-surrogate labels and disclosures exist; test actual activation, error/status visibility and 175 C threshold state without assessing scientific validity beyond the displayed boundaries.
- Native range sliders and 44 px minima are declared. Need measure visible controls, keyboard operability, focus and 200% reflow rather than infer a pass from CSS.

## Phase 2 capture and inspection plan
- Wait for explicit root clearance. First open a fresh native Chrome tab via available browser UI, read-only visual inspection; no overlay/injection claim.
- Then run .p1-tools/node_modules/node/bin/node.exe .dev-tools/v3-after-a/capture.cjs with approved write/browser execution.
- Capture 16 full-page images (Home/S1 x zh/en x 1440/390 x light/dark), plus top and useful section crops. Open and inspect every full-page image. Geometry JSON is manual browser evidence, not the detector.
- Supplemental focused checks: home ceramic slider, S1 parameter/reset/material/model actions, keyboard tab sequence/menu, high-temperature feedback, equivalent 200% layout and native zoom if exposed. Distinguish tests actually run from source-derived expectations.
- Record exceptions and exact limitations; do not claim screen-reader, all browsers, real device touch, or scientific validation from this inspection.
