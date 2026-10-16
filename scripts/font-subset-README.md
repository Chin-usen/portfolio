# Reproducible Chinese font subsets

The twelve global files under `public/fonts/` retain the Noto Sans SC 400, 500, 600 and 700 outlines from locked `@fontsource/noto-sans-sc@5.3.1`. Each real weight has three disjoint subsets: 240 Home/common code points (34,556 to 35,256 bytes), 333 remaining-content code points (49,104 to 50,140 bytes), and U+2192 from the original numbered chunk (804 to 832 bytes). All twelve files total 341,712 bytes; a page downloads only the subsets its text needs. The original OFL notice and source/output SHA-256 values are included beside them. Font names, copyright/license metadata, hinting, advance widths, vertical metrics and actual weights are retained.

The v4 refresh includes seven CJK characters introduced by the new page copy. This avoids downloading full original chunks merely for those characters. The old global set was 356,344 bytes; the refreshed set is 341,712 bytes. This is a content and transfer optimization, not a change to font design. The initial Lighthouse Case C median failed while its locally observed paints were fast; the shared CSS-dependent font chain motivated this correction, but does not establish a Case C-specific computation problem. Only a fresh complete measurement set can establish the final performance result.

Normal `pnpm dev` and `pnpm build` use Node only. `generate-font-css.mjs` validates asset/source/license hashes, selects the checked-in subsets, and emits original locked font chunks for newly added code points outside their coverage. Thus adding content does not require Python or silently lose Chinese glyphs. Characters outside the original Noto package continue through the existing Geist/system font stack.

## Optional regeneration

Run from the repository root:

```sh
python -m venv .font-tools
# Activate .font-tools using the command appropriate for your shell.
python -m pip install -r scripts/font-subset-requirements.txt
python scripts/subset-noto-fonts.py
node scripts/generate-font-css.mjs
python scripts/subset-noto-fonts.py --check
node scripts/generate-font-css.mjs --check
```

The optional authoring tools are FontTools 4.65.0 (MIT) and Brotli 1.2.0 (MIT), pinned in the requirements file. They are not npm/runtime dependencies and are not needed for ordinary builds. The Python check compares every retained glyph's decomposed outline and advance metrics against the source fonts, not merely the number of characters. The Node check also probes a new CJK character and verifies that all four original weight fallbacks remain available.

Geist Latin is preloaded on every page because the shared shell and headings use it. Chinese routes other than S1 preload the existing common 400, 600 and 700 faces to remove CSS-discovery delay. This extends the existing Home scheduling rule to content pages without adding a font family or changing weights. `font-display` remains `swap` and the family stacks are unchanged.

## S1 route-specific subsets

S1 uses a separate four-face `Noto Sans SC Thermal` family totaling 103,192 bytes. The scoped set retains the original 400, 500, 600 and 700 outlines and covers interface strings at their actual CSS weights. Its font stack retains global Noto Sans SC for future or uncovered Chinese copy. Chinese S1 preloads these four thermal faces; both languages preload Geist Latin and Geist Mono Latin. The global v4 refresh leaves this effective S1 preload set and the thermal assets unchanged.

```sh
python scripts/subset-thermal-fonts.py
python scripts/subset-thermal-fonts.py --check
```

After regeneration, format the JSON manifest with the project's Prettier command, rebuild, and rerun mobile Lighthouse and delayed-font layout tests. New editorial content can change font transfer even when layout code stays unchanged. External release evidence records the final source/asset hashes and measurements.
