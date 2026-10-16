# Before evidence archive

This directory contains unchanged raw measurements/scripts and a selected set of actual baseline images. All source names below are workspace-relative. No captures, scores or measurements were recreated for packaging.

## Mapping and integrity

| Original source | Archive path |
|---|---|
| `.dev-tools/reviews/before-assessment-a.md` | `../assessment-a.md` |
| `.dev-tools/reviews/before-assessment-b.md` | `../assessment-b.md` |
| `.dev-tools/reviews/before-audit.md` | `../audit.md` |
| `.dev-tools/reviews/before-*.json` | Same filename in this directory |
| `.dev-tools/reviews/assessment-a-evidence/{matrix,interaction-notes}.json` | `assessment-a-evidence/`, same filenames |
| Original A/B capture and contact-sheet scripts | Same filenames in this directory |
| Selected `.dev-tools/reviews/b-*.png` | Same filenames in this directory |
| Four targeted A interaction screenshots | `assessment-a-evidence/`, same filenames |

[manifest.json](manifest.json) lists every copied artifact, its source/archive relative path, bytes and SHA-256. The three raw Markdown reports, six JSON artifacts and six capture/contact-sheet scripts are byte-for-byte copies. Raw reports retain their original workspace path descriptions; this guide maps those descriptions into the archive.

## Measurements

- [A matrix](assessment-a-evidence/matrix.json): all 48 states.
- [A interaction notes](assessment-a-evidence/interaction-notes.json): mobile result position, tabs, fonts, menu, email and load failure.
- [B matrix](before-browser-matrix.json): all 48 states, status/landmarks/headings/geometry/resource data.
- [B interactions](before-interactions.json): keyboard, locale, fallback, touch, dark skip and text expansion.
- [B targeted verification](before-targeted-verification.json): settled keyboard-view hashes, warning semantics, FEM state and text-expansion geometry.
- [Raw detector](before-detector-raw.json): `[]`; no retained invocation/exit-code/file inventory.

The older immediate preset-color sample and keyboard/FEM timing samples are superseded as explained in the raw B report. Do not derive new failure/pass claims from those timing-sensitive records in isolation.

## Screenshots

The four original contact sheets show the five shared-shell pages in both themes:

- [English desktop](b-sheet-en-1440.png)
- [English mobile](b-sheet-en-390.png)
- [Chinese desktop](b-sheet-zh-1440.png)
- [Chinese mobile](b-sheet-zh-390.png)

Representative full-page screenshots include English Home light/dark and S1 in both languages on mobile light/dark plus desktop light. Targeted captures include both dark skip links, both enlarged-text S1 layouts, settled orbit before/after and A's four mobile interaction images (maximum power, Cooler keyboard selection, FEM failure and email reveal).

Full-resolution screenshots for every matrix state remain in the original review workspace; only the listed subset is duplicated here. The JSON preserves full 48-state coverage. The contact sheets are existing composites, not fresh captures or invented substitutes.

## Capture scripts and reproduction boundary

The original scripts are preserved unchanged:

- `assessment-a-capture.cjs`
- `assessment-a-interactions.cjs`
- `b-browser-matrix.cjs`
- `b-interactions.cjs`
- `b-targeted-verification.cjs`
- `b-contact-sheets.py`

They were originally run from the `.dev-tools/reviews/` directory in a workspace with sibling baseline `portfolio-p3/`. JavaScript imports `../../portfolio-p3/node_modules/@playwright/test` and targets the frozen preview at `http://127.0.0.1:4325`. The imports contain relative paths, no operator account directory.

These are historical capture scripts, not a newly tested portable one-command runner. To reproduce their baseline measurements, restore that original relative directory layout and baseline dependencies, serve the frozen baseline at the recorded URL, and run the relevant script. For another layout/port, adapt a separate working copy and record the change/new outputs; do not overwrite this before evidence. The contact-sheet script additionally uses Pillow and expects the full original set of B shared-page PNGs alongside it.

No script was rerun during report packaging. Do not run against after code and label the output “before.”
