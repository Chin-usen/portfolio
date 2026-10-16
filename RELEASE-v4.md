# Main v4 ? 1.3.0 release guide

This local review package continues approved main v3 commit `90dd6a5b93886ff45a7cbd6bc0e96b1c2b5f42ba`. It follows the supplied N1 navigation and page structure and uses fictional career, identity, case metrics and contact content. The separate bold experiment is unchanged. Nothing has been pushed or deployed.

## Open the delivery

Put `00-START-HERE.zip` and all numbered part ZIPs in one directory. Extract the starter and follow its `README.zh-CN.txt`: the supplied Python or PowerShell restorer checks every part SHA-256 before reconstructing the full ZIP. The manifest binds the archive and restored source/evidence files. Each delivered ZIP is at most 1,000,000 bytes. Both actual restorers are exercised against the emitted parts before attachment delivery.

The full archive has two independent roots:

- `portfolio-main-v4/`: committed source, including this guide and historical evidence from earlier releases.
- `v4-evidence/`: newly generated v4 review, browser, numerical, performance and integrity evidence. These files are outside the source repository and are not committed.

Open `v4-evidence/comparison.html` for the before/after Home, Work and S1 screenshot matrix. Read `v4-evidence/ci/integrity.json` for the release commit and successful check-log hashes, and the starter manifest for package hashes. Historical `reports/v3/`, `reports/v2/` and older release guides describe earlier deliveries.

## Run locally

Use Node 22.23.3 and pnpm 12.11.2. From the source directory:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The terminal prints the HTTP development URL. A production preview uses `pnpm build` then `pnpm preview`. Do not double-click an individual generated HTML file: routing and module loading require an HTTP server. Runtime assets, including fonts and the existing module WebP, are local. No analytics or third-party font requests are introduced.

The independent Chinese routes are `/`, `/work/`, its three case details, `/lab/`, its three available lab details, and `/about/`. English equivalents start with `/en/`. Contact is at the localized About page's `#contact`; old Contact routes emit static redirect HTML. Host-level HTTP redirect status remains a deployment configuration concern. Planned lab entries remain explicitly unavailable; placeholder achievements are not presented as measurements.

## Behavior and regression scope

The 52 px sticky glass header selects Work, Lab or About, including their child pages. Home selects none. Below 768 px, a 44 px menu control opens a native fullscreen dialog with language/contact actions, explicit Tab containment, Escape, scroll lock and focus return. Astro ClientRouter supplies destination titles, heading focus and browser history. The header stays stationary through the restrained page transition; reduced-motion preferences disable it.

Home contains only the hero, two destinations, an existing responsive WebP and footer. Browser checks require exact no-overflow geometry at 1440x900, 1280x720 and 390x844 in both languages and themes. Short portrait layouts shrink within the viewport; landscape below 500 px may scroll. Enlarged text can reflow and scroll rather than be clipped. Work owns the black metrics band and three linked placeholder rows. The explicitly authorized dark page token is `#0E0E10`; metrics remain `#000` with subtle top/bottom borders. Dark Home compositing preserves original image bytes.

S1 defaults to the selected chip detail, balances its legend and provides a mobile jump to the parameter controls. Route-scoped Chinese subsets retain the licensed font's original outlines, metrics and real weights. The optional Python generator and check command are documented in its source; normal Node builds use checked-in assets.

The ten Home/S1 round trips are same-document ClientRouter navigations. `v4-evidence/lifecycle/home-s1-ten-round-trips.json` records renderer cleanup, disposed controls, cancelled animation work, removed owned listeners and lost contexts. Diagnostic snapshots contain values only and are bounded. Renderer counters and available heap samples are useful evidence, not a full heap census or a guarantee for all GPU drivers. Delayed-import and failure paths of the smaller Three.js demo have separate browser regressions.

## Validation and evidence

Run the normal gates with:

```sh
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm security:scan
pnpm lhci
```

Set `CHROME_PATH` if Lighthouse cannot locate Chromium. Browser artifacts can be routed outside source with `PLAYWRIGHT_OUTPUT_DIR`, `PLAYWRIGHT_HTML_REPORT` and `V4_REPORT_DIR`. Local validation is not a claim that hosted GitHub Actions ran.

The release evidence records 48 main unit tests, 105 browser regressions, type checking, lint, production build and sensitive-information checks. P2 validation runs from an isolated byte-identical copy: its 30 unit tests, type checks, scaling checks, Python FEM audit and mesh export do not modify the preserved P2 package. The sensitive-information scan enabled the built-in phone/birthday rules; private `BLOCKED_KEYWORDS` were not configured. Gitleaks separately scans the selected source and final extracted package. No secret-scanning setup can establish that fictional content is suitable for a later real deployment.

Final mobile Lighthouse acceptance is 20 content routes with three fresh original samples per route, using per-metric medians: Performance at least 90, Accessibility and SEO at least 95; both S1 routes require Performance at least 95 and LCP below 2.5 seconds. `v4-evidence/lighthouse/final/summary.json`, the 60 original raw reports, 64 assertion results, source/build hashes and assertion-input manifest are the authoritative final evidence. Failed initial measurements are retained separately with their diagnosis; measurements are never silently replaced. Exact final scores are stated in the accompanying evidence summary.

## Review provenance and immutable scope

Only Impeccable audit/critique workflows at commit `2f98774f86bc05563876643db37e6c37c322850f` were used. Independent A/B findings, original screenshots, combined before/after reports and bounded correction confirmations are in `v4-evidence/before/` and `after/`. A's before and after totals have different applicable denominators; they are not a like-for-like score increase. Parent report-reading order had a limited after-review deviation, disclosed in the report; the two reviewer assessments remained independent. No additional style commands or retrospective rescoring are claimed.

The original confirmation closed three of four findings. A second targeted technical check fixed the remaining dark-image matte; its fresh Home captures and exact pixel samples are preserved alongside the initial result. These checks do not substitute for screen-reader or broad cross-browser testing.

All 14 `docs/` files, all 67 tracked `thermal-p2/` files and historical tracked reports retain the approved v3 worktree bytes. Mixed historical newline conventions are preserved. New visual/navigation work does not change P2 2.0.0 or extend the physical validity of the thermal models. The source and external evidence have separate manifests; there are no new generated v4 reports committed to the source tree.
