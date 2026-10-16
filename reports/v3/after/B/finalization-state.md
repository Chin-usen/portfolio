# Independent B recovery and finalization state

Status: FINAL for the original B-tested state; 17/20 frozen with scope limits below. Original findings preserved, report recommendations corrected, and the one supplementary current-build zoom viewport capture completed. No app file edited. Only B's existing reports, harnesses and evidence plus current build hashes were read; no A or before-run assessment was consumed. The original drafts are retained locally in the assessment workspace.

## Verified recovery evidence

The 04:33:19–20 UTC dark Home viewport captures were opened and visually inspected. All show the primary metric and three secondary metrics; the zh/390 image also shows the hero and module. This resolves the prior blank-band concern for these states. Full-page repaint PNGs also exist, but are not substituted for the inspected viewport images.

| File under `screenshots/` | SHA-256 |
|---|---|
| `home-zh-dark-1440-metrics-viewport.png` | `CB52C42C15854DC0D7FE7A6A86F966CFC62678BFD5B507693A802FE223F1DBA0` |
| `home-zh-dark-390-metrics-viewport.png` | `17D3ED9BB9D42BFD379BE962B4314A6B8C17972CEE6DF86661C0D6A43A923AB2` |
| `home-en-dark-1440-metrics-viewport.png` | `6CF280BB14A5AD7ACDF76DE23E68643E1E3E13472D6791CB65C12B65DAB30CB7` |

`capture-confirmation.cjs` writes `capture-confirmation.json` only after its zoom context finishes. That JSON and every zoom viewport PNG were absent when recovery started. Therefore the entire original harness's completion, measured capture geometry, and final cleanup are not inferred from the first three PNGs. The later one-image confirmation below uses a separate harness/JSON and does not fabricate the missing original output.

`browser-evidence.json` is valid UTF-8 JSON (Windows PowerShell needs explicit `-Encoding UTF8`). Its original `actual-browser-zoom-200-percent` record is completed and contains all four Home/S1 × zh/en states: zoom 2, CSS viewport 720×500, DPR 2, visualViewport.scale 1, clientWidth 720, scrollWidth 720, and empty undersized-control arrays. Original harness finished 2026-10-15T04:28:08.794Z. Follow-up JSON finished 04:29:10.228Z. These are actual retained measurements, not new tests.

The existing English Home full-page zoom PNG was visually inspected and crops the right side. It cannot prove full visual reflow even though the DOM measurements are valid. The original-state score uses the retained geometry evidence with this image limitation stated; the current-build capture below is supplementary evidence only.

## Completed bounded supplementary capture

After the coordinator explicitly released the browser lock, `zoom-viewport-confirmation.cjs` captured **English Home, light theme, scrollY 0, actual Chrome browser zoom 200%**, on the current build at 2026-10-15T04:46:22.785Z–04:46:23.767Z. The retained extension method `chrome.tabs.setZoom(tabId, 2)` returned `getZoom=2`; no CSS zoom or viewport-only substitute was used. CDP `Page.captureScreenshot({format:'png', captureBeyondViewport:false})` produced the direct viewport image.

Evidence: `zoom-viewport-confirmation.json` and `screenshots/zoom200-home-en-viewport.png`. Actual measurements: CSS viewport720×500, DPR2, visualViewport.scale1, clientWidth=scrollWidth=720, scrollX=scrollY=0, fonts loaded, PNG1440×1000. PNG SHA-256: `2c275f63a58f698788d51b9bf3f4537d7b0477a97453e8e737cfec88ce68d0d9`. Visual inspection shows the complete header, both hero title lines, full specialty line and both CTAs fitting horizontally. The JSON records `captureComplete:true`, `browserClosed:true`, and identical four-route hashes before/after the capture. Root and the performance agent were notified that the browser slot was released. No further B browser work is running.

All four current route hashes differ from the original `browser-evidence.json.builtHashes`. The current English Home route SHA-256 is `d92108f3fbf4a83015b17291483ec5358561e4f301743b2192ae649f32100caa`; all four are preserved in the supplementary JSON. Therefore this capture confirms the current English Home viewport and the capture method, not every original or current route visually. Original B source/build hashes remain unchanged. The final 17/20 judgment is frozen for the original B-tested state, and is not a rescore of later coordinator changes.

## Fixed-design constraint and command correction

The coordinator supplied two current-brief constraints during recovery: D1-mobile explicitly specifies 11px secondary metric captions and exact reference sizes must be retained; only Impeccable audit/critique commands are permitted. The prior draft's font increase and style-command recommendations are withdrawn. No new design-reference inspection is claimed. B2 remains a design-constrained readability observation, not an actionable implementation deviation. B1/B3 retain their original P2 evidence and scoped manual remediation recommendations. Revised count: two actionable P2 findings plus one constraint observation. Original-state 17/20 reflects the same remaining accessibility/responsive limitations and bounded performance evidence; removing B2's automatic-fix recommendation does not eliminate those dimension-level limits.

Root separately reported work on B1. Only the bounded English Home zoom viewport was inspected on the later build here; S1 changes were not verified. Verify those fixes separately before claiming a final current-state result.
