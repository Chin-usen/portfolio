# S1 font-loading pilot

Only `src/layouts/BaseLayout.astro` changed after the interrupted full run. Font bytes, CSS, geometry, numerical code and Home preload scope are unchanged. Existing Latin fonts are preloaded on both S1 locales; the Chinese route additionally preloads the seven Chinese faces that its original network trace already requested.

The Latin-only treatment failed with Performance 88/88/88. The final treatment passed with 92/93/92; Accessibility and SEO were 100 in all six runs. Final LCP is about 3.16 seconds, so this is an S1 performance-budget fix and does not assert sub-2.5-second S1 LCP. The Home target is assessed separately. Both treatments retain all three raw LHR files, timestamps, font-request timing, transfer size, category scores and hashes in `summary.json`.

The 20-page build passed; BaseLayout Prettier was unchanged; Astro check covered 86 files and reported zero errors, warnings or hints. The full 18-route/54-run validation is separate. SHA256 values in the summary use lossless eight-character groups to avoid accidental phone-rule matches.
