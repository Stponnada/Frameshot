# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Frameshot is a generic browser tool for framing shots of any 3D model. You load a model, capture a sequence of camera "views" (each with its own lighting and optional big overlay titles), play them back with camera and light tweening, and save PNG frame shots. Everything lives in one self-contained file, `index.html` (CSS + HTML + an ES-module `<script>`). There is no build step, package manager, linter or test suite.

## Running

```bash
python3 -m http.server 8137
```

Then open http://localhost:8137 and drop a model onto the page or click **Open model**. You can also add `?model=path/to/file.glb` to load a model served next to the page. Three.js **0.160.0** is loaded from jsDelivr through the import map, so the page needs network access. Serving over HTTP is required for `?model=`. Drag-and-drop and the file picker also work from `file://`, but ES modules from a CDN can still be blocked there.

## Architecture (inside `index.html`)

- **Loading**: `loadFiles()` takes a picked or dropped file set. The first `.glb`, `.gltf`, `.obj`, `.stl` or `.fbx` file is the main model, and companion files (`.bin`, textures) are served to the loader through a `LoadingManager` URL modifier that matches them by file name to blob URLs. `loadModel()` disposes of the previous model and loads the new one through `parseModel()`, which picks the loader from the file extension.
- **Compressed glTF**: `makeGltfLoader()` attaches the Draco, KTX2 (Basis) and Meshopt decoders. Draco and KTX2 download their decoder files from jsDelivr on first use. `SUPPORTED_GLTF_EXTENSIONS` must stay in sync with what three 0.160's GLTFLoader can read.
- **Load errors**: `loadModel()` reads the file into memory itself (`readBytes()`) and then calls the loaders' `parse()` methods. This lets it check the file before parsing: HTTP status, empty files, Git LFS pointers, HTML pages, the glb header, the glTF version, required extensions, missing `.gltf` companion files, and the FBX version. All failures become a `LoadError { title, body, fix }` that is shown in the persistent report panel (`showReport()`) together with file facts and the raw exception. Toasts are only for brief confirmations, never for errors. Missing textures still let the model load and produce a warning report.
- **Normalization**: `frameModel()` scales every model so that its largest dimension is `MODEL_SIZE` (10), centers it, and puts it on the ground plane. Because of this, the fixed light radius, the shadow frustum and the saved view coordinates mean the same thing for every model.
- **Views**: each view has a `caption`, camera `pos`/`target`, an optional `light`, and an optional `title`. It can also have `titlePos`, `titleLayer`, and a `portrait` override for tall (phone-shaped) frames. `resolveView()` merges in the portrait override when `isPortrait()` is true.
- **Lighting model**: views store a small set of parameters (`exposure`, `keyIntensity`, `keyAzimuth`, `keyElevation`, `rimIntensity`, `ambient`) instead of raw lights. Missing keys fall back to `DEFAULT_LIGHT`. `applyLight()` maps them onto the scene lights, and `tweenTo()` interpolates camera and light together.
- **Caption overlays** (the "Caption Overlay" section in Author mode): these are HTML overlay slots (`ovSlots`), not 3D text. The WebGL canvas is transparent and sits at z-index 2. Slots with class `.behind` (z-index 1) are hidden by the model's geometry; `.in-front` slots (z-index 9) render over it.
- **Frame shot** (`btn-shot`): this re-renders at `SHOT_PIXEL_RATIO` and calls `toBlob` in the same task, so `preserveDrawingBuffer` isn't needed. The result is a transparent PNG. HTML titles and captions are **not** included in it.
- **Export video** (`exportVideo()`): this replays the sequence offline at `VIDEO_FPS` (30), with the long edge at `VIDEO_LONG_EDGE` (1920) and the output keeping the stage's aspect ratio. Frames are encoded as H.264 with WebCodecs `VideoEncoder` and packaged as MP4 by mp4-muxer, which is imported dynamically from jsDelivr only when exporting. Timing copies Play: a `MOVE_S` camera move, captions fading in over `REVEAL_S` after arrival, and a hold of `PLAY_DWELL_MS` from arrival. Caption overlays are composited into each frame. `measureCaptions()` lays each view's captions out in the real DOM with transitions off (`body.measuring`), reads each line's position with Range rects, and `drawCaptions()` redraws them on a 2D canvas: behind-layer text first, then the WebGL frame, then front-layer text. While `exporting` is true, `tick()`, `goToState()` and `onStageResize()` do nothing, and `restoreAfterExport()` puts everything back. If you change the timing or the overlay CSS, keep the exporter in sync.
- **View fields for timing and camera**: a view may give its camera as `orbit` (azimuth/elevation/distance/target, resolved by `orbitToPose()`) instead of `pos`/`target`. If both are present, `pos`/`target` win. `hold` and `move` (seconds) control pacing in Play and in the exporter. The live camera move is time-based (`tween.dur`), not frame-based. `viewsProblem()` validates views for Import, the API and the CLI.
- **Agent API** (`window.frameshot`, near the end of the script): async wrappers over the same functions the UI uses. `loadModel()` and `exportVideo()` return `{ ok, … }` results and also show the report panel, and the API turns failures into `FrameshotError`. `frameshot.ready` resolves after startup loading. `?fresh` skips reopening the last model. When you add a UI capability, add the matching API method, and update `skill/frameshot/reference.md` and `HELP`.
- **CLI** (`tools/frameshot.mjs`): serves the repo and the model's folder (`/__model/`) on a random port, opens the page in headless Chrome through Playwright (falling back to Playwright's Chromium, which encodes VP9 instead of H.264) and calls the API. Frame presets are CSS-pixel viewport sizes, because caption sizes scale with stage width. It deliberately doesn't wait for the page's `load` event, which arrives about 20 s late.
- **Author mode**: captures and updates views, edits lighting with sliders, drags titles into place, reorders views, and exports or imports views as JSON. Pressing Update while in a portrait frame writes the `portrait` override instead of the main view.

## UI system

The tool's UI chrome follows `~/Desktop/git/Design principles.md`. All values are tokens on `:root` at the top of the `<style>` block. A literal font size, spacing value, colour, radius or duration in a rule is a defect, so add or reuse a token instead.

- **Type**: one family (`--font`) and five sizes (`--fs-label`, `--fs-ui`, `--fs-lead`, `--fs-statement`, `--fs-hero`). There are three weights: 400 for UI, 500 for labels and buttons, and 700 only for the title overlays. Everything is in sentence case: the user doesn't want uppercase labels anywhere. `.label` is a section heading (weight 500). File names and other values keep their original case. The app name in the header is set at `--fs-lead`.
- **Colour roles**: `--ground` → `--panel` → `--raise` create depth through small steps in lightness, without borders, blur or shadows. Secondary text is `--text-2`, which is the text colour at 60%. `--accent` is for interaction only (selection, focus, the active toggle, drop feedback) and never appears on content at rest.
- **Buttons**: `.btn` is a text button by default. `.btn.outline` marks a section's main action. `.btn.solid` is for the single primary action on screen: **Take an image**, or **Open model** in the empty state. Keep the image-export wording unmistakable: "Save shot" was mistaken for "add this view to the sequence".
- **Other rules**: one `--radius`, the spacing scale `--s-1`…`--s-7`, and one `--ease` curve. Groups are separated by space, not divider lines. `prefers-reduced-motion` turns off CSS transitions.
- **Content vs. chrome**: the title overlays (`.ov*`) are the user's ad content, not tool chrome. They keep their bold display style, slower reveal (`--t-reveal`) and legibility text-shadow.

Decision log:
- 2026-10-14: Applied the design principles. Removed the floating caption pill (it repeated the active row in the Views list), the emoji icons, the spinner, the glass blur, the borders and the drop shadows. The always-visible hint moved into the Views panel. Author mode got four sections (View, Caption Overlay, Lighting, Views file). The Sound button appears only when `audio/bed.mp3` exists. The Phone frame button is hidden when the window is already portrait. Title sizes went from five statement sizes to one (`--fs-statement`).

- 2026-10-14: Renamed Save shot to Take an image. Removed uppercase from labels. The Views panel now has a fixed height, and its empty state is one line plus an Open Author button; the orbit/zoom hint was removed as too much text. The header's Open new model button asks for confirmation before replacing a loaded model, and dropping a file onto a loaded model asks too (`confirmReplace()`, which reuses the report panel as a confirm dialog).

## Persistence

The last model opened from disk (its main file plus any companion files) is kept in IndexedDB (database `frameshot`, store `last-model`). The tool reopens it on startup unless `?model=` is set. `rememberLastModel()` runs after a load succeeds. If a restored file fails to load, `forgetLastModel()` clears it so a broken file isn't retried on every reload. Loading through `?model=` also clears it, because the URL already reopens that model. All IndexedDB calls fail quietly, and if storage fails the user gets a toast.

Views are saved to localStorage under `frameshot_views_v1:<model file name>`, so each model file name has its own list. There are no baked-in default views. Use Export JSON / Import JSON to move views between machines or browsers. Views are only meaningful for the model they were captured on.

## Files

Model files (`*.glb`, `*.gltf`, …) are git-ignored, so sample models stay local. `audio/` is meant for the optional `bed.mp3`, `whoosh.mp3` and `tick.mp3` (`AUDIO_SRC`). It is currently empty, and missing files fail silently.
