Method: independent Assessment A within a dual-agent critique (A: /root/after_assessment_a; Assessment B remains unread).

# After Assessment A — portfolio main v2

## Review boundary and evidence

Reviewed source target `portfolio-main-v2/src/components` and the running v2 build at `http://127.0.0.1:4326`. This is an unanchored visual/design review of the state captured by this assessment, before the targeted follow-up recorded below. I did not read the after detector output or Assessment B report. The parent supplied the authorized scope and a statement that 45 unit and 38 browser tests passed; those counts are context, not proof of every design property evaluated here.

The user fixes the main direction: D1 minimal light, incumbent color tokens, Geist / Noto Sans SC / Geist Mono, existing information architecture, and engineering copy. Dark mode must remain usable. Main work permits audit and critique only; this assessment invokes neither a redesign nor any other refinement command. `docs/DESIGN.md` and `docs/PRD` were reported absent in the source/workspace. I therefore judge against the explicit brief and incumbent source, without inventing missing documentation or claiming full conformance to unavailable references.

The review uses Experience/Read for the portfolio pages and Operate/Read for S1. All ten heuristics apply to this combined scope because S1 is an interactive engineering tool.

Fresh evidence in `after-assessment-a-evidence/`:

- 48 full-page screenshots: Home, Work, Lab, About, Contact and S1 × zh/en × 1440×1000 / 390×844 × light/dark.
- `matrix.json`: route, dimensions, font family, background, headings and visible control bounds for every state.
- Eight `sheet-*.png` contact sheets, used for cross-page composition comparison. These are reduced previews; native-size images are the legibility evidence.
- `interaction-notes.json` plus mobile menu, email reveal, maximum power, Cooler tab and failed model-load checks/captures.
- `desktop-feedback.json` and `en-s1-1440-power-max-viewport.png`: focused confirmation of A-AFTER-01 at the exact requested desktop width.
- A fresh native Chrome tab was also used for live Home and desktop S1 inspection. The native viewport was 1463×688 for its interaction check; the independent QA harness provides the exact requested dimensions. No detector overlay was used by A.

Capture harnesses are `after-assessment-a-capture.cjs`, `after-assessment-a-interactions.cjs` and `after-assessment-a-desktop.cjs`. The existing project Playwright QA harness was adapted for the authorized matrix; no product source was edited by A. All 48 captured documents have scrollWidth equal to the requested viewport width. This is a bounded rendered-state check, not a claim that all possible content or device configurations are overflow-free.

## Design specificity verdict

The strongest product-specific element is the S1 thermal model: the layered AMB object, source-node temperature, explicit thermal resistance, parameter groups and model disclosures are grounded in an engineering problem. The quiet surfaces and measured type fit the evidence-first voice. The portfolio shell remains a conventional typographic index of work; it could support another technical professional with different content. That is a limitation of the intentionally restrained incumbent identity, not permission to replace it during this main refinement.

The shared light background, orange action color, dark counterpart and font stack now read as one family across the six surfaces. The source metrics and model colors have a clear informational role. I would retain them, including the prominent temperature and existing cards, instead of applying generic anti-pattern bans against the user's brief. The principal remaining design problem is functional: desktop parameter changes still separate the response from the control.

## Design health score — captured state before targeted follow-up

| # | Heuristic | Score / 4 | Assessment |
|---|---|---:|---|
| 1 | Visibility of system status | 2 | Mobile local result/warning is effective; desktop result and warning leave the viewport when the primary input receives focus. FEM failure feedback is explicit. |
| 2 | Match between system and real world | 3 | Layer ordering, units and material names fit the engineering task. The scope/idealizations are unusually candid; first-time users still need to read the lower model notes. |
| 3 | User control and freedom | 4 | Restore defaults, reset view, independent model selection, keyboard tabs, menu Escape and safe analytical fallback give direct exits from the reviewed states. |
| 4 | Consistency and standards | 3 | Theme and fonts carry through all routes. Thermal header scale differs from the portfolio header; the English mobile language row wraps differently, but without loss of function. |
| 5 | Error prevention | 3 | Bounded sliders, units, presets and visible model distinctions constrain mistakes. The warning threshold remains an illustrative reference, as the copy explains; desktop visibility still needs correction. |
| 6 | Recognition rather than recall | 2 | Parameters have labels/units and mobile live context. Desktop forces users to remember or scroll back to the numerical result after changing a slider. |
| 7 | Flexibility and efficiency | 3 | Keyboard tabs, range controls, view keys and reset paths support repeated exploration. Exact values still rely on slider/keyboard stepping rather than direct numeric entry. |
| 8 | Aesthetic and minimalist design | 3 | Strong hierarchy, restrained palette, uncluttered navigation and readable lists. The long mobile S1 sequence is a considered tradeoff rather than a tightly compact instrument. |
| 9 | Help users recognize, diagnose and recover from errors | 4 | An intentionally aborted FEM load keeps the analytical result active and explains both failure and retry; reset behavior is explicit. No fatal state was observed in this bounded check. |
| 10 | Help and documentation | 3 | Localized interaction instructions, units, model status, assumptions and validation disclosures are available. Dense explanatory notes are below the controls, so a novice must deliberately read them. |
| **Total** | | **30 / 40** | **Usable and substantially coherent, with one material desktop feedback issue.** |

These are heuristic judgments, not accessibility certification or a numerical model validation score. A high score in a narrow error-recovery flow does not substitute for complete browser or assistive-technology testing.

## What is working

1. **The mobile parameter loop is now understandable in place.** In the 390px maximum-power capture, the focused 500 W input is visible together with junction temperature 367.8 °C, resistance 0.606 K/W, model name and the 175 °C reference warning. The repeated visual summary is intentionally aria-hidden while a separate live region serves announcements. The old visual memory bridge is removed on this breakpoint without duplicating screen-reader output.
2. **The cross-page system is visibly coherent.** All 48 states report the same Geist/Noto fallback family and expected D1 light/dark background. Long English headings and Chinese content reflow without page-level horizontal overflow. Index pages use direct text links and clear heading hierarchy; there is no extra promotional copy obscuring the work.
3. **The interface states explain their limits.** Analytical and FEM options are explicit; analytical illustration is not presented as a validated local FEM field. Failed FEM loading leaves a meaningful analytical result and a useful retry explanation. Contact makes the fictional/sample status clear, and reveal-email moves focus to the revealed address.

## Priority issues

### A-AFTER-01 — P1: desktop parameter changes hide the result and threshold warning

**Where:** S1, desktop, both the result placement and `.thermal-control-summary` visibility rule in `src/components/lab/thermal-stack/thermal.css`.

**Evidence:** At 1440×1000, focus Chip power and press End. The input changes from 100 to 500 W and the result becomes 367.8 °C. The browser scrolls to keep the input visible at y=489.3–533.3. The primary result is at y=−315.8 to −247.0, and the threshold warning is at y=−139.4 to −103.4. The summary already contains the right values but is `display:none`. The native live inspection independently reproduced the same failure at a shorter desktop viewport. See `desktop-feedback.json` and `en-s1-1440-power-max-viewport.png`.

**Why it matters:** This is the central operate flow. A sighted user changes an input but cannot see its result or the warning without leaving the control. Screen-reader announcements do not solve the visual feedback gap. Crossing the displayed threshold makes the omission more consequential than a minor spacing issue.

**Fix:** Show the existing result/model/warning summary beside or immediately above the parameters at desktop widths too. Reuse its current text, data updates, theme tokens and aria-hidden/live-region structure. Keep the existing large stage metric. Verify normal and high-power states at 1440px and 390px, including text enlargement, without introducing overlapping sticky content.

**Suggested command:** `/audit` to verify the scoped manual correction, then `/critique` confirmation. No broader refinement command is required or authorized for main.

### A-AFTER-02 — P3: English mobile tab continuation still requires discovery

**Where:** S1 parameter tabs, 390px English.

**Evidence:** The strip has clientWidth 324px and scrollWidth 435px. Initial content shows Conditions, Top solder, AMB substrate and a partial Bottom solder; Cooler begins beyond the initial right edge. A thin scrollbar exists. Keyboard End selects Cooler and brings it into view; the reviewed flow is functional.

**Why it matters:** A first-time touch user may initially perceive only the exposed groups. This is a discoverability refinement, not an inaccessible or trapped control: visible clipping, scroll affordance and keyboard selection now communicate/recover the continuation.

**Fix:** Retain the working scrolling strip for this scope. If future usability observation shows missed groups, add a restrained continuation affordance or use a compact group chooser, without altering the five existing groups. Do not make a speculative IA change merely to remove this P3 note.

**Suggested command:** `/critique` with observed users or `/audit` for the current tab interaction. Other commands were not invoked.

### A-AFTER-03 — P3: exact-value experiments are slower with range-only controls

**Where:** S1 numeric parameter inputs.

**Evidence:** The operating panel exposes labelled range sliders and numerical outputs. Keyboard controls and native range bounds work, but there is no direct numeric-entry affordance in the reviewed UI.

**Why it matters:** A power user reproducing several precise operating points must step or scrub to a value. This is acceptable for an exploratory portfolio lab, less efficient for a production analysis tool.

**Fix:** Defer unless the product role expands to repeated numerical work. If authorized later, pair each slider with a validated numeric input sharing its bounds, step and accessible label. Preserve current units and all computational boundaries. Do not expand the present task's IA based on this optional opportunity.

**Suggested command:** `/critique` to validate the need; the current main task does not require a new input pattern.

### A-AFTER-04 — P3: mobile S1 introduces a long path before the first input

**Where:** S1 mobile sequence: heading, primary metric, actions, 380px model viewport, scale, resistance explanation, then parameter card.

**Evidence:** The full English mobile document is 2609px high and Chinese is 2331px in the reviewed default state. The metric and model have ample room and no observed overlap. Their combined height means several scroll gestures precede the first parameter interaction.

**Why it matters:** A returning user coming to adjust inputs pays the cost of the demonstration-first presentation. A first-time portfolio visitor benefits from seeing the actual artifact. Both roles are plausible; the user has fixed the current IA and visual direction.

**Fix:** Preserve this ordering for main. If repeat use becomes a demonstrated need, add a localized in-page jump to the existing parameter heading rather than shrinking the model into illegibility or removing disclosures. This is an optional future efficiency improvement, not a current delivery blocker.

**Suggested command:** `/critique`; no additional main command was invoked.

## Cognitive load

| Checklist item | Finding |
|---|---|
| Chunking | Pass with domain exception. Portfolio work/lab groups are small. Operating controls show three parameters. AMB contains five related values, a meaningful physical grouping rather than arbitrary menu overload. |
| Grouping | Pass. Stage, resistance, parameter card and model disclosures have distinct regions and consistent proximity. |
| Visual hierarchy | Pass. Tj leads S1; headings and linked project titles lead the portfolio. |
| One thing at a time | Pass. The selected parameter tab reveals its corresponding control set; inactive panels are hidden. |
| Minimal choices | Qualified failure at S1: five parameter groups and eight layer/convection legend selectors exceed a literal four-choice checklist. The legend is an ordered physical stack, and the tabs group real parts; reducing either just to satisfy a count would damage the task. |
| Working memory | Fail on desktop in the captured state: output/warning are offscreen during input adjustment. Pass for the reviewed mobile summary state. |
| Progressive disclosure | Pass. Model option, tab panels, email reveal and selectable layer details avoid presenting every secondary action at once. |

The captured S1 state has two checklist concerns, hence moderate cognitive load under the playbook. The desktop feedback correction would remove the actionable failure; the remaining physical-group choice count is a deliberate domain tradeoff. Portfolio indexes are low load: choosing one work item or one of three lab notes is clear. Five primary navigation destinations follow a familiar portfolio structure and are not a reason to add a menu hierarchy.

## Emotional journey

The Home introduction is calm and credible: it promises traceable reasoning, then provides selected work and lab entries. The visual peak is S1's AMB object tied to quantitative output. Mobile now sustains that confidence while changing power because the result and warning stay at hand. The remaining desktop valley occurs precisely at the same high-stakes interaction, when the screen stops showing the output. The FEM failure path recovers well: it explains what failed, keeps the analytical result and avoids a dead canvas. The ending is candid rather than promotional, with clear model assumptions and validation boundaries. These notes belong in the product and should remain even though they add mobile length.

## Persona red flags

### Sam — keyboard and low-vision user

The menu opens with Enter, focuses the first Home item on Tab, and closes with Escape. Thermal tab End selects Cooler; controls expose labels and visible focus. Model-failure status is present. The local technical text sampled in the mobile review is 12px for node/legend/scale/range labels and 44px tall for view buttons; that is an improvement, but small supporting text still needs user zoom. A has not independently run a screen reader or the complete 200% matrix; the parent's targeted regression tests are separate evidence. Sam's sighted keyboard workflow hits A-AFTER-01 on desktop, since focusing a range scrolls away from the visual result.

### Casey — interrupted mobile visitor

The main pages have direct links, a working labelled menu and readable reflow. Contact reveal focuses the address, reducing hunt time. S1 at 390px now displays the result/warning with the power slider, avoiding repeated trips to the model. Remaining red flags are modest: the hidden continuation of the English tab strip requires exploration, and the first input is several scrolls below the beginning. The review is desktop Chromium emulation, not a claim about one-handed hardware use or real mobile browser performance.

### Alex — engineering power user

Parameter grouping and units are immediately usable. Restore defaults returns 500 W to 100 W and 125.6 °C in the tested analytical state; a failed FEM request preserves that usable state. The principal efficiency defect is desktop result separation. The optional range-only exact-entry limitation remains. The documented model boundaries are a strength for this persona: the interface distinguishes illustrative analytical fields and trained numerical results instead of claiming experimental validation.

No project-specific persona is invented from unavailable Design Context files.

## Minor observations and scope decisions

- The English 390px portfolio header puts language links on a second row; the smaller S1 header fits them on the first. Both are legible and actionable. Uniform wrapping would be a cosmetic refinement and is not a reason to alter the established thermal header rules.
- Primary links remain underlined and recognizable. The warm action color and thermal scientific palette have different roles; the multicolor thermal plot is not gratuitous decoration.
- Dense engineering labels are still visually subordinate. Keep any future type enlargement proportional to the model/parameter hierarchy rather than flattening all text to the same size.
- The single sample work case and sample Contact details limit real-world persuasion. They are deliberate fictional content; inventing credentials, case results or contact details would be wrong.
- The absence of the named design/PRD references remains an evidence boundary. It is not repaired by generating replacement authority.
- No performance, Lighthouse or numerical accuracy claim is made from screenshots. Those gates belong to separate recorded validation.

## Questions to consider in a future product decision

- Is S1 primarily an artifact to explore once, or an instrument people return to for repeated comparisons?
- If repeat use matters, which exact input/output pair should be visible without scrolling at every supported viewport?
- Would a direct link to the parameter section serve that repeat use better than making the engineering object smaller?

Questions skipped: the user already fixed the main direction and authorized completing high/medium fixes without another scope-confirmation round. These are archived future product considerations, not pending questions or permission gates.

## Assessment status

Initial independent assessment complete. A-AFTER-01 is an observed P1 in the captured build; the parent was notified with exact evidence and can make the authorized scoped fix. A will record a bounded follow-up separately after that build is available, preserving this original observation rather than rewriting history. No after Assessment B or detector content has been read.

## Bounded follow-up 1 — desktop feedback correction

The parent exposed the rebuilt all-viewport summary on port 4326 after A-AFTER-01. I ran one focused confirmation batch, saving new evidence under `after-assessment-a-evidence/followup/` and preserving all original captures.

All ten high-power cases show both the complete result/warning summary and the focused power control in the viewport without overlap: zh/en × light/dark at 1440×1000 and 390×844, plus English light at 1440×688 and 390×844 with root text enlarged to 200%. Every case has page scrollWidth equal to the viewport width. At English 1440×1000, the summary is y=206.7–292.2 and the input y=512.8–556.8. At 1440×688 the summary is y=39.7–125.2 and input y=345.8–389.8. The output remains 367.8 °C and 0.606 K/W with the threshold warning visible.

**A-AFTER-01 status: resolved and independently confirmed.** The original large stage result remains; the repeated control summary supplies the local feedback the desktop flow lacked. Evidence: `followup/confirmation.json` and the corresponding ten viewport screenshots. This closes the actionable desktop working-memory failure and supports raising heuristics 1 and 6 from 2 to 3 after the final follow-up below.

### A-AFTER-05 — P2: numeric output strings split when text is enlarged to 200%

The focused follow-up exposed a separate readability issue in the English 390px enlarged-text state. The numerical output for coolant temperature 65 breaks into two lines, 6 and 5. Convection coefficient 15000 also fragments because the output flex item shrinks alongside the long label and inherits anywhere wrapping. The number is mathematically unchanged, but its visual integrity is lost precisely for a user enlarging text. See `followup/en-390-844-light-text200.png`.

**Fix:** Keep `.thermal-control-top output` unbroken and non-shrinking; allow the label to wrap into the remaining space. Verify 65 and 15000, plus parameter values in the other tabs, without introducing horizontal overflow. This is a small manual accessibility refinement inside the fixed main scope. Suggested command: `/audit` for the targeted confirmation; no broader refinement command is needed.

The parent was notified before finalizing this assessment. This new P2 was found by visually reading the screenshot, not by importing Assessment B or detector findings. The final score is recorded after its bounded confirmation below.

## Bounded follow-up 2 — intact scientific values at enlarged text

After the parent applied the numeric non-wrapping correction, a targeted batch checked 390px and 1440px, zh/en, light/dark, at 200% root text size. Across the five parameter tabs this produced 40 panel observations and 112 numerical outputs. Every output remained on a single text line and inside the viewport. The eight corresponding primary Tj observations all retained the complete value 125.6 on one line within viewport bounds. Every observed page width matched its viewport. Default coolant 65 and convection 15000 are clearly legible as whole numbers in the new mobile and desktop operating-panel captures.

**A-AFTER-05 status: resolved and independently confirmed.** Evidence is `numeric-followup/confirmation.json`, with enlarged-text operating/AMB/Cooler captures and primary-metric crops. The earlier fragmented-number screenshot remains untouched in `followup/`.

### A-AFTER-06 — P1: enlarged desktop scale overlaps the primary scientific readout

The parent explicitly requested primary Tj confirmation at desktop 200% text as part of this follow-up. The number itself is now intact, but visually inspecting its crop exposed a different fixed-stage collision. At English 1440×1000 and 200% root text, the stage remains 490px high. Its metric group occupies y=358.6–702.6, while the absolutely positioned temperature scale occupies y=507.7–793.6 at the same left edge. The palette crosses the equivalent-source-node text, and its thickness-direction note crosses the Rth group. The resulting readout is not reliably legible for the enlarged-text user. Mobile 200% has the expected flow layout and is clean in the matching crop.

Evidence: `numeric-followup/en-1440-light-primary-metric-text200.png`, `en-1440-light-full-stage-text200.png`, and `desktop-stage-collision.json`.

**Fix:** Give the desktop stage enough block space for enlarged metric and scale content, or place those groups in non-overlapping flow while retaining the same visual hierarchy. Preserve values, units, model, tokens and copy. Verify both languages/themes and a selected layer card at 200%, since that state also adds stage content. A conservative responsive reflow is preferable to clipping or reducing the user's requested text size. Suggested command: `/audit` for the targeted correction and visual `/critique` confirmation; no new aesthetic direction is required.

The parent was notified promptly with the screenshot and geometry. This is an observed accessibility blocker, not a speculative extra polishing pass; the final score/status remains pending its targeted correction. No detector or Assessment B finding was imported into this assessment.

A-AFTER-06 selected-state confirmation: at the same 1440px/200% setting, choosing Ceramic makes the fixed-width layer card 871.5px tall inside the 490px stage. Its top is −76.8 while the stage begins at 330.6, so the stage clips its upper content and its remaining text crosses the view-action area. This is the same fixed-layout root cause and is included in the required correction, not a separate aesthetic request. See `numeric-followup/desktop-selected-stage-collision.json` and `en-1440-light-selected-stage-text200.png`.

A-AFTER-06 first grid correction: the rebuilt desktop stage contains the metric, scale, view actions and selected card without those groups colliding. The targeted confirmation caught one remaining interaction-hint collision in the selected Chinese 200% state: the bottom-center hint overlaps the layer card by 95.55 × 37.39px. The parent anticipated this risk and was notified; moving that existing hint into a dedicated grid row closes the same stage-layout finding. The partial diagnostic batch is preserved as `stage-followup/initial-hint-overlap.json`; it is not represented as a pass. Mobile 200% default/selected configurations completed before this failure and had no group collisions.

## Bounded follow-up 3 — final stage reflow confirmation

The final rebuilt stage was verified independently at port 4326 using the preserved `after-assessment-a-stage-followup.cjs` harness. This recovery continuation is `/root/final_a_stage_recovery`; it read the original A report and A evidence only. No Assessment B or detector findings were read or imported. The earlier assessment and failed intermediate evidence remain unchanged above and in their original files.

The completed batch covers **24 stage states**: zh/en × light/dark × default/Ceramic-selected at 390×844 and 1440×1000 with root text enlarged to 200% (16 states), plus both languages/themes and both selection states at 1440×1000 with normal text (8 states). Every visible metric, temperature scale, view-action group, selected layer card and interaction hint is contained within the stage. No pair of these visible groups overlaps by more than the harness's 1px rounding tolerance. All 24 page widths equal their requested viewport widths. The hint is hidden in the mobile layout; the containment check applies to visible groups.

The enlarged desktop stage now grows to its content: Chinese default 742.5px, English default 819.3px, and both selected states 867.3px. At normal desktop text it retains 490px for the default state, growing to 494.9px Chinese or 552.4px English when the selected card needs space. This is an explicit reflow tradeoff, preserving the existing scientific values, palette and copy rather than clipping enlarged content.

Visual inspection of the new English light and Chinese dark 200% selected-stage screenshots confirms the complete 125.6 °C metric, Rth/ΔT, temperature scale, material-card values and bottom interaction hint remain readable and separate. The English 390px 200% selected capture also keeps values intact in a vertical flow; its increased height is expected for enlarged text. The normal English desktop selected capture retains the incumbent model-first composition. This is a bounded Chromium/root-text-enlargement check, not certification for all browser zoom modes, assistive technologies or physical devices.

**A-AFTER-06 status: resolved and independently confirmed, including its intermediate interaction-hint collision.** Evidence: `stage-followup/confirmation.json` contains the complete 24-state geometry, and `stage-followup/*-selected.png` contains nine representative final captures. The harness returned exit code 0 and reported `allNonoverlapping`, `allWithinStage` and `allPageWidthsMatchViewport` as true. `stage-followup/initial-hint-overlap.json` remains the preserved failed intermediate diagnostic.

## Final independent A judgment

**Final design health: 32 / 40.** Heuristics 1 (system status) and 6 (recognition rather than recall) each rise from 2 to 3 after the local result/warning summary correction. The other eight scores remain unchanged: 3, 4, 3, 3, 3, 3, 4 and 3 in their original heuristic order. The score does not imply perfection: domain complexity, conventional portfolio identity and repeat-use efficiency remain qualified limitations.

All observed actionable P1/P2 findings in this assessment are closed: A-AFTER-01 desktop feedback, A-AFTER-05 fragmented numbers, and A-AFTER-06 enlarged-stage collisions. The three P3 opportunities A-AFTER-02 through A-AFTER-04 remain intentionally deferred under the fixed main scope: tab continuation discoverability, direct numeric entry, and a shorter path to mobile controls. The physical-group choice count remains a domain tradeoff rather than a reason to alter the information architecture. The portfolio and S1 now sustain the result/control loop at the reviewed widths without the observed high/medium defects.

Performance, numerical-model accuracy, hosted CI execution and unavailable design-reference conformance remain outside this visual judgment and must be stated from their own evidence. Final independent A assessment complete; no new source edits were made by this reviewer.
