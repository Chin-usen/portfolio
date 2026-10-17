# Reproducible Chinese font subsets

The sixteen global files under `public/fonts/` retain the Noto Sans SC 400, 500, 600 and 700 outlines from locked `@fontsource/noto-sans-sc@5.3.1`. In the current v5 manifest, each real weight has four disjoint subsets: 259 Home/common code points (37,788 to 38,516 bytes), 368 remaining-content code points (54,100 to 55,176 bytes), and two one-symbol subsets from the original numbered chunks 90 and 109 (804 to 900 bytes each). All sixteen files total 378,452 bytes; a page downloads only the subsets its text needs. The original OFL notice and source/output SHA-256 values are included beside them. Font names, copyright/license metadata, hinting, advance widths, vertical metrics and actual weights are retained.

The historical v4 refresh included seven CJK characters introduced by its new page copy. This avoids downloading full original chunks merely for those characters. The earlier global set was 356,344 bytes; that v4 set was 341,712 bytes. The current v5 global totals above additionally cover L1 copy and symbols. This is a content and transfer optimization, not a change to font design. The initial Lighthouse Case C median failed while its locally observed paints were fast; the shared CSS-dependent font chain motivated this correction, but does not establish a Case C-specific computation problem. Only a fresh complete measurement set can establish the final performance result.

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

Geist Latin is preloaded on every page because the shared shell and headings use it. Chinese routes other than S1 and L1 preload the existing common 400, 600 and 700 faces to remove CSS-discovery delay. This extends the existing Home scheduling rule to content pages without adding a font family or changing weights. `font-display` remains `swap`; the route-specific families below retain the global Noto fallback.

## S1 route-specific subsets

S1 uses a separate four-face `Noto Sans SC Thermal` family totaling 103,192 bytes. The scoped set retains the original 400, 500, 600 and 700 outlines and covers interface strings at their actual CSS weights. Its font stack retains global Noto Sans SC for future or uncovered Chinese copy. Chinese S1 preloads these four thermal faces; both languages preload Geist Latin and Geist Mono Latin. The global v4 refresh leaves this effective S1 preload set and the thermal assets unchanged.

```sh
python scripts/subset-thermal-fonts.py
python scripts/subset-thermal-fonts.py --check
```

After regeneration, format the JSON manifest with the project's Prettier command, rebuild, and rerun mobile Lighthouse and delayed-font layout tests. New editorial content can change font transfer even when layout code stays unchanged. External release evidence records the final source/asset hashes and measurements.

## L1 route-specific subsets

L1 uses four `Noto Sans SC Half Bridge` faces totaling 82,980 bytes: 400 is 59,436 bytes / 420 code points; 500 is 3,620 bytes / 19; 600 is 10,244 bytes / 59; and 700 is 9,680 bytes / 57. The generator reads all ten part records, Chinese interface copy, component literals, and shared shell copy. Its coverage follows the existing CSS: body text and unselected controls are 400; inactive desktop navigation is 500; selected controls, part labels, site name and loop captions are 600; the title, part-name heading, noscript headings and mobile navigation retain their existing bold 700. Secondary translated part names remain 400.

Chinese L1 preloads only these four scoped Chinese faces. Both L1 locales retain Geist Latin and Geist Mono Latin preloads. The scoped family is selected only on `html[lang='zh-CN'] body.half-bridge-page`, including its shared header/footer, and keeps global Noto Sans SC as fallback for future or uncovered copy. English L1 retains its existing global family stack, so its secondary Chinese part-name text does not incur the larger Chinese-route 400 subset. Existing global and S1 font files remain unchanged. All requested Chinese characters are covered; non-CJK symbols unavailable in the original Simplified Chinese source retain the existing font stack.

```sh
python scripts/subset-half-bridge-fonts.py
python scripts/subset-half-bridge-fonts.py --check
# Optional external verification evidence (not needed for ordinary builds):
python scripts/subset-half-bridge-fonts.py --check --report /path/to/reports/fonts/l1-subsets.json
```

The check compares every retained outline, actual weight, advance and vertical metrics, original metadata, license, source/output hashes, and generated CSS ranges. It also checks that current copy still matches the mapped coverage. The optimization changes font transfer and scheduling, not glyph design, geometry, layout, or viewer timing. Fresh browser and Lighthouse evidence must establish the performance outcome; the asset checks alone make no timing claim.

The generated `src/styles/generated-fonts.css` is an ignored build output. `dev`, `build`, and `typecheck` regenerate it from every installed page. Independent page patches therefore never modify a shared generated CSS file. Original font binaries and licenses remain checked in. Optional page-local font generation uses `node scripts/lab-assets.mjs fonts <slug>` and its own `model/fonts.mjs`; normal rendering retains the locked original-font fallback.
