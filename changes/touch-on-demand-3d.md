# Touch devices load teardown 3D on request

On touch devices (`pointer: coarse`) the four 3D teardown pages (L1 half-bridge, L3 RV reducer, L4 harmonic drive, L5 robot joint) no longer download Three.js and the GLB or build the WebGL scene automatically. The decoded static poster stays in place with a centered "Load 3D model" button (44 px target) and a status line explaining that the static view, part notes and calculations work without it. Tapping the button starts the existing loader immediately; touching the stage to scroll does not. Keyboard focus on the stage still loads the viewer.

Desktop pointers keep the existing automatic enhancement after first paint. Reduced-motion, save-data and low-resource fallbacks are unchanged. The change lives in the shared disassembly shell and controller, so every page using the template inherits it.

This removes the 400–1000 ms of main-thread work that the WebGL scene build added to mobile Lighthouse total blocking time on GPU-less CI runners, and spares phone users an unrequested GLB download.
