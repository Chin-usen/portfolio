# Final mobile performance evidence

All 18 routes pass the unchanged per-category median budgets: Performance >=90, Accessibility >=95, SEO >=95. Exactly 54 measurements are retained. Final LHCI assertion exit: 0.

The initial final-source session stopped after 18 measurements. Its original reports were retained after source-hash verification; the remaining routes were collected with checkpoints. Every completed same-source measurement was kept. No route was repeated to improve its score. Runtime and built-output hashes were verified around the resumed batches. The collection spans sessions and is not represented as a single uninterrupted autorun.

| Route                                | Runs | Performance median | Accessibility median | SEO median | LCP median (s) |
| ------------------------------------ | ---: | -----------------: | -------------------: | ---------: | -------------: |
| `/`                                  |    3 |                 99 |                  100 |        100 |          2.110 |
| `/about/`                            |    3 |                 98 |                  100 |        100 |          2.407 |
| `/contact/`                          |    3 |                 97 |                  100 |        100 |          2.556 |
| `/en/`                               |    3 |                100 |                  100 |        100 |          1.507 |
| `/en/about/`                         |    3 |                100 |                  100 |        100 |          1.055 |
| `/en/contact/`                       |    3 |                100 |                  100 |        100 |          1.055 |
| `/en/lab/`                           |    3 |                100 |                  100 |        100 |          1.055 |
| `/en/lab/chip-junction-temperature/` |    3 |                100 |                  100 |        100 |          1.359 |
| `/en/lab/sample-simulation/`         |    3 |                100 |                  100 |        100 |          1.357 |
| `/en/lab/sample-teardown/`           |    3 |                100 |                  100 |        100 |          1.055 |
| `/en/work/`                          |    3 |                100 |                  100 |        100 |          1.054 |
| `/en/work/sample-case/`              |    3 |                100 |                  100 |        100 |          1.204 |
| `/lab/`                              |    3 |                 97 |                  100 |        100 |          2.555 |
| `/lab/chip-junction-temperature/`    |    3 |                 92 |                  100 |        100 |          3.160 |
| `/lab/sample-simulation/`            |    3 |                 98 |                  100 |        100 |          1.957 |
| `/lab/sample-teardown/`              |    3 |                 98 |                  100 |        100 |          2.404 |
| `/work/`                             |    3 |                 97 |                  100 |        100 |          2.555 |
| `/work/sample-case/`                 |    3 |                 93 |                  100 |        100 |          2.556 |

LCP is reported separately from the weighted performance score. Chinese S1 remains about 3.16 seconds in the pilot; a passing score does not mean every route has LCP below 2.5 seconds. The Home image composition differs from v2, so no faster-than-v2 claim is made.

[All scores, timestamps and raw hashes](lighthouse/summary.json); [collection sessions](lighthouse/collection-sessions.json); [original assertion results](lighthouse/assertion-results.json). Eighteen representative median-performance raw reports are included under lighthouse/median-reports; all 54 originals remain in the local durable checkpoint. Category medians are computed independently.

Earlier failed and interrupted attempts remain in attempt-1, pilot-1, font-loading-pilot, attempt-2 and s1-font-loading-pilot. Their scores are not included in this final source sample set.
