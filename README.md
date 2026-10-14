# Frameshot

Frameshot sets up camera shots of 3D models in the browser. Open a model, frame a series of shots with their own lighting and text captions, then save any shot as an image or export the whole sequence as an MP4 video.

The whole tool is one HTML file. There is nothing to install and no build step.

## Run it

Serve the folder over HTTP and open it in a browser:

```bash
python3 -m http.server 8137
```

Then go to http://localhost:8137.

The page loads three.js from a CDN, so it needs an internet connection.

## Open a model

Drop a file anywhere on the page, or click **Open model**.

| Format | Notes |
| --- | --- |
| `.glb` | Recommended. Draco, Meshopt and KTX2 compression are supported. |
| `.gltf` | Open it together with its `.bin` and texture files. |
| `.obj` | Geometry only, with a default material. |
| `.stl` | Geometry only, with a default material. |
| `.fbx` | FBX 7.0 (2011) or later, binary or ASCII. |

Every model is centred, placed on the ground and scaled to a standard size, whatever units it was exported in.

To open a model that is served next to the page, add it to the URL: `http://localhost:8137/?model=models/robot.glb`

If a file can't be opened, a panel explains why and how to fix it. For example, it names missing texture files, unsupported glTF extensions or a Git LFS pointer that hasn't been downloaded.

## Build a sequence

1. Click **Author**.
2. Orbit to the shot you want: drag to orbit, right-drag to pan, scroll to zoom.
3. Adjust the lighting with the sliders: exposure, key light strength, angle and height, rim light and shadow fill.
4. Type a name for the view and click **Capture new**. The view is added to the **Views** list.
5. Repeat for each shot. Drag views in the list to reorder them.

To change a view, select it, re-frame it, and click **Update selected**.

### Caption overlay

Each view can show large text captions. Nine fixed positions are available:

- **Top / Bottom:** large words above or below the model.
- **Left / Right:** smaller words at mid-height.
- **Statement:** one sentence along the bottom.
- **Top line / Bottom line:** a sentence split above and below the model.
- **Left line / Right line:** a sentence split to the left and right of the model.

**Front** puts a caption over the model. **Behind** puts it behind, so the model covers it. **Place on stage** lets you drag captions to any position and double-click to edit their text.

### Portrait framing

Click **Phone frame** to preview the stage as a tall phone screen. While the frame is portrait, **Update selected** saves a separate portrait version of the selected view. The landscape version is left unchanged.

## Export

- **Play** runs the sequence in the browser. The camera moves between views, captions fade in, and each view holds for 3 seconds.
- **Take an image** saves the current frame as a PNG at twice the on-screen resolution, with a transparent background. Captions are not included in the image.
- **Export video** renders the sequence to an MP4 file (30 fps, no audio, H.264 where the browser supports it). The long edge is 1920 pixels, and the video keeps the stage's shape. Captions are included. Frames are rendered one at a time, so playback is smooth even on a slow machine.

Video export uses the WebCodecs API. It works in recent Chrome, Edge and Safari (16.4 or later).

## Use with AI agents

Frameshot can be driven end to end by an AI agent, without the UI. An agent writes a JSON shot list (camera angles, lighting, captions and timing for each shot), renders stills to check its framing, then renders the video.

### Install the skill

The [`skill/frameshot`](skill/frameshot) folder teaches an agent the whole workflow: setup, coordinates, lighting, captions, pacing and how to direct an ad.

- **Claude Code:** copy the folder into your skills folder.
  ```bash
  cp -r skill/frameshot ~/.claude/skills/
  ```
- **Other agents:** point them at [`skill/frameshot/SKILL.md`](skill/frameshot/SKILL.md).

### Command line

Requires Node 18 or later.

```bash
npm install
npx playwright install chromium   # not needed if Google Chrome is installed
```

```bash
node tools/frameshot.mjs describe models/product.glb      # size, centre, camera distances
node tools/frameshot.mjs stills   shots.json --out out    # one PNG per shot, with captions
node tools/frameshot.mjs render   shots.json --out out    # stills and the MP4
```

See [`examples/shots.example.json`](examples/shots.example.json) for a four-shot ad. Each command prints a JSON result, and errors explain how to fix the problem. A views file exported from the Author panel also works as a shot list: add `--model path/to/model.glb`.

Shots can place the camera by angle instead of coordinates:

```json
{ "orbit": { "azimuth": 90, "elevation": 10, "distance": 20 }, "hold": 2.5, "move": 1.2 }
```

`azimuth` 0 is the front of the model and 90 its right side. `hold` is the seconds spent on the shot, and `move` is the seconds the camera takes to get there.

### Browser API

The page exposes `window.frameshot`, so an agent controlling a browser can call it directly instead of clicking. Open `http://localhost:8137/?fresh`, then:

```js
await frameshot.ready;
await frameshot.loadModel('models/product.glb');
frameshot.setViews([{ orbit: { azimuth: 30, elevation: 10 }, title: { bottom: 'Product' } }]);
const { dataUrl } = await frameshot.takeImage({ view: 0 });
await frameshot.exportVideo();
```

`frameshot.help()` lists every method. The full reference is in [`skill/frameshot/reference.md`](skill/frameshot/reference.md).

## Where your work is saved

Everything is stored in your browser. Nothing is uploaded.

- **Views** are saved per model file name. Opening a file with the same name brings its views back.
- **The last model you opened from disk** is reopened when you reload the page.
- **Export / Import** in Author mode moves views between browsers or machines as a JSON file.

Clearing your browser's site data removes all of this.

## Sound (optional)

To add sound to Play, put these files in `audio/`:

| File | Plays |
| --- | --- |
| `bed.mp3` | A looping background track during Play. |
| `whoosh.mp3` | Each camera move. |
| `tick.mp3` | When captions appear. |

The **Sound** button only appears when `bed.mp3` exists. Exported videos have no audio.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | The whole tool: styles, markup, script and the `window.frameshot` API. |
| `tools/frameshot.mjs` | Command-line renderer (headless browser via Playwright). |
| `skill/frameshot/` | Agent skill: workflow, shot list format and API reference. |
| `examples/` | Example shot list. |
| `CLAUDE.md` | Architecture notes and design rules for contributors and AI coding assistants. |
| `audio/` | Optional sound files. |

Model files are listed in `.gitignore`, so they stay on your machine.
