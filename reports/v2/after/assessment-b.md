# Assessment B - after-fix detector and browser evidence

Method: independent dual-agent contribution B (/root/after_assessment_b). Assessment A's findings and report were not read in this context. The parent confirmed it completed reading A before B's findings were transmitted.

Status: initial after pass complete; two P2 findings sent to the coordinator. Their proposed fixes are not yet verified in this snapshot. A bounded closure addendum will preserve these original findings and record any verified resolution.

## Scope and provenance

- Source target: portfolio-main-v2/src/components; live review target: http://127.0.0.1:4326.
- Scope: Home, Work, Lab, About, Contact and S1 thermal page; Chinese and English; 1440 x 1000 and 390 x 844; light and dark.
- Impeccable repository: https://github.com/pbakaus/impeccable, pinned commit 2f98774f86bc05563876643db37e6c37c322850f.
- Skill version 4.5.2; bundled engine version 0.1.14.
- Only audit and critique playbooks were used. No redesign/refinement command was invoked and no product source was edited by B.
- Existing D1 tokens, Geist / Noto Sans SC / Geist Mono, information architecture and engineering copy remain the governing brief. Missing docs/DESIGN.md and docs/PRD are a reference gap, not permission to invent replacements.
- The first 48-state matrix began at 2026-10-14T13:37:45.415Z. It precedes the later extension of the result summary to desktop. That extension was independently checked in after-rebuilt-verification.json at 13:42:06 UTC.
- All recorded paths are relative. No operator account or absolute workspace path is needed in these deliverable-facing reports. If a coordinator makes shareable copies with path redaction, record that separately rather than silently changing scientific/UI measurements.

## Actual detector invocation

From portfolio-main-v2:

    impeccable.cmd detect --json src/components

Evidence: after-b-evidence/after-detector-metadata.json, after-detector-raw.json and after-detector-stderr.txt.

- Start: 2026-10-14T13:37:40.8212100Z.
- Exit code: 0.
- Raw findings: [].
- Finding count: 0. Rule names and finding file locations: none emitted.
- Target inventory: 29 files, including 16 Astro markup files, 11 TypeScript files, one CSS file and one license text file. The complete relative inventory is retained.
- The inventory is an independently recorded on-disk target count. The engine did not emit a parser coverage count. Do not call this "29 files successfully parsed" or a comprehensive accessibility proof.
- Markup-bearing directory was passed; this was not a CSS-only scan.
- Ignore list: portfolio-main-v2/.impeccable/critique/ignore.md absent.
- There are no emitted deterministic findings to classify as false positives. Manual browser findings below remain valid despite the empty detector list.

## Browser method and limits

A fresh native Chrome tab was created for B, separate from A, at the English S1 route. Its accessibility tree and screenshot were inspected. The supported CUA evaluate interface is explicitly read-only; no mutable title/script injection is available through it. Consequently no live detector overlay or human-visible overlay claim is made, and no Impeccable live-server was started. The isolated native tab was closed after inspection.

The user-authorized repository browser QA harness supplied repeatable evidence: Chromium 156.0.8078.4, headless, fresh isolated contexts, deviceScaleFactor 1, reduced motion for the matrix. Touch checks used a mobile context with hasTouch and Chromium CDP Input.dispatchTouchEvent. This is synthesized touch, not a physical-phone result. No NVDA/VoiceOver speech session was run. ARIA/live-region and focus evidence does not prove every screen-reader behavior.

Evidence files and scripts are intentionally retained for reproduction. No browser instance launched by these scripts remains running after its finally block. The existing preview server belongs to the coordinator; B did not start or stop it.

## Matrix result

after-b-evidence/after-browser-matrix.json and b-*.png contain all 48 requested route / language / viewport / theme states.

- 48 / 48 HTTP 200.
- No captured pageerror exceptions.
- No document horizontal overflow at the requested normal text sizes.
- One main and one h1 per state.
- Light shell: rgb(251,251,253) background and rgb(29,29,31) body text.
- Dark shell: rgb(0,0,0) background and rgb(245,245,247) body text.
- Home, Work, Lab, About and Contact now share the S1 theme and font system.
- Work/Lab index card headings are h2 under the page h1; Home retains h2 section / h3 card structure.
- The raw minimum-text probe flags text below 11 px; it found none. The separate source/test evidence sets the supporting thermal type floor at 12 px. These are distinct measurements.
- Four contact sheets cover all 40 non-S1 states. Full-resolution S1 captures and targeted screenshots cover the remaining states. B inspected the sheets, native desktop S1, and representative full-resolution S1 light/dark/mobile captures.

## Resolved issues verified in this pass

1. Dark skip-link contrast: 16.61:1 (light 16.83:1). Focus is visible; Enter focuses main.
2. Selected material preset contrast: 12.79:1 light and 10.68:1 dark after compositing the translucent selected background.
3. Supporting secondary text: 5.07:1 light and 7.03:1 dark in sampled source-node labels.
4. Canvas keyboard orbit and zoom now visibly change settled rendered pixels in both languages. The new focused camera tests additionally cover Home reset, bounds, reversal, Tab exit and no idle RAF; B independently checked changed pixels.
5. Native range ArrowRight changes P from 100 to 110 and the analytical result to 131.6 C.
6. FEM selection changes the model label and output after the actual recalculation; at P=110 default material the observed value was 119.6 C. The test waits after selection and does not mistake a pre-frame sample for failure.
7. Warning above 175 C is included in an aria-live=polite, aria-atomic=true result region. The sticky visible duplicate is aria-hidden=true to avoid duplicate announcements.
8. Mobile result and warning remain in view while changing controls. End on the tablist selects Cooler and scrolls it fully into the strip's bounds.
9. Text-only 200% scaling now leaves metrics, actions, the 380 px model viewport and legend in separate normal-flow blocks. There is no document overflow or overlap between those regions. Numeric wrapping still needs the fix below.
10. Keyboard menu opens, transfers focus to the navigation, closes on Escape and returns focus. Email reveal is keyboard-operable and focuses the revealed address.
11. All 12 language-switch routes preserve the equivalent page.
12. SVG fallback layer selection is keyboard-operable and exposes its fallback explanation.
13. Synthesized touch orbit changes pixels; another orbit still works after touchCancel; range tap changes P from 100 to 370; English tab-strip swipe changes scrollLeft from 0 to 111 with scrollWidth 435 and clientWidth 324.
14. After the coordinator's desktop-summary update, result and warning were visible at controls in both languages at 1440 and 390. See after-rebuilt-verification.json and b-rebuilt-summary-*.png.

## Remaining verified findings at initial after snapshot

### B-AFTER-1 [P2] Numeric values wrap internally under enlarged text

At 390 px with root font size 200%, 125.6 is split across two lines in both languages. English coolant 65 and convection coefficient 15000 split across two lines at both 390 and 1440. The line-count evidence uses per-character DOM ranges, not a screenshot impression. This does not currently erase the number, but separates digits in an engineering result and increases reading error risk.

Location: src/components/lab/thermal-stack/thermal.css, .thermal-temperature, .thermal-control-top and numeric output rules.

Evidence: b-text200-s1-en.png, b-sticky-text200-en-dark.png, after-rebuilt-verification.json, b-numeric-text200-*.png.

Recommendation: keep numbers as nonshrinking, nowrap units; permit surrounding label/value/unit groups to wrap as necessary. Preserve user font scaling, tokens and content. This is a remaining resize/usability gap, not a declaration that all of WCAG 1.4.4 fails.

### B-AFTER-2 [P2] Standalone portfolio action hit areas remain short

The English S1 card title is 25 px high on Home and 31 px high on Lab at 390 px. LinkedIn links in About and Contact are 21 px high. Chinese single-line card titles are similarly small. Thermal buttons and ranges now have comfortable 44 px height, so this is the remaining shared-shell exception.

Location: src/components/CaseCard.astro:17, LabCard.astro:20, AboutPage.astro:48, ContactPage.astro:26 and shared global.css.

Recommendation: expand the standalone card-heading and contact-link hit areas to at least 44 px while preserving their typography and role. Do not pad every inline prose link.

This is the audit's 44 px comfort/enhanced target heuristic. WCAG 2.2 AA SC 2.5.8 uses 24 px with spacing and other exceptions; these findings are not automatically AA violations. See https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html and https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html.

## Performance boundary

The font-face CSS generator is a material reduction: 17,833 bytes / 40 selected faces versus 210,548 bytes for both original full Noto stylesheets. It reuses the original locked font assets and regenerates from source text at build/dev time.

However, the initial browser resource sample still observes:
- zh Home: 25 WOFF2 requests, 787,924 decoded font bytes.
- zh S1: 26 WOFF2 requests, 812,052 decoded font bytes.
- en Home: 3 WOFF2 requests, 95,408 decoded font bytes.
- en S1: 4 WOFF2 requests, 118,536 decoded font bytes.
- Shared built CSS: 24,777 decoded bytes; S1 total CSS: 41,805 bytes.
- S1 script resources after the viewport-visible lazy viewer loads: 796,688 decoded bytes, including Three.

These are decoded localhost resource sizes, not compressed production transfer budgets or Lighthouse scores. The lazy viewer and on-demand renderer are appropriate. The required mobile Performance >=90 / Accessibility >=95 release gate remains a separate coordinator-run check. No Lighthouse run was made by B to avoid CPU contention. A small CSS file alone is not proof that the performance target has been met.

## Judgment for synthesis

Implementation integrity passes: the thermal page has domain-specific outputs, model limits and reversible controls; the shared shell now uses the existing D1 system. The empty detector result is consistent with no detected mechanical pattern, but it did not catch the two verified browser usability issues.

The after audit is 17/20 (Good) at this snapshot: accessibility 3, performance 3, theming 4, responsive design 3, integrity 4. Two P2 issues remain before their bounded closure check; no P0 or P1 issue was reproduced by B after the global-summary update. This is not a whole-site WCAG certification.

Questions skipped: the human already specified scope, fixed D1 direction and authorization to fix high/medium findings without waiting; the coordinator will synthesize A and B and deliver the requested artifact reports.



## Bounded final closure - 2026-10-14T13:55:48Z onward

Final audit score: **18/20, Excellent within the bounded review scope**. Accessibility 3/4; performance 3/4; theming 4/4; responsive design 4/4; implementation integrity 4/4. The original 17/20 snapshot above is deliberately retained so the additional findings and their resolution remain auditable.

Both initial P2 findings are now closed by independently observed behavior:
- **B-AFTER-1 closed.** The coordinator applied nowrap and no flex shrinking to numeric outputs and allowed their surrounding groups to wrap. At 200% text, values 125.6, 65 and 15000 each occupied exactly one per-character line position in all four language/width combinations (zh/en x 390/1440). CSS values are white-space:nowrap and flex-shrink:0. The enlarged label may flow above its value; the number stays intact. Evidence: after-b-evidence/after-final-verification.json and b-final-numeric-text200-*.png.
- **B-AFTER-2 closed.** Across 20 affected page states (Home/Work/Lab/About/Contact x zh/en x 390/1440), all 40 sampled standalone card-heading/contact links measured at least 44 x 44 CSS px. No document overflow in those states. Evidence: after-b-evidence/after-final-targets.json, b-final-targets-home-en-390.png and b-final-targets-contact-en-390.png.
- The result summary and >175 C warning remained visible at controls at 390 and 1440 in both languages after these fixes. Evidence: b-final-summary-*.png and after-final-verification.json.

Current reproduced UI issue count in B's bounded scope: P0 0, P1 0, P2 0, P3 0. This does not convert limited browser sampling into proof of absence across every platform. The final focused checks were light-theme geometry checks; the earlier full matrix and targeted contrast pass cover both themes, whose color tokens were unchanged by these final geometry fixes.

No full matrix was redundantly rerun. The original 48-state captures reflect the initial after build; b-rebuilt-* documents the later desktop-summary amendment; b-final-* documents the final numeric/target closure. Keep those capture stages distinct when packaging or summarizing.

The coordinator separately reported 41 browser tests and 45 unit tests plus lint, typecheck, build, privacy and gitleaks passing on the rebuilt source. B's independent closure is the evidence above; the coordinator's CI logs remain the authority for that full check run.

Lighthouse, physical-device testing and actual screen-reader speech output remain outside B's verification. In particular, the 18/20 score does not waive the separate mobile Performance >=90 / Accessibility >=95 gate.

Raw-output encoding note: after-detector-raw.json is the exact PowerShell-redirection UTF-16LE stdout with BOM. Metadata JSON is UTF-8 and browser-generated JSON is UTF-8. If making a UTF-8 delivery copy of raw detector stdout, declare the encoding normalization in provenance and preserve the original outside the package. No operator-path redaction was necessary in these relative-path evidence files.

Questions skipped: scope, fixed visual direction and authorization for these high/medium fixes were already supplied by the human.

