# After evidence guide

The [manifest](manifest.json) maps every copied file from its original relative source to its archive path and records byte count and SHA-256. All three raw reports are complete and byte-identical. Copied JSON, scripts and screenshots are unchanged. This archive adds its own synthesis and guide; it does not edit earlier observations into passing results.

## Capture stages

| Stage | Archive evidence | Meaning |
|---|---|---|
| Initial after matrix | `assessment-a-evidence/matrix.json`, `assessment-b-evidence/after-browser-matrix.json`, four `b-sheet-*.png` sheets and representative S1 images | Independent A/B captures of the same 48 route/language/width/theme states. The initial build predates later desktop-summary, numeric/target and desktop-stage corrections. |
| A desktop feedback failure | `assessment-a-evidence/desktop-feedback.json`, `en-s1-1440-power-max-viewport.png` | Preserved original P1 observation. |
| Desktop summary closure | `assessment-a-evidence/followup/confirmation.json`, two desktop viewport images; B `after-rebuilt-verification.json` | A's ten cases and B's four cases verify visible result/warning at the controls. The A mobile text200 image also preserves the subsequently found split number. |
| Enlarged numeric closure | `assessment-a-evidence/numeric-followup/confirmation.json`; B `after-final-verification.json` and four `b-final-numeric-text200-*.png` | A observes 40 parameter panels / 112 numeric outputs and eight intact Tj values; B independently checks the critical numbers in four language/width states. |
| Standalone target closure | `assessment-b-evidence/after-final-targets.json`, two `b-final-targets-*.png` | Twenty affected page states / forty sampled standalone links measure at least 44 x 44 CSS px. |
| Desktop stage collision | A `numeric-followup/desktop-stage-collision.json`, `desktop-selected-stage-collision.json` and three metric/stage screenshots | Preserved later P1, after the numbers were made intact. It was found by A, not retroactively attributed to B. |
| Intermediate hint collision | A `stage-followup/initial-hint-overlap.json` | Failed intermediate selected-stage diagnostic, explicitly not a pass. |
| Final stage closure | A `stage-followup/confirmation.json` and nine `*-selected.png` images | Twenty-four states: bilingual, light/dark, selected/default, 200% at both widths plus normal desktop. All groups fit and do not overlap beyond 1 px tolerance. |

The four B contact sheets cover all 40 non-S1 initial states. The original full-resolution capture sets remain development evidence; this delivery contains representative actual screenshots, all recorded matrix/interaction JSON, and every final selected-stage image. A screenshot filename present in JSON may therefore identify an original capture not duplicated in this delivery. Nothing was regenerated to fill a missing historical screenshot.

## Raw reports and detector encoding

- `../assessment-a.md`, `../assessment-b.md` and `../audit.md` are byte-for-byte copies of their completed originals. Initial snapshots, intermediate failures and closure addenda remain visible.
- `assessment-b-evidence/after-detector-raw.json` is **UTF-16LE with BOM**, exactly as produced by PowerShell stdout redirection. Decode as UTF-16 to read its JSON `[]`; a UTF-8-only reader will fail. No encoding conversion was performed.
- `after-detector-metadata.json` and browser JSON are UTF-8 (some source files retain a UTF-8 BOM). Metadata records the actual command, exit code 0, engine 0.1.14, exact upstream pin and 29-file on-disk inventory. The inventory is not detector parser coverage.
- `after-detector-stderr.txt` is the original empty file. Empty stderr and zero findings do not prove a clean user experience.

## Scripts and reproduction boundary

The original scripts live under `evidence/scripts/` unchanged. Their relative imports and output paths assume the original `.dev-tools/reviews/` location beside `portfolio-main-v2/`; they are forensic reproduction inputs, not product runtime dependencies or a promise that invoking them directly from this archive directory will work. Recreate those relative locations or deliberately adapt import/output paths before rerunning against a separately started local preview on port 4326. The project's maintained regression suite is the release check path.

Browser evidence uses Chromium 156.0.8078.4. Root-font enlargement is not every browser zoom/OS scaling mode. Touch is synthesized Chromium CDP input, not hardware testing. No NVDA/VoiceOver speech session, Safari/Firefox run, complete accessibility certification, mobile Lighthouse score or numerical-model validation is inferred from these images. No live Impeccable overlay was injected through the read-only native browser API.

All archived paths are relative. No operator account path was present in these copied review files, so no path redaction or other raw-evidence change was needed. The coordinator owns preview-process cleanup and separately records local CI and Lighthouse results.
