# Frameshot reference

## View fields

A view is one shot. Give the camera as `orbit`, or as `pos` + `target` (these win if both are set).

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `caption` | string | `View N` | Name of the shot. Not drawn on screen. |
| `orbit.azimuth` | degrees | 0 | Around the model. 0 = front (+Z), 90 = right (+X), 180 = back, -90 = left. |
| `orbit.elevation` | degrees | 15 | Above level. Negative = from below. |
| `orbit.distance` | units | medium shot | From the target. See `describe` → `distances`. |
| `orbit.target` | `[x, y, z]` | model centre | Point the camera looks at. |
| `pos` | `[x, y, z]` | | Camera position. |
| `target` | `[x, y, z]` | | Point the camera looks at. |
| `light` | object | defaults below | Lighting for this shot. Omitted keys use the defaults. |
| `title` | object | none | Caption text by position. |
| `titleLayer` | object | | Per position: `true` = in front of the model, `false` = behind. Defaults: `left` and `right` behind, others in front. |
| `titlePos` | object | | Per position: `{ "x": 50, "y": 20 }`, the text centre as a percentage of the frame. |
| `hold` | seconds | 3 | Time on the shot after the camera arrives. |
| `move` | seconds | 0.67 | Camera travel into the shot. 0 = hard cut. Ignored for the first shot. |
| `portrait` | object | | Overrides used when the frame is taller than wide. Same fields as above: `pos`, `target`, `orbit`, `light`, `title`, `titlePos`, `titleLayer`. |

### Light defaults

`exposure` 1, `keyIntensity` 2.4, `keyAzimuth` 40, `keyElevation` 46, `rimIntensity` 1.2, `ambient` 0.15.

### Caption positions

`top`, `bottom`, `left`, `right`, `statement`, `statementTop`, `statementBottom`, `statementLeft`, `statementRight`. Any other key is rejected with an error that lists the valid ones.

## Coordinates

Y is up. Every model is scaled so that its longest side is 10 units. It is centred on X and Z and rests on the ground (y = 0). The camera's vertical field of view is 45°.

## Timing

The sequence plays in order. Shot 1 starts in place. Every later shot begins with a camera move of `move` seconds, with eased camera and lighting changes. The previous shot's captions fade out during the move. The new captions fade in over 0.7 seconds after the camera arrives, and the shot holds for `hold` seconds from arrival.

Video length = sum of all `hold` + sum of `move` for shots 2 onwards.

## Video output

MP4 at 30 fps, no audio. H.264 when the browser supports it (Google Chrome does). Otherwise VP9 or AV1, still in an MP4 file. The long edge is `output.longEdge` pixels (default 1920), and the frame's shape follows `frame`.

## Command line

```bash
node tools/frameshot.mjs describe <model>
node tools/frameshot.mjs stills   <shots.json> [--out dir] [--model file]
node tools/frameshot.mjs render   <shots.json> [--out dir] [--model file] [--no-stills] [--no-video]
```

Add `--headed` to watch the browser and `--verbose` to see the page's console.

Output is JSON:

```json
{
  "ok": true,
  "model": { "name": "…", "size": [8.2, 3.2, 10], "center": [0, 1.6, 0], "distances": { "closeUp": 9.7, "medium": 15.7, "wide": 21.7 }, "…": "…" },
  "out": "/abs/path/out",
  "stills": [{ "view": 0, "caption": "Reveal", "file": "/abs/path/out/still-01.png", "width": 1600, "height": 900 }],
  "video": { "file": "/abs/path/out/ad.mp4", "width": 1920, "height": 1080, "frames": 471, "seconds": 15.7, "codec": "H.264", "bytes": 7974949 }
}
```

## Browser API (`window.frameshot`)

Open `index.html` over HTTP. `?fresh` starts empty instead of reopening the last model. Wait for `await frameshot.ready`, then:

| Method | Returns |
| --- | --- |
| `loadModel(source, { name })` | Opens a URL, File, Blob or array of Files (a `.gltf` with its `.bin` and textures). Returns the model description. |
| `describeModel()` | Size, centre, distances, mesh and material names, and the coordinate conventions. |
| `getViews()` / `setViews(views)` | Read, or validate and replace, the whole sequence. |
| `addView(view)` | Index of the new view. |
| `updateView(i, patch)` | The merged view. A patch with `orbit` and no `pos` clears the old `pos`/`target`. |
| `removeView(i)` / `clearViews()` | Number of views left. |
| `captureView(extra)` | Index of a new view from the current camera and lighting. |
| `goToView(i, { instant })` | Camera after arriving. |
| `setCamera({ pos, target } \| { orbit }, { instant = true })` / `getCamera()` | `{ pos, target, orbit }`. |
| `setLight(partial)` / `getLight()` | The full lighting state. |
| `setFrame('landscape' \| 'portrait' \| 'phone')` | Stage size. `portrait` and `phone` both use the 9:19.5 phone frame. For exact sizes, size the browser window. |
| `takeImage({ view, captions = true, background = '#000', scale = 1, download = false, fileName })` | `{ width, height, bytes, dataUrl }`, or `{ fileName, … }` when downloading. |
| `play()` / `stop()` | Resolves when playback ends. |
| `exportVideo({ download = true, fileName, longEdge = 1920 })` | `{ fileName, width, height, frames, seconds, codec, bytes }`. |
| `getState()` | Model, view count, active view, camera, light and frame. |
| `schema` | JSON Schema for one view. |
| `help()` | This list as text. |

Errors throw `FrameshotError`. Its `message` combines what went wrong with how to fix it. It also has `title`, `body`, `fix` and sometimes `facts` (file details) and `raw` (the underlying exception).
