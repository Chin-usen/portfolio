# Generic power-module hero

Original, self-initiated geometric illustration authored for this repository. It contains one aluminum-gray baseplate, one dark rectangular housing, and exactly three copper-colored upright terminals. All dimensions are arbitrary scene units; this is not an engineering specification, validated engineering model, employer design, or commercial product replica.

## Source and licensing

- Scene source: scripts/power-module-scene.mjs. Native Three.js BoxGeometry, with small procedurally generated edge radii.
- Renderer: scripts/render-power-module.mjs. Headless Chromium runs at build/authoring time only.
- All geometry, studio-light panels, shadow, and materials were authored in source; no external images, HDR maps, manufacturer geometry, downloaded models, or other asset files are used.
- Three.js 0.186.1 is MIT-licensed (node_modules/three/LICENSE). Playwright is Apache-2.0-licensed (node_modules/playwright-core/LICENSE). The newly authored scene, scripts, and generated images are dedicated under CC0-1.0; this dedication does not alter dependency licenses or grant rights over unrelated repository content.
- Visual composition follows docs/design/D1-desktop.html and D1-mobile.html plus their supplied JPG references. The simplified generic geometry was newly built, rather than extracted from a model.
- Before public publication, retain the repository content-policy review of generic power-module imagery; this illustration makes no claim about professional work.

## Reproduce

From the repository root, with the locked dependencies and Playwright Chromium already installed:

```sh
node scripts/render-power-module.mjs
```

Validated with Node 22 and Three.js 0.186.1. The renderer starts and closes its own loopback server on an ephemeral port, blocks external browser requests, renders at 2x resolution, downsamples, and encodes WebP at quality 0.92 using the browser canvas encoder. PNG is used only if the browser lacks WebP encoding. Pixel/byte identity across different Chromium or GPU versions is not guaranteed.

## Assets

| Path                                      | Dimensions | Bytes |
| ----------------------------------------- | ---------- | ----: |
| public/images/power-module-light-900.webp | 900 x 600  | 11372 |
| public/images/power-module-light-450.webp | 450 x 300  |  5700 |
| public/images/power-module-dark-900.webp  | 900 x 600  | 11528 |
| public/images/power-module-dark-450.webp  | 450 x 300  |  5698 |

Light images have an opaque #FBFBFD background; dark images have an opaque #000000 background. Both preserve the same orthographic product silhouette. Use the 450w and 900w files in a responsive srcset, set width/height to 900/600, and keep this authoring source out of the browser bundle. No home-page WebGL, animation, or reduced-motion workaround is needed.
