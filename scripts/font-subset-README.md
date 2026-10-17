# Reproducible Chinese font subsets

The locked source is `@fontsource/noto-sans-sc@5.3.1` under the OFL. Checked-in WOFF2 subsets retain the original glyph outlines, advance widths, vertical metrics, hinting, name/copyright/license metadata and real source weights. Each manifest records source and output hashes and exact cmap coverage. FontTools 4.65.0 and Brotli 1.2.0 are authoring tools only; ordinary development, builds and type checks require Node only.

## Lab policy

`BaseLayout` selects font CSS by route. `/lab/` and `/en/lab/` use a separate index family with two original Chinese weights, 400 and 700. The checked-in base index subsets total 59,964 bytes. Node builds collect both locale shells, current installed-card titles/summaries/status, and remaining planned cards, then emit the ignored `lab-index-composed-fonts.css`. Base faces keep priority. Only missing current glyphs receive disjoint ranges from verified page-owned 400/700 faces; greedy coverage selection avoids loading several unrelated fonts when one face covers the missing text. A heading glyph available only at 400 uses a separately named regular fallback face with its actual 400 weight and synthetic bold disabled, never a relabeled 700 face. CSS weights between these two faces use normal browser matching; no 500/600 Chinese file is requested. Generic lab content, including sample simulation and its dynamic demo status text, uses another two-weight family covering the entire Markdown text.

Registered interactive pages retain their smaller four-face families at original 400/500/600/700 weights. Both locales use the page family, including secondary Chinese part names on English pages. Body coverage includes all page content, component/runtime strings, shared disassembly/simulation components and the shared shell; smaller emphasis faces use the reviewed CSS-to-copy maps in their generators. New pages inherit the shared layout policy and must provide source-bound font manifests.

All lab faces use `font-display: optional`: text is available immediately and the browser can retain its fallback on a slow first visit without a late font swap. The original global Noto CSS and its Fontsource fragments are excluded from lab routes. Symbols outside the original Chinese master use Geist or system fonts. This policy does not remove text or defer its rendering.

`generate-font-css.mjs` calls `check-lab-fonts.mjs` on every normal build, development start and type check. The guard checks current source bindings, source/output/license hashes, actual WOFF2 cmap and OS/2 weight tables using Node Brotli, face counts, CSS ranges and nonblocking display. Every registered page must bind its own descriptor and both locale content files. It independently checks current index and generic text coverage; the recorded catalog is an authoring snapshot, not a closed registry. A changed source or stale subset fails with a regeneration instruction, rather than silently downloading a new Fontsource chunk. An independent page patch carries only its own verified fonts, CSS, manifest and content. Adding it does not rewrite shared font assets or invalidate the generic subset. Generic body changes are still checked against both shared weights; unprovided glyphs fail the build. Registered page text is excluded from generic source bindings and is validated by its own manifest. Shared template/layout edits still require rebinding affected page manifests. Browser tests and Lighthouse must separately establish actual font requests, layout stability and performance.

## Optional regeneration

Use an isolated environment with `scripts/font-subset-requirements.txt`. From the repository root:

```sh
python -m venv .font-tools
# Activate with the command appropriate to your shell.
python -m pip install -r scripts/font-subset-requirements.txt
python scripts/subset-lab-fonts.py
python scripts/subset-half-bridge-fonts.py
python scripts/subset-thermal-fonts.py
python src/components/lab/rv-reducer/model/subset-fonts.py
python src/components/lab/harmonic-drive/model/subset-fonts.py
node scripts/check-lab-fonts.mjs
node scripts/generate-font-css.mjs
```

Run each Python command again with `--check` to compare every retained glyph's decomposed outline and advance/line metrics with its source, not just character counts. Format generated JSON/CSS with the project's pinned formatter. For index Python checks, the checked-in base cmap/outlines remain exact while the Node guard establishes current composed coverage. Source bindings in the legacy/index/generic manifests serialize SHA-256 as eight ordered eight-hexadecimal groups; concatenation restores the exact digest, and both authoring and Node checks verify the decoded value. This avoids secret-scanner confusion with filenames containing `tokens` without exclusions or allowlists. Source binding hashes deliberately include shared layout and CSS, so format/edit those inputs before final regeneration. Never edit generated subset files by hand.

The shared source inventory is `scripts/lab-font-inputs.py`; local CSS/weight maps remain in each scoped generator. A registered page normally stores assets and its manifest under `public/models/<slug>/fonts/`, with component CSS `<slug>-fonts.css`. The legacy half-bridge and thermal families remain under `public/fonts/`. New lab manifests must include `sourceBindings` or `sourceInputsSha256` so the ordinary Node guard can reject stale content without Python.

## Non-lab pages

Other routes retain the original global four-weight `Noto Sans SC` family and its Home/common, remaining-content and symbol partitions. Newly added non-lab glyphs can still use locked original Fontsource chunks. This independent policy is unchanged. Both `src/styles/generated-fonts.css` and `src/styles/lab-index-composed-fonts.css` are ignored build outputs; independent page patches do not carry either file.

```sh
python scripts/subset-noto-fonts.py
python scripts/subset-noto-fonts.py --check
node scripts/generate-font-css.mjs --check
```

Geist Latin remains the shared Latin face. Preload decisions belong to `BaseLayout` and the page descriptor; they do not change coverage or license provenance.
